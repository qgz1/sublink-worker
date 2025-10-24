import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

function cleanObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const result = Array.isArray(obj) ? [] : {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'object') {
            const cleaned = cleanObject(value);
            if (Array.isArray(cleaned) && cleaned.length === 0) continue;
            if (!Array.isArray(cleaned) && Object.keys(cleaned).length === 0) continue;
            result[key] = cleaned;
        } else {
            result[key] = value;
        }
    }
    return result;
}

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        if (!baseConfig) baseConfig = CLASH_CONFIG;
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
        let converted;
        switch (proxy.type) {
            case 'shadowsocks':
                converted = {
                    name: proxy.tag,
                    type: 'ss',
                    server: proxy.server,
                    port: proxy.server_port,
                    cipher: proxy.method,
                    password: proxy.password
                };
                break;
            case 'vmess':
                converted = {
                    name: proxy.tag,
                    type: 'vmess',
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    alterId: proxy.alter_id || 0,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    servername: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path || '/', headers: proxy.transport.headers || {} }
                        : undefined
                };
                break;
            case 'vless':
            case 'trojan':
                converted = {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    password: proxy.password,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path || '/', headers: proxy.transport.headers || {} }
                        : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled
                        ? {
                              'public-key': proxy.tls.reality.public_key,
                              'short-id': proxy.tls.reality.short_id
                          }
                        : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc'
                        ? { 'grpc-service-name': proxy.transport.service_name || '' }
                        : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    flow: proxy.flow ?? undefined
                };
                break;
            case 'hysteria2':
                converted = {
                    name: proxy.tag,
                    type: 'hysteria2',
                    server: proxy.server,
                    port: proxy.server_port,
                    obfs: proxy.obfs?.type,
                    'obfs-password': proxy.obfs?.password,
                    password: proxy.password,
                    auth: proxy.auth,
                    up: proxy.up_mbps,
                    down: proxy.down_mbps,
                    'recv-window-conn': proxy.recv_window_conn,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure ?? true
                };
                break;
            case 'tuic':
                converted = {
                    name: proxy.tag,
                    type: 'tuic',
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    password: proxy.password,
                    'congestion-controller': proxy.congestion,
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    'disable-sni': true,
                    alpn: proxy.tls?.alpn,
                    sni: proxy.tls?.server_name,
                    'udp-relay-mode': 'native'
                };
                break;
            default:
                converted = proxy;
        }
        return cleanObject(converted);
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        const similarProxies = this.config.proxies.filter(p => p.name.includes(proxy.name));
        const isIdentical = similarProxies.some(p => {
            const { name: _, ...rest1 } = proxy;
            const { name: __, ...rest2 } = p;
            return JSON.stringify(rest1) === JSON.stringify(rest2);
        });
        if (isIdentical) return;
        if (similarProxies.length > 0) proxy.name = `${proxy.name} ${similarProxies.length + 1}`;
        this.config.proxies.push(proxy);
    }

    addRegionGroups(proxyNames) {
        const regions = {
            '🇭🇰 香港自动': /香港|HK|Hong/i,
            '🇸🇬 新加坡自动': /新加坡|SG|Singapore/i,
            '🇯🇵 日本自动': /日本|JP|Tokyo|Osaka/i,
            '🇺🇸 美国自动': /美国|US|United/i,
            '🇹🇼 台湾自动': /台湾|TW|Taiwan/i,
            '🇬🇧 英国自动': /英国|UK|London/i
        };
        Object.entries(regions).forEach(([regionName, regex]) => {
            const matched = proxyNames.filter(p => regex.test(p));
            if (matched.length === 0) return;
            this.config['proxy-groups'].push({
                name: regionName,
                type: 'url-test',
                url: 'http://www.gstatic.com/generate_204',
                interval: 300,
                tolerance: 50,
                proxies: matched
            });
        });
    }

    addMainGroups(proxyNames) {
        const groups = [
            {
                name: '🚀 节点选择',
                type: 'select',
                proxies: ['♻️ 自动选择', '🔯 故障转移', '🔮 负载均衡', 'DIRECT']
            },
            {
                name: '♻️ 自动选择',
                type: 'url-test',
                url: 'http://www.gstatic.com/generate_204',
                interval: 300,
                tolerance: 50,
                proxies: proxyNames.length > 0 ? proxyNames : ['DIRECT']
            },
            {
                name: '🔯 故障转移',
                type: 'fallback',
                url: 'http://www.gstatic.com/generate_204',
                interval: 180,
                proxies: proxyNames.length > 0 ? proxyNames : ['DIRECT']
            },
            {
                name: '🔮 负载均衡',
                type: 'load-balance',
                strategy: 'consistent-hashing',
                url: 'http://www.gstatic.com/generate_204',
                interval: 180,
                proxies: proxyNames.length > 0 ? proxyNames : ['DIRECT']
            },
            {
                name: '🎯 全球直连',
                type: 'select',
                proxies: ['DIRECT', '🚀 节点选择', '♻️ 自动选择']
            },
            {
                name: '🛑 全球拦截',
                type: 'select',
                proxies: ['REJECT', 'DIRECT']
            },
            {
                name: '🐟 漏网之鱼',
                type: 'select',
                proxies: [
                    '🚀 节点选择',
                    '🎯 全球直连',
                    '♻️ 自动选择',
                    '🔯 故障转移',
                    '🔮 负载均衡'
                ]
            }
        ];
        this.config['proxy-groups'].push(...groups);
    }

    formatConfig() {
        const proxyList = this.getProxies().map(p => p.name);
        this.config['proxy-groups'] = [];
        this.addMainGroups(proxyList);
        this.addRegionGroups(proxyList);

        const rules = this.generateRules();
        const ruleResults = [];

        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

        rules.forEach(rule => {
            rule.domain_suffix?.forEach(s => ruleResults.push(`DOMAIN-SUFFIX,${s},${t('outboundNames.' + rule.outbound)}`));
            rule.domain_keyword?.forEach(k => ruleResults.push(`DOMAIN-KEYWORD,${k},${t('outboundNames.' + rule.outbound)}`));
            rule.site_rules?.forEach(s => ruleResults.push(`RULE-SET,${s},${t('outboundNames.' + rule.outbound)}`));
            rule.ip_rules?.forEach(ip => ruleResults.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`));
            rule.ip_cidr?.forEach(cidr => ruleResults.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`));
        });

        this.config.rules = [...ruleResults];
        this.config.rules.push(`MATCH,🐟 漏网之鱼`);

        return yaml.dump(cleanObject(this.config), { noRefs: true });
    }
}
