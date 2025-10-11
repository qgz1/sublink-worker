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
        this.conversionErrors = []; // 存储转换错误信息
    }

    getProxies() {
        return this.config.proxies || [];
    }

    getProxyName(proxy) {
        return proxy.name;
    }

    // 安全的代理转换方法
    convertProxy(proxy) {
        try {
            if (!proxy || !proxy.tag) {
                throw new Error('Proxy missing required tag field');
            }

            const baseProxy = {
                name: this.sanitizeProxyName(proxy.tag),
                type: proxy.type,
                server: proxy.server,
                port: parseInt(proxy.server_port) || 443,
                udp: true
            };

            // 验证必要字段
            if (!baseProxy.server) {
                throw new Error('Proxy server address is required');
            }

            switch(proxy.type) {
                case 'shadowsocks':
                case 'ss':
                    if (!proxy.method || !proxy.password) {
                        throw new Error('Shadowsocks requires method and password');
                    }
                    return {
                        ...baseProxy,
                        type: 'ss',
                        cipher: proxy.method,
                        password: proxy.password
                    };

                case 'vmess':
                    if (!proxy.uuid) {
                        throw new Error('VMess requires UUID');
                    }
                    return {
                        ...baseProxy,
                        uuid: proxy.uuid,
                        alterId: parseInt(proxy.alter_id) || 0,
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
                    if (!proxy.uuid) {
                        throw new Error('VLESS requires UUID');
                    }
                    return {
                        ...baseProxy,
                        uuid: proxy.uuid,
                        cipher: proxy.security || 'none',
                        tls: proxy.tls?.enabled || false,
                        'client-fingerprint': proxy.tls?.utls?.fingerprint,
                        servername: proxy.tls?.server_name || '',
                        network: proxy.transport?.type || 'tcp',
                        'ws-opts': proxy.transport?.type === 'ws' ? {
                            path: proxy.transport.path || '/',
                            headers: proxy.transport.headers || {}
                        } : undefined,
                        'reality-opts': proxy.tls?.reality?.enabled ? {
                            'public-key': proxy.tls.reality.public_key,
                            'short-id': proxy.tls.reality.short_id || '',
                        } : undefined,
                        'grpc-opts': proxy.transport?.type === 'grpc' ? {
                            'grpc-service-name': proxy.transport.service_name || '',
                        } : undefined,
                        tfo: proxy.tcp_fast_open || false,
                        'skip-cert-verify': proxy.tls?.insecure || false,
                        'flow': proxy.flow || '',
                    };

                case 'hysteria2':
                    if (!proxy.password) {
                        throw new Error('Hysteria2 requires password');
                    }
                    return {
                        ...baseProxy,
                        password: proxy.password,
                        obfs: proxy.obfs?.type,
                        'obfs-password': proxy.obfs?.password,
                        auth: proxy.auth || '',
                        up: parseInt(proxy.up_mbps) || 100,
                        down: parseInt(proxy.down_mbps) || 100,
                        'recv-window-conn': parseInt(proxy.recv_window_conn) || 0,
                        sni: proxy.tls?.server_name || '',
                        'skip-cert-verify': proxy.tls?.insecure || true,
                    };

                case 'trojan':
                    if (!proxy.password) {
                        throw new Error('Trojan requires password');
                    }
                    return {
                        ...baseProxy,
                        password: proxy.password,
                        sni: proxy.tls?.server_name || '',
                        'skip-cert-verify': proxy.tls?.insecure || false,
                        tfo: proxy.tcp_fast_open || false,
                    };

                case 'tuic':
                    if (!proxy.uuid || !proxy.password) {
                        throw new Error('TUIC requires UUID and password');
                    }
                    return {
                        ...baseProxy,
                        uuid: proxy.uuid,
                        password: proxy.password,
                        'congestion-controller': proxy.congestion || 'cubic',
                        'skip-cert-verify': proxy.tls?.insecure || false,
                        'alpn': proxy.tls?.alpn || ['h3'],
                        'sni': proxy.tls?.server_name || '',
                        'udp-relay-mode': 'native',
                    };

                case 'http':
                case 'socks5':
                    return {
                        ...baseProxy,
                        type: proxy.type,
                        username: proxy.username || '',
                        password: proxy.password || ''
                    };

                default:
                    throw new Error(`Unsupported proxy type: ${proxy.type}`);
            }
        } catch (error) {
            const proxyInfo = proxy ? `[${proxy.type}] ${proxy.tag || 'unknown'}` : 'unknown proxy';
            const errorMsg = `Failed to convert proxy ${proxyInfo}: ${error.message}`;
            this.conversionErrors.push(errorMsg);
            console.warn(errorMsg);
            return null;
        }
    }

    // 清理代理名称
    sanitizeProxyName(name) {
        if (!name) return 'unknown';
        // 移除可能引起问题的字符
        return name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_\.]/g, '_')
                   .substring(0, 50); // 限制长度
    }

    addProxyToConfig(proxy) {
        if (!proxy) return;
        
        this.config.proxies = this.config.proxies || [];

        // 检查是否已存在相同配置的代理（排除名称）
        const isDuplicate = this.config.proxies.some(existingProxy => {
            const { name: _, ...existingConfig } = existingProxy;
            const { name: __, newConfig } = proxy;
            return JSON.stringify(existingConfig) === JSON.stringify(newConfig);
        });

        if (isDuplicate) {
            return;
        }

        // 处理名称冲突
        const similarNames = this.config.proxies.filter(p => 
            p.name === proxy.name || p.name.startsWith(proxy.name)
        );

        if (similarNames.length > 0) {
            proxy.name = `${proxy.name}_${similarNames.length + 1}`;
        }

        this.config.proxies.push(proxy);
    }

    // 批量处理代理转换
    processProxies(proxies) {
        this.conversionErrors = [];
        const successfulProxies = [];

        proxies.forEach(proxy => {
            try {
                const convertedProxy = this.convertProxy(proxy);
                if (convertedProxy) {
                    this.addProxyToConfig(convertedProxy);
                    successfulProxies.push(convertedProxy);
                }
            } catch (error) {
                const errorMsg = `Error processing proxy: ${error.message}`;
                this.conversionErrors.push(errorMsg);
                console.error(errorMsg);
            }
        });

        return {
            successful: successfulProxies,
            errors: this.conversionErrors,
            total: proxies.length,
            successCount: successfulProxies.length,
            errorCount: this.conversionErrors.length
        };
    }

    // 设置自动选择代理组
    setupAutoSelectGroups(proxyList) {
        if (!proxyList || proxyList.length === 0) {
            throw new Error('No valid proxies available for auto selection');
        }

        this.config['proxy-groups'] = [];
        
        // 主自动选择组 - 延迟测试
        this.config['proxy-groups'].push({
            name: t('outboundNames.Auto Select'),
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://www.gstatic.com/generate_204',
            interval: 300,
            tolerance: 100,
            lazy: true
        });
        
        // 故障转移组
        this.config['proxy-groups'].push({
            name: t('outboundNames.Fall Back'),
            type: 'fallback',
            proxies: DeepCopy(proxyList),
            url: 'https://www.gstatic.com/generate_204',
            interval: 300,
            lazy: true
        });

        // 如果代理数量足够，添加负载均衡
        if (proxyList.length >= 3) {
            this.config['proxy-groups'].push({
                name: t('outboundNames.Load Balance'),
                type: 'load-balance',
                proxies: DeepCopy(proxyList),
                url: 'https://www.gstatic.com/generate_204',
                interval: 300,
                strategy: 'round-robin',
                lazy: true
            });
        }
    }

    // 生成自动选择规则
    generateAutoSelectRules() {
        try {
            const rules = generateRules(this.selectedRules, this.customRules);
            const ruleResults = [];
            
            const autoSelectGroup = t('outboundNames.Auto Select');

            // 基础直连规则
            ruleResults.push('PROCESS-NAME,clash,DIRECT');
            ruleResults.push('PROCESS-NAME,clash-meta,DIRECT');
            ruleResults.push('DOMAIN-SUFFIX,local,DIRECT');
            ruleResults.push('IP-CIDR,127.0.0.0/8,DIRECT');
            ruleResults.push('IP-CIDR,172.16.0.0/12,DIRECT');
            ruleResults.push('IP-CIDR,192.168.0.0/16,DIRECT');
            ruleResults.push('IP-CIDR,10.0.0.0/8,DIRECT');
            ruleResults.push('IP-CIDR,100.64.0.0/10,DIRECT');

            // 处理各种规则类型
            if (rules && Array.isArray(rules)) {
                // 域名后缀规则
                rules.filter(rule => rule?.domain_suffix?.length > 0).forEach(rule => {
                    const outbound = this.getOutboundForRule(rule.outbound, autoSelectGroup);
                    rule.domain_suffix.forEach(suffix => {
                        ruleResults.push(`DOMAIN-SUFFIX,${suffix},${outbound}`);
                    });
                });

                // 域名关键词规则
                rules.filter(rule => rule?.domain_keyword?.length > 0).forEach(rule => {
                    const outbound = this.getOutboundForRule(rule.outbound, autoSelectGroup);
                    rule.domain_keyword.forEach(keyword => {
                        ruleResults.push(`DOMAIN-KEYWORD,${keyword},${outbound}`);
                    });
                });

                // 站点规则集
                rules.filter(rule => rule?.site_rules?.length > 0).forEach(rule => {
                    const outbound = this.getOutboundForRule(rule.outbound, autoSelectGroup);
                    rule.site_rules.forEach(site => {
                        if (site) {
                            ruleResults.push(`RULE-SET,${site},${outbound}`);
                        }
                    });
                });

                // IP 规则集
                rules.filter(rule => rule?.ip_rules?.length > 0).forEach(rule => {
                    const outbound = this.getOutboundForRule(rule.outbound, autoSelectGroup);
                    rule.ip_rules.forEach(ip => {
                        if (ip) {
                            ruleResults.push(`RULE-SET,${ip},${outbound},no-resolve`);
                        }
                    });
                });

                // IP-CIDR 规则
                rules.filter(rule => rule?.ip_cidr?.length > 0).forEach(rule => {
                    const outbound = this.getOutboundForRule(rule.outbound, autoSelectGroup);
                    rule.ip_cidr.forEach(cidr => {
                        if (cidr) {
                            ruleResults.push(`IP-CIDR,${cidr},${outbound},no-resolve`);
                        }
                    });
                });
            }

            return ruleResults;
        } catch (error) {
            console.error('Error generating rules:', error);
            // 返回基础规则作为备选
            return [
                'PROCESS-NAME,clash,DIRECT',
                'DOMAIN-SUFFIX,local,DIRECT',
                'IP-CIDR,127.0.0.0/8,DIRECT',
                'IP-CIDR,192.168.0.0/16,DIRECT',
                'IP-CIDR,10.0.0.0/8,DIRECT',
                'GEOIP,CN,DIRECT',
                'MATCH,' + t('outboundNames.Auto Select')
            ];
        }
    }

    // 获取规则出口
    getOutboundForRule(outbound, autoSelectGroup) {
        if (outbound === 'DIRECT' || outbound === 'REJECT') {
            return outbound;
        }
        return autoSelectGroup;
    }

    // 配置验证
    validateConfig() {
        const errors = [];
        const warnings = [];
        
        if (!this.config.proxies || this.config.proxies.length === 0) {
            errors.push('No proxies configured');
        }
        
        if (!this.config['proxy-groups'] || this.config['proxy-groups'].length === 0) {
            errors.push('No proxy groups configured');
        }

        if (this.conversionErrors.length > 0) {
            warnings.push(`${this.conversionErrors.length} proxies failed to convert`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            conversionErrors: this.conversionErrors
        };
    }

    // 生成完整配置（主方法）
    formatConfig() {
        try {
            // 重置配置
            this.config = DeepCopy(this.baseConfig);
            
            // 处理输入字符串（订阅链接或代理列表）
            const processResult = this.processInput();
            if (!processResult.success) {
                throw new Error(processResult.error);
            }

            // 获取代理列表
            const proxyList = this.config.proxies.map(p => p.name);
            
            if (proxyList.length === 0) {
                throw new Error('No valid proxies found after processing');
            }

            // 设置自动选择代理组
            this.setupAutoSelectGroups(proxyList);

            // 验证配置
            const validation = this.validateConfig();
            if (!validation.isValid) {
                throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
            }

            // 生成规则
            const rules = this.generateAutoSelectRules();
            
            // 配置规则提供者
            this.setupRuleProviders();

            // 设置最终规则
            this.config.rules = [
                ...rules,
                `MATCH,${t('outboundNames.Auto Select')}`
            ];

            return {
                config: yaml.dump(this.config, {
                    lineWidth: -1,
                    noRefs: true,
                    skipInvalid: true
                }),
                stats: {
                    totalProxies: proxyList.length,
                    conversionErrors: this.conversionErrors.length,
                    validation: validation
                }
            };
            
        } catch (error) {
            console.error('Error formatting Clash config:', error);
            return {
                error: error.message,
                config: null,
                stats: {
                    conversionErrors: this.conversionErrors,
                    error: error.message
                }
            };
        }
    }

    // 处理输入（订阅链接或代理列表）
    processInput() {
        try {
            if (!this.inputString) {
                return { success: true, message: 'No input to process' };
            }

            // 检查是否是订阅链接
            if (this.inputString.startsWith('http')) {
                return this.processSubscriptionLink();
            } else {
                // 尝试解析为代理配置
                return this.processProxyConfig();
            }
        } catch (error) {
            return { 
                success: false, 
                error: `Failed to process input: ${error.message}` 
            };
        }
    }

    // 处理订阅链接
    processSubscriptionLink() {
        // 这里应该实现订阅链接的获取和解析
        // 由于环境限制，这里只是示意
        console.warn('Subscription link processing requires network access');
        return {
            success: false,
            error: 'Subscription processing not implemented in this environment'
        };
    }

    // 处理代理配置
    processProxyConfig() {
        try {
            let proxies = [];
            
            // 尝试解析为 JSON
            if (this.inputString.trim().startsWith('[') || this.inputString.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(this.inputString);
                    proxies = Array.isArray(parsed) ? parsed : [parsed];
                } catch (e) {
                    // 不是有效的 JSON，尝试其他格式
                    proxies = this.parsePlainTextProxies(this.inputString);
                }
            } else {
                // 处理纯文本格式
                proxies = this.parsePlainTextProxies(this.inputString);
            }

            // 处理代理
            const result = this.processProxies(proxies);
            
            return {
                success: result.successCount > 0,
                processed: result.successCount,
                errors: result.errors,
                message: result.successCount > 0 ? 
                    `Successfully processed ${result.successCount} proxies` :
                    'No proxies were successfully processed'
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to parse proxy config: ${error.message}`
            };
        }
    }

    // 解析纯文本代理配置
    parsePlainTextProxies(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const proxies = [];
        
        lines.forEach(line => {
            try {
                // 这里可以实现各种纯文本代理格式的解析
                // 例如：ss://, vmess://, trojan:// 等
                if (line.includes('://')) {
                    const proxy = this.parseProxyURL(line);
                    if (proxy) {
                        proxies.push(proxy);
                    }
                }
            } catch (e) {
                this.conversionErrors.push(`Failed to parse line: ${line.substring(0, 50)}...`);
            }
        });
        
        return proxies;
    }

    // 解析代理 URL（基础实现）
    parseProxyURL(url) {
        // 这里应该实现各种代理协议的 URL 解析
        // 由于复杂度，这里只是返回基础结构
        console.warn('Proxy URL parsing not fully implemented');
        return null;
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
            console.warn('Failed to setup rule providers:', error);
        }
    }

    // 获取转换统计信息
    getConversionStats() {
        return {
            totalProxies: this.config.proxies?.length || 0,
            errors: this.conversionErrors,
            errorCount: this.conversionErrors.length
        };
    }
}
