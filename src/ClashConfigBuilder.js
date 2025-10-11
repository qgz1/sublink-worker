import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
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

    convertProxy(proxy) {
        switch(proxy.type) {
            case 'shadowsocks':
                return {
                    name: proxy.tag,
                    type: 'ss',
                    server: proxy.server,
                    port: proxy.server_port,
                    cipher: proxy.method,
                    password: proxy.password
                };
            case 'vmess':
                return {
                    name: proxy.tag,
                    type: 'vmess',
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    alterId: proxy.alter_id,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    servername: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined
                };
            case 'vless':
                return {
                    name: proxy.tag,
                    type: 'vless',
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    }: undefined,
                    'reality-opts': proxy.tls?.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo : proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure,
                    'flow': proxy.flow ?? undefined,
                };
            case 'hysteria2':
                return {
                    name: proxy.tag,
                    type: 'hysteria2',
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    obfs: proxy.obfs?.type,
                    'obfs-password': proxy.obfs?.password,
                    auth: proxy.auth,
                    up: proxy.up_mbps,
                    down: proxy.down_mbps,
                    'recv-window-conn': proxy.recv_window_conn,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || true,
                };
            case 'trojan':
                return {
                    name: proxy.tag,
                    type: 'trojan',
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    }: undefined
                };
            case 'tuic':
                return {
                    name: proxy.tag,
                    type: 'tuic',
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    password: proxy.password,
                    'congestion-controller': proxy.congestion,
                    'skip-cert-verify': proxy.tls?.insecure,
                    'disable-sni': true,
                    'alpn': proxy.tls?.alpn,
                    'sni': proxy.tls?.server_name,
                    'udp-relay-mode': 'native',
                };
            default:
                console.warn(`Unknown proxy type: ${proxy.type}, returning as-is`);
                return proxy;
        }
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
    
        // Find proxies with the same or partially matching name
        const similarProxies = this.config.proxies.filter(p => p.name.includes(proxy.name));
    
        // Check if there is a proxy with identical data excluding the 'name' field
        const isIdentical = similarProxies.some(p => {
            const { name: _, ...restOfProxy } = proxy;
            const { name: __, ...restOfP } = p;
            return JSON.stringify(restOfProxy) === JSON.stringify(restOfP);
        });
    
        if (isIdentical) {
            return;
        }
    
        // If there are proxies with similar names but different data, modify the name
        if (similarProxies.length > 0) {
            proxy.name = `${proxy.name} ${similarProxies.length + 1}`;
        }
    
        // Add the proxy to the configuration
        this.config.proxies.push(proxy);
    }

    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        
        // 创建自动选择组
        this.config['proxy-groups'].push({
            name: '🚀 自动节点',
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'http://www.gstatic.com/generate_204',
            interval: 300,
            tolerance: 50
        });
    }

    addNodeSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        
        // 创建节点选择组 - 默认使用自动选择
        this.config['proxy-groups'].unshift({
            type: "select",
            name: "🚀 节点选择",
            proxies: [
                '🚀 自动节点',  // 默认选项
                'DIRECT', 
                'REJECT',
                ...proxyList
            ]
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound !== '🚀 节点选择') {
                this.config['proxy-groups'].push({
                    type: "select",
                    name: outbound,
                    proxies: [
                        '🚀 自动节点',  // 默认自动选择
                        'DIRECT',
                        'REJECT',
                        ...proxyList
                    ]
                });
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config['proxy-groups'].push({
                    type: "select",
                    name: rule.name,
                    proxies: [
                        '🚀 自动节点',  // 默认自动选择
                        'DIRECT',
                        'REJECT',
                        ...proxyList
                    ]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push({
            type: "select",
            name: "Fallback",
            proxies: [
                '🚀 自动节点',  // 默认自动选择
                'DIRECT',
                'REJECT',
                ...proxyList
            ]
        });
    }

    // 生成规则
    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    formatConfig() {
        const rules = this.generateRules();
        const ruleResults = [];
        
        // 获取.mrs规则集配置
        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        
        // 添加规则集提供者
        this.config['rule-providers'] = {
            ...site_rule_providers,
            ...ip_rule_providers
        };

        // 处理域名规则
        rules.filter(rule => rule.domain_suffix && rule.domain_suffix.length > 0).forEach(rule => {
            rule.domain_suffix.forEach(suffix => {
                ruleResults.push(`DOMAIN-SUFFIX,${suffix},${rule.outbound}`);
            });
        });

        rules.filter(rule => rule.domain_keyword && rule.domain_keyword.length > 0).forEach(rule => {
            rule.domain_keyword.forEach(keyword => {
                ruleResults.push(`DOMAIN-KEYWORD,${keyword},${rule.outbound}`);
            });
        });

        // 处理站点规则
        rules.filter(rule => rule.site_rules && rule.site_rules.length > 0).forEach(rule => {
            rule.site_rules.forEach(site => {
                ruleResults.push(`RULE-SET,${site},${rule.outbound}`);
            });
        });

        // 处理IP规则
        rules.filter(rule => rule.ip_rules && rule.ip_rules.length > 0).forEach(rule => {
            rule.ip_rules.forEach(ip => {
                ruleResults.push(`RULE-SET,${ip},${rule.outbound},no-resolve`);
            });
        });

        // 处理CIDR规则
        rules.filter(rule => rule.ip_cidr && rule.ip_cidr.length > 0).forEach(rule => {
            rule.ip_cidr.forEach(cidr => {
                ruleResults.push(`IP-CIDR,${cidr},${rule.outbound},no-resolve`);
            });
        });

        // 添加基本规则
        const basicRules = [
            // 局域网直连
            'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
            'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
            'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
            'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
            'IP-CIDR,100.64.0.0/10,DIRECT,no-resolve',
            
            // GEOIP 中国直连
            'GEOIP,CN,DIRECT',
            
            // 最终规则
            'MATCH,🚀 自动节点'
        ];

        this.config.rules = [...basicRules, ...ruleResults];

        return yaml.dump(this.config, {
            lineWidth: -1, // 不限制行宽
            noRefs: true,  // 不引用重复对象
            noCompatMode: true // 不使用兼容模式
        });
    }

    // 构建配置
    build() {
        // 清空现有代理组
        this.config['proxy-groups'] = [];
        
        // 获取代理列表
        const proxyList = this.getProxies().map(proxy => this.getProxyName(proxy));
        
        // 确保有代理节点
        if (proxyList.length === 0) {
            console.warn('No proxies found, adding fallback proxies');
            // 添加一些基本代理作为fallback
            this.config.proxies = this.config.proxies || [];
            this.config.proxies.push({
                name: 'DIRECT',
                type: 'direct'
            });
            this.config.proxies.push({
                name: 'REJECT', 
                type: 'reject'
            });
            proxyList.push('DIRECT', 'REJECT');
        }
        
        // 添加自动选择组
        this.addAutoSelectGroup(proxyList);
        
        // 添加节点选择组
        this.addNodeSelectGroup(proxyList);
        
        // 添加其他代理组
        const outbounds = getOutbounds(this.selectedRules);
        this.addOutboundGroups(outbounds, proxyList);
        this.addCustomRuleGroups(proxyList);
        this.addFallBackGroup(proxyList);

        // 格式化配置
        return this.formatConfig();
    }

    // 验证配置
    validateConfig() {
        try {
            const configYaml = this.build();
            // 尝试解析YAML来验证格式
            const parsed = yaml.load(configYaml);
            
            // 基本验证
            if (!parsed.proxies) {
                throw new Error('Missing proxies section');
            }
            if (!parsed['proxy-groups']) {
                throw new Error('Missing proxy-groups section');
            }
            if (!parsed.rules) {
                throw new Error('Missing rules section');
            }
            
            return true;
        } catch (error) {
            console.error('Configuration validation failed:', error);
            return false;
        }
    }
}
