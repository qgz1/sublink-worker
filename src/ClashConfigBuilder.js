import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class StableClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        if (!baseConfig) {
            baseConfig = CLASH_CONFIG;
        }
        super(inputString, baseConfig, lang, userAgent);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
    }

    getProxies() {
        return this.config.proxies || [];
    }

    getProxyName(proxy) {
        return proxy.name;
    }

    // 简化的代理转换，只处理必要字段
    convertProxy(proxy) {
        if (!proxy || !proxy.tag) {
            return null;
        }

        const baseProxy = {
            name: proxy.tag,
            type: proxy.type,
            server: proxy.server,
            port: proxy.server_port
        };

        switch(proxy.type) {
            case 'shadowsocks':
                return {
                    ...baseProxy,
                    type: 'ss',
                    cipher: proxy.method,
                    password: proxy.password
                };
            case 'vmess':
                return {
                    ...baseProxy,
                    uuid: proxy.uuid,
                    alterId: proxy.alter_id || 0,
                    cipher: proxy.security || 'auto',
                    tls: proxy.tls?.enabled || false,
                    servername: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path || '/',
                        headers: proxy.transport.headers || {}
                    } : undefined
                };
            case 'vless':
                return {
                    ...baseProxy,
                    uuid: proxy.uuid,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path || '/',
                        headers: proxy.transport.headers || {}
                    } : undefined,
                    'skip-cert-verify': proxy.tls?.insecure || false
                };
            case 'hysteria2':
                return {
                    ...baseProxy,
                    password: proxy.password,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || true,
                };
            case 'trojan':
                return {
                    ...baseProxy,
                    password: proxy.password,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || false,
                };
            case 'tuic':
                return {
                    ...baseProxy,
                    uuid: proxy.uuid,
                    password: proxy.password,
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    sni: proxy.tls?.server_name || '',
                };
            default:
                // 对于不支持的代理类型，返回基础结构
                return baseProxy;
        }
    }

    addProxyToConfig(proxy) {
        if (!proxy) return;
        
        this.config.proxies = this.config.proxies || [];
        
        // 简单的重复检查
        const exists = this.config.proxies.some(p => 
            p.name === proxy.name && 
            p.server === proxy.server && 
            p.port === proxy.port
        );
        
        if (!exists) {
            this.config.proxies.push(proxy);
        }
    }

    // 简化的自动选择配置
    setupAutoSelect() {
        const proxyList = this.config.proxies.map(p => p.name);
        
        if (proxyList.length === 0) {
            return;
        }

        this.config['proxy-groups'] = [
            {
                name: t('outboundNames.Auto Select'),
                type: 'url-test',
                proxies: proxyList,
                url: 'https://www.gstatic.com/generate_204',
                interval: 300
            },
            {
                name: t('outboundNames.Proxy'),
                type: 'select',
                proxies: [t('outboundNames.Auto Select'), ...proxyList]
            }
        ];
    }

    // 生成规则
    generateRules() {
        const rules = generateRules(this.selectedRules, this.customRules);
        const ruleResults = [];
        
        const proxyGroup = t('outboundNames.Proxy');
        const autoSelectGroup = t('outboundNames.Auto Select');

        // 基础规则
        ruleResults.push('DOMAIN-SUFFIX,local,DIRECT');
        ruleResults.push('IP-CIDR,127.0.0.0/8,DIRECT');
        ruleResults.push('IP-CIDR,172.16.0.0/12,DIRECT');
        ruleResults.push('IP-CIDR,192.168.0.0/16,DIRECT');
        ruleResults.push('IP-CIDR,10.0.0.0/8,DIRECT');

        // 处理规则
        if (rules && Array.isArray(rules)) {
            rules.forEach(rule => {
                if (!rule || !rule.outbound) return;

                const outbound = (rule.outbound === 'DIRECT' || rule.outbound === 'REJECT') 
                    ? rule.outbound 
                    : proxyGroup;

                // 处理各种规则类型
                rule.domain_suffix?.forEach(suffix => {
                    ruleResults.push(`DOMAIN-SUFFIX,${suffix},${outbound}`);
                });

                rule.domain_keyword?.forEach(keyword => {
                    ruleResults.push(`DOMAIN-KEYWORD,${keyword},${outbound}`);
                });

                rule.site_rules?.forEach(site => {
                    if (site) ruleResults.push(`RULE-SET,${site},${outbound}`);
                });

                rule.ip_rules?.forEach(ip => {
                    if (ip) ruleResults.push(`RULE-SET,${ip},${outbound},no-resolve`);
                });

                rule.ip_cidr?.forEach(cidr => {
                    if (cidr) ruleResults.push(`IP-CIDR,${cidr},${outbound},no-resolve`);
                });
            });
        }

        // 最终匹配规则
        ruleResults.push(`MATCH,${autoSelectGroup}`);

        return ruleResults;
    }

    // 设置规则提供者
    setupRuleProviders() {
        try {
            const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
            
            if (site_rule_providers || ip_rule_providers) {
                this.config['rule-providers'] = {
                    ...(site_rule_providers || {}),
                    ...(ip_rule_providers || {})
                };
            }
        } catch (error) {
            // 静默处理错误，不影响主流程
            console.warn('Rule providers setup failed:', error);
        }
    }

    // 主配置生成方法 - 简化版本
    formatConfig() {
        try {
            // 处理代理
            if (this.inputString) {
                this.processInput();
            }

            // 设置自动选择
            this.setupAutoSelect();

            // 设置规则
            this.config.rules = this.generateRules();

            // 设置规则提供者
            this.setupRuleProviders();

            // 返回YAML配置
            return yaml.dump(this.config);
            
        } catch (error) {
            console.error('Configuration generation failed:', error);
            
            // 返回一个基础的配置，确保不崩溃
            return yaml.dump({
                ...this.config,
                rules: [
                    'DOMAIN-SUFFIX,local,DIRECT',
                    'IP-CIDR,127.0.0.0/8,DIRECT',
                    'IP-CIDR,192.168.0.0/16,DIRECT',
                    'MATCH,' + t('outboundNames.Auto Select')
                ]
            });
        }
    }

    // 处理输入 - 简化版本
    processInput() {
        if (!this.inputString) return;

        try {
            let proxies = [];
            
            // 尝试解析为JSON
            if (this.inputString.trim().startsWith('[')) {
                proxies = JSON.parse(this.inputString);
            } 
            // 尝试解析为YAML
            else if (this.inputString.includes('proxies:')) {
                const parsed = yaml.load(this.inputString);
                proxies = parsed.proxies || [];
            }
            
            // 处理代理
            if (Array.isArray(proxies)) {
                proxies.forEach(proxy => {
                    const converted = this.convertProxy(proxy);
                    if (converted) {
                        this.addProxyToConfig(converted);
                    }
                });
            }
        } catch (error) {
            console.warn('Input processing failed:', error);
            // 不抛出错误，继续执行
        }
    }
}
