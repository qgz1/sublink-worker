import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

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
        if (!proxy || !proxy.type) return null;

        let result = { name: proxy.tag || '未知节点' };

        switch (proxy.type) {
            case 'shadowsocks':
                result.type = 'ss';
                result.server = proxy.server;
                result.port = proxy.server_port;
                result.cipher = proxy.method;
                result.password = proxy.password;
                break;
            case 'vmess':
                result.type = 'vmess';
                result.server = proxy.server;
                result.port = proxy.server_port;
                result.uuid = proxy.uuid;
                result.alterId = proxy.alter_id || 0;
                result.cipher = proxy.security || 'auto';
                result.tls = !!proxy.tls?.enabled;
                result.servername = proxy.tls?.server_name || '';
                result['skip-cert-verify'] = !!proxy.tls?.insecure;
                result.network = proxy.transport?.type || 'tcp';
                if (proxy.transport?.type === 'ws') {
                    result['ws-opts'] = {
                        path: proxy.transport.path || '/',
                        headers: proxy.transport.headers || {}
                    };
                }
                break;
            case 'vless':
            case 'trojan':
                result.type = proxy.type;
                result.server = proxy.server;
                result.port = proxy.server_port;
                if (proxy.uuid) result.uuid = proxy.uuid;
                if (proxy.password) result.password = proxy.password;
                result.cipher = proxy.security || 'none';
                result.tls = !!proxy.tls?.enabled;
                result.servername = proxy.tls?.server_name || '';
                result['skip-cert-verify'] = !!proxy.tls?.insecure;
                result.network = proxy.transport?.type || 'tcp';
                if (proxy.transport?.type === 'ws') {
                    result['ws-opts'] = {
                        path: proxy.transport.path || '/',
                        headers: proxy.transport.headers || {}
                    };
                }
                if (proxy.transport?.type === 'grpc') {
                    result['grpc-opts'] = { 'grpc-service-name': proxy.transport.service_name || '' };
                }
                if (proxy.tls?.reality?.enabled) {
                    result['reality-opts'] = {
                        'public-key': proxy.tls.reality.public_key || '',
                        'short-id': proxy.tls.reality.short_id || ''
                    };
                }
                break;
            case 'hysteria2':
                result.type = 'hysteria2';
                result.server = proxy.server;
                result.port = proxy.server_port;
                result.password = proxy.password || '';
                result.auth = proxy.auth || '';
                result.obfs = proxy.obfs?.type || '';
                result['obfs-password'] = proxy.obfs?.password || '';
                result.up = proxy.up_mbps || 0;
                result.down = proxy.down_mbps || 0;
                result.sni = proxy.tls?.server_name || '';
                result['skip-cert-verify'] = !!proxy.tls?.insecure;
                break;
            case 'tuic':
                result.type = 'tuic';
                result.server = proxy.server;
                result.port = proxy.server_port;
                result.uuid = proxy.uuid || '';
                result.password = proxy.password || '';
                result['skip-cert-verify'] = !!proxy.tls?.insecure;
                result['disable-sni'] = true;
                result.alpn = proxy.tls?.alpn || [];
                result.sni = proxy.tls?.server_name || '';
                result['udp-relay-mode'] = 'native';
                break;
            default:
                return null;
        }

        return result;
    }

    addProxyToConfig(proxy) {
        if (!proxy) return;
        this.config.proxies = this.config.proxies || [];
        const similar = this.config.proxies.filter(p => p.name === proxy.name);
        if (similar.length > 0) proxy.name = `${proxy.name} ${similar.length + 1}`;
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

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];

        Object.entries(regions).forEach(([regionName, regex]) => {
            const matched = proxyNames.filter(p => regex.test(p));
            if (matched.length === 0) return;
            this.config['proxy-groups'].push({
                name: regionName,
                type: 'url-test',
                url: 'http://www.gstatic.com/generate_204',
                interval: 300,
                tolerance: 50,
                proxies: matched.length ? matched : ['DIRECT']
            });
        });
    }

    addMainGroups(proxyNames) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];

        const groups = [
            { name: '🚀 节点选择', type: 'select', proxies: ['♻️ 自动选择', '🔯 故障转移', '🔮 负载均衡', 'DIRECT'] },
            { name: '♻️ 自动选择', type: 'url-test', url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50, proxies: proxyNames.length ? proxyNames : ['DIRECT'] },
            { name: '🔯 故障转移', type: 'fallback', url: 'http://www.gstatic.com/generate_204', interval: 180, proxies: proxyNames.length ? proxyNames : ['DIRECT'] },
            { name: '🔮 负载均衡', type: 'load-balance', strategy: 'consistent-hashing', url: 'http://www.gstatic.com/generate_204', interval: 180, proxies: proxyNames.length ? proxyNames : ['DIRECT'] },
            { name: '🎯 全球直连', type: 'select', proxies: ['DIRECT', '🚀 节点选择', '♻️ 自动选择'] },
            { name: '🛑 全球拦截', type: 'select', proxies: ['REJECT', 'DIRECT'] },
            { name: '🐟 漏网之鱼', type: 'select', proxies: ['🚀 节点选择', '🎯 全球直连', '♻️ 自动选择', '🔯 故障转移', '🔮 负载均衡'] }
        ];

        this.config['proxy-groups'].push(...groups);
    }

    formatConfig() {
        const proxyList = this.getProxies().map(p => p.name);
        this.config['proxy-groups'] = [];

        this.addMainGroups(proxyList);
        this.addRegionGroups(proxyList);

        const rules = this.generateRules() || [];
        const ruleResults = [];

        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

        rules.forEach(rule => {
            rule.domain_suffix?.forEach(s => s && ruleResults.push(`DOMAIN-SUFFIX,${s},${t('outboundNames.' + rule.outbound)}`));
            rule.domain_keyword?.forEach(k => k && ruleResults.push(`DOMAIN-KEYWORD,${k},${t('outboundNames.' + rule.outbound)}`));
            rule.site_rules?.forEach(s => s && ruleResults.push(`RULE-SET,${s},${t('outboundNames.' + rule.outbound)}`));
            rule.ip_rules?.forEach(ip => ip && ruleResults.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`));
            rule.ip_cidr?.forEach(cidr => cidr && ruleResults.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`));
        });

        if (!ruleResults.includes('MATCH,🐟 漏网之鱼')) ruleResults.push('MATCH,🐟 漏网之鱼');
        this.config.rules = ruleResults;

        return yaml.dump(this.config, { lineWidth: -1, noRefs: true });
    }
}
