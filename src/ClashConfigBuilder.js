import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules = [], customRules = [], baseConfig = CLASH_CONFIG, lang = 'en', userAgent = 'default') {
        super(inputString, baseConfig, lang, userAgent);
        this.selectedRules = Array.isArray(selectedRules) ? selectedRules : [];
        this.customRules = Array.isArray(customRules) ? customRules : [];
    }

    getProxies() {
        return this.config.proxies || [];
    }

    getProxyName(proxy) {
        return proxy.name || '';
    }

    convertProxy(proxy) {
        if (!proxy || !proxy.type) {
            console.warn('Invalid proxy object:', proxy);
            return null;
        }

        const commonFields = {
            name: proxy.tag || proxy.name || 'Unnamed Proxy',
            server: proxy.server || 'localhost',
            port: proxy.server_port || 443,  // 默认端口改为 443
        };

        switch (proxy.type.toLowerCase()) {
            case 'shadowsocks':
            case 'ss':
                return {
                    ...commonFields,
                    type: 'ss',
                    cipher: proxy.method || 'aes-256-gcm',
                    password: proxy.password || '',
                };
            case 'vmess':
                return {
                    ...commonFields,
                    type: 'vmess',
                    uuid: proxy.uuid || '',
                    alterId: proxy.alter_id || 0,
                    cipher: proxy.security || 'auto',
                    tls: proxy.tls?.enabled ?? true,  // 默认启用 TLS
                    servername: proxy.tls?.server_name || commonFields.server,
                    'skip-cert-verify': !!proxy.tls?.insecure,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path || '/',
                        headers: proxy.transport.headers || {},
                    } : undefined,
                };
            case 'vless':
                return {
                    ...commonFields,
                    type: 'vless',
                    uuid: proxy.uuid || '',
                    cipher: proxy.security || 'auto',
                    tls: proxy.tls?.enabled ?? true,  // 默认启用 TLS
                    'client-fingerprint': proxy.tls?.utls?.fingerprint || 'chrome',  // 默认指纹 chrome
                    servername: proxy.tls?.server_name || commonFields.server,  // 默认 servername 为 server 值
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path || '/',
                        headers: proxy.transport.headers || {},
                    } : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key || '',
                        'short-id': proxy.tls.reality.short_id || '',
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name || '',
                    } : undefined,
                    tfo: !!proxy.tcp_fast_open,
                    'skip-cert-verify': !!proxy.tls?.insecure,
                    flow: proxy.flow || undefined,
                };
            case 'hysteria2':
                return {
                    ...commonFields,
                    type: 'hysteria2',
                    obfs: proxy.obfs?.type || '',
                    'obfs-password': proxy.obfs?.password || '',
                    password: proxy.password || '',
                    auth: proxy.auth || '',
                    up: proxy.up_mbps || 0,
                    down: proxy.down_mbps || 0,
                    'recv-window-conn': proxy.recv_window_conn || 0,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure ?? true,
                };
            case 'trojan':
                return {
                    ...commonFields,
                    type: 'trojan',
                    password: proxy.password || '',
                    cipher: proxy.security || 'auto',
                    tls: proxy.tls?.enabled ?? true,  // 默认启用 TLS
                    'client-fingerprint': proxy.tls?.utls?.fingerprint || 'chrome',  // 默认指纹 chrome
                    sni: proxy.tls?.server_name || commonFields.server,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path || '/',
                        headers: proxy.transport.headers || {},
                    } : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key || '',
                        'short-id': proxy.tls.reality.short_id || '',
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name || '',
                    } : undefined,
                    tfo: !!proxy.tcp_fast_open,
                    'skip-cert-verify': !!proxy.tls?.insecure,
                    flow: proxy.flow || undefined,
                };
            case 'tuic':
                return {
                    ...commonFields,
                    type: 'tuic',
                    uuid: proxy.uuid || '',
                    password: proxy.password || '',
                    'congestion-controller': proxy.congestion || 'cubic',
                    'skip-cert-verify': !!proxy.tls?.insecure,
                    'disable-sni': true,
                    alpn: proxy.tls?.alpn || ['h3'],
                    sni: proxy.tls?.server_name || '',
                    'udp-relay-mode': 'native',
                };
            default:
                console.warn(`Unsupported proxy type: ${proxy.type}`);
                return { ...commonFields, ...proxy }; // Return as-is with warnings
        }
    }

    addProxyToConfig(proxy) {
        if (!proxy) return;

        this.config.proxies = this.config.proxies || [];

        // Convert proxy if needed
        const convertedProxy = this.convertProxy(proxy);
        if (!convertedProxy) return;

        // Additional validation for port
        if (convertedProxy.port <= 0 || convertedProxy.port > 65535) {
            console.error(`Invalid port ${convertedProxy.port} for proxy ${convertedProxy.name}. Skipping.`);
            return;
        }

        // Find similar proxies by name
        const similarProxies = this.config.proxies.filter(p => p.name && p.name.includes(convertedProxy.name));

        // Check for identical data (excluding name)
        const isIdentical = similarProxies.some(p => {
            const { name: _, ...restP } = p;
            const { name: __, ...restProxy } = convertedProxy;
            return JSON.stringify(restP) === JSON.stringify(restProxy);
        });

        if (isIdentical) {
            console.log(`Skipping duplicate proxy: ${convertedProxy.name}`);
            return;
        }

        // Append suffix if similar names exist
        if (similarProxies.length > 0) {
            convertedProxy.name = `${convertedProxy.name} ${similarProxies.length + 1}`;
        }

        this.config.proxies.push(convertedProxy);
    }

    addAutoSelectGroup(proxyList) {
        if (!Array.isArray(proxyList) || proxyList.length === 0) return;

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push({
            name: t('outboundNames.Auto Select'),
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://www.gstatic.com/generate_204',
            interval: 300,
            lazy: false,
        });
    }

    addNodeSelectGroup(proxyList) {
        if (!Array.isArray(proxyList)) return;

        const extendedList = ['DIRECT', 'REJECT', t('outboundNames.Auto Select'), ...proxyList];
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].unshift({
            type: 'select',
            name: t('outboundNames.Node Select'),
            proxies: extendedList,
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        if (!Array.isArray(outbounds) || !Array.isArray(proxyList)) return;

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        outbounds.forEach(outbound => {
            if (outbound !== t('outboundNames.Node Select')) {
                this.config['proxy-groups'].push({
                    type: 'select',
                    name: t(`outboundNames.${outbound}`),
                    proxies: [t('outboundNames.Node Select'), ...proxyList],
                });
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (!Array.isArray(this.customRules) || !Array.isArray(proxyList)) return;

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.customRules.forEach(rule => {
            if (rule.name) {
                this.config['proxy-groups'].push({
                    type: 'select',
                    name: t(`outboundNames.${rule.name}`),
                    proxies: [t('outboundNames.Node Select'), ...proxyList],
                });
            }
        });
    }

    addFallBackGroup(proxyList) {
        if (!Array.isArray(proxyList)) return;

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push({
            type: 'select',
            name: t('outboundNames.Fall Back'),
            proxies: [t('outboundNames.Node Select'), ...proxyList],
        });
    }

    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    formatConfig() {
        const rules = this.generateRules();
        const ruleResults = [];

        // Generate rule providers
        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = {
            ...site_rule_providers,
            ...ip_rule_providers,
        };

        // Domain-based rules first to reduce DNS leaks
        rules.filter(rule => rule.domain_suffix || rule.domain_keyword).forEach(rule => {
            (rule.domain_suffix || []).forEach(suffix => {
                ruleResults.push(`DOMAIN-SUFFIX,${suffix},${t(`outboundNames.${rule.outbound}`)}`);
            });
            (rule.domain_keyword || []).forEach(keyword => {
                ruleResults.push(`DOMAIN-KEYWORD,${keyword},${t(`outboundNames.${rule.outbound}`)}`);
            });
        });

        // Site rule sets
        rules.filter(rule => Array.isArray(rule.site_rules) && rule.site_rules.length > 0).forEach(rule => {
            rule.site_rules.forEach(site => {
                ruleResults.push(`RULE-SET,${site},${t(`outboundNames.${rule.outbound}`)}`);
            });
        });

        // IP rule sets
        rules.filter(rule => Array.isArray(rule.ip_rules) && rule.ip_rules.length > 0).forEach(rule => {
            rule.ip_rules.forEach(ip => {
                ruleResults.push(`RULE-SET,${ip},${t(`outboundNames.${rule.outbound}`)},no-resolve`);
            });
        });

        // IP CIDR rules
        rules.filter(rule => rule.ip_cidr).forEach(rule => {
            (rule.ip_cidr || []).forEach(cidr => {
                ruleResults.push(`IP-CIDR,${cidr},${t(`outboundNames.${rule.outbound}`)},no-resolve`);
            });
        });

        // Set rules and add fallback
        this.config.rules = [...ruleResults, `MATCH,${t('outboundNames.Fall Back')}`];

        return yaml.dump(this.config, { lineWidth: -1 }); // Improved YAML dumping options
    }
}

// Example usage (for testing completeness)
// const builder = new ClashConfigBuilder('input', ['rule1'], [{name: 'custom'}]);
// builder.addProxyToConfig({type: 'ss', server: 'example.com', server_port: 1080, method: 'aes', password: 'pass'});
// console.log(builder.formatConfig());
