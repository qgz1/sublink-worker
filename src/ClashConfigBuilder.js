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

    /** 获取所有代理节点 */
    getProxies() {
        return this.config.proxies || [];
    }

    /** 获取代理节点名称 */
    getProxyName(proxy) {
        return proxy.name;
    }

    /** 协议类型转换（支持 vmess/vless/ss/trojan/tuic/hysteria2） */
    convertProxy(proxy) {
        switch (proxy.type) {
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
                    'ws-opts':
                        proxy.transport?.type === 'ws'
                            ? { path: proxy.transport.path, headers: proxy.transport.headers }
                            : undefined
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
                    'ws-opts':
                        proxy.transport?.type === 'ws'
                            ? { path: proxy.transport.path, headers: proxy.transport.headers }
                            : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled
                        ? {
                              'public-key': proxy.tls.reality.public_key,
                              'short-id': proxy.tls.reality.short_id
                          }
                        : undefined,
                    'grpc-opts':
                        proxy.transport?.type === 'grpc'
                            ? { 'grpc-service-name': proxy.transport.service_name }
                            : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure,
                    flow: proxy.flow ?? undefined
                };
            case 'trojan':
                return {
                    name: proxy.tag,
                    type: 'trojan',
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    tls: proxy.tls?.enabled || false,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts':
                        proxy.transport?.type === 'ws'
                            ? { path: proxy.transport.path, headers: proxy.transport.headers }
                            : undefined
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
                    up: proxy.up_mbps,
                    down: proxy.down_mbps,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure ?? true
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
                    sni: proxy.tls?.server_name
                };
            default:
                return proxy;
        }
    }

    /** 加入代理节点到 config（防重复） */
    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        const exists = this.config.proxies.find(p => p.name === proxy.name);
        if (!exists) this.config.proxies.push(proxy);
    }

    /** 自动生成地区测速组 */
    generateRegionGroups(proxyList) {
        const regions = {
            '🇭🇰 香港自动': /香港|HK|Hong/i,
            '🇸🇬 新加坡自动': /新加坡|SG|Singapore/i,
            '🇯🇵 日本自动': /日本|JP|Tokyo|Osaka/i,
            '🇺🇸 美国自动': /美国|US|United/i,
            '🇹🇼 台湾自动': /台湾|TW|Taiwan/i,
            '🇬🇧 英国自动': /英国|UK|London/i
        };

        const result = [];
        for (const [regionName, regex] of Object.entries(regions)) {
            const matched = proxyList.filter(p => regex.test(p));
            if (matched.length === 0) continue;
            result.push({
                name: regionName,
                type: 'url-test',
                url: 'http://www.gstatic.com/generate_204',
                interval: 600,
                tolerance: 50,
                proxies: matched
            });
        }
        return result;
    }

    /** ✅ 构建 OpenClash 推荐策略组结构 */
    buildProxyGroups(proxyList) {
        if (!proxyList || proxyList.length === 0) proxyList = ['DIRECT'];

        const regionGroups = this.generateRegionGroups(proxyList);

        this.config['proxy-groups'] = [
            {
                name: '🚀 节点选择',
                type: 'select',
                proxies: [
                    '♻️ 自动选择',
                    '🔯 故障转移',
                    '🔮 负载均衡',
                    ...regionGroups.map(r => r.name),
                    'DIRECT'
                ]
            },
            {
                name: '♻️ 自动选择',
                type: 'url-test',
                url: 'http://www.gstatic.com/generate_204',
                interval: 300,
                tolerance: 50,
                proxies: proxyList
            },
            {
                name: '🔯 故障转移',
                type: 'fallback',
                url: 'http://www.gstatic.com/generate_204',
                interval: 180,
                proxies: proxyList
            },
            {
                name: '🔮 负载均衡',
                type: 'load-balance',
                strategy: 'consistent-hashing',
                url: 'http://www.gstatic.com/generate_204',
                interval: 180,
                proxies: proxyList
            },
            ...regionGroups,
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
    }

    /** 生成规则 */
    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    /** 格式化输出为 Clash YAML */
    formatConfig() {
        const proxyList = this.getProxies().map(p => this.getProxyName(p));
        this.buildProxyGroups(proxyList);

        const rules = this.generateRules();
        const ruleResults = [];

        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(
            this.selectedRules,
            this.customRules
        );
        this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

        rules.forEach(rule => {
            rule.domain_suffix?.forEach(s =>
                ruleResults.push(`DOMAIN-SUFFIX,${s},${t('outboundNames.' + rule.outbound)}`)
            );
            rule.domain_keyword?.forEach(k =>
                ruleResults.push(`DOMAIN-KEYWORD,${k},${t('outboundNames.' + rule.outbound)}`)
            );
            rule.site_rules?.forEach(s =>
                ruleResults.push(`RULE-SET,${s},${t('outboundNames.' + rule.outbound)}`)
            );
            rule.ip_rules?.forEach(ip =>
                ruleResults.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`)
            );
            rule.ip_cidr?.forEach(cidr =>
                ruleResults.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`)
            );
        });

        this.config.rules = [...ruleResults, 'MATCH,🐟 漏网之鱼'];

        return yaml.dump(this.config, { sortKeys: false, lineWidth: 120 });
    }
}
