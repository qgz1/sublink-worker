import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
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
                    type: proxy.type,
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
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls.utls?.fingerprint,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined,
                    'reality-opts': proxy.tls.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls.insecure,
                    'flow': proxy.flow ?? undefined,
                };
            case 'hysteria2':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    obfs: proxy.obfs.type,
                    'obfs-password': proxy.obfs.password,
                    password: proxy.password,
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
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls.utls?.fingerprint,
                    sni: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined,
                    'reality-opts': proxy.tls.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls.insecure,
                    'flow': proxy.flow ?? undefined,
                };
            case 'tuic':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    password: proxy.password,
                    'congestion-controller': proxy.congestion,
                    'skip-cert-verify': proxy.tls.insecure,
                    'disable-sni': true,
                    'alpn': proxy.tls.alpn,
                    'sni': proxy.tls.server_name,
                    'udp-relay-mode': 'native',
                };
            default:
                return proxy;
        }
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

    addAutoSelectGroup(proxyList) {
        const autoName = t('outboundNames.Auto Select');
        if (this.config['proxy-groups']?.some(g => g.name === autoName)) return;

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push({
            name: autoName,
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://www.gstatic.com/generate_204',
            interval: 300,
            lazy: false
        });
    }

    addNodeSelectGroup(proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');

        const merged = new Set([autoSelect, 'DIRECT', 'REJECT', ...proxyList]);
        if (this.config['proxy-groups']?.some(g => g.name === nodeSelect)) return;

        this.config['proxy-groups'].unshift({
            type: "select",
            name: nodeSelect,
            proxies: DeepCopy([...merged])
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');

        // 定义优先节点（可以根据实际情况调整）
        const priorityNodes = ['🇭🇰 香港自动', '🇸🇬 新加坡自动', '🇯🇵 日本自动'];

        outbounds.forEach(outbound => {
            const outboundName = t(`outboundNames.${outbound}`);
            if (outboundName !== nodeSelect) {
                let optimized;

                // 国内服务仅保留直连
                if (outboundName === t('outboundNames.国内服务') || outboundName === '🔒 国内服务') {
                    optimized = ['DIRECT'];
                } else {
                    // 默认包含所有节点和自动
                    optimized = new Set([
                        ...priorityNodes,
                        autoSelect,
                        'DIRECT',
                        'REJECT',
                        ...proxyList
                    ]);

                    // 根据不同类型，优先排序
                    const lowerOutbound = outbound.toLowerCase();

                    // 流媒体
                    if (/media|stream|video|youtube|netflix/i.test(lowerOutbound)) {
                        optimized = new Set([
                            '🇭🇰 香港自动',
                            '🇸🇬 新加坡自动',
                            ...optimized
                        ]);
                    }
                    // AI/ChatGPT
                    else if (/openai|chatgpt|ai/i.test(lowerOutbound)) {
                        optimized = new Set([
                            '🇸🇬 新加坡自动',
                            '🇺🇸 美国自动',
                            ...optimized
                        ]);
                    }
                    // 游戏
                    else if (/game|gaming|steam/i.test(lowerOutbound)) {
                        optimized = new Set([
                            '🇭🇰 香港自动',
                            '🇯🇵 日本自动',
                            ...optimized
                        ]);
                    }
                    // 下载
                    else if (/download|torrent|p2p/i.test(lowerOutbound)) {
                        optimized = new Set([
                            '🇸🇬 新加坡自动',
                            '🇯🇵 日本自动',
                            ...optimized
                        ]);
                    }
                    // 社交、社媒
                    else if (/social|twitter|facebook|telegram/i.test(lowerOutbound)) {
                        optimized = new Set([
                            '🇭🇰 香港自动',
                            '🇸🇬 新加坡自动',
                            ...optimized
                        ]);
                    }
                }

                this.config['proxy-groups'].push({
                    type: "select",
                    name: outboundName,
                    proxies: DeepCopy([...optimized])
                });
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config['proxy-groups'].push({
                    type: "select",
                    name: t(`outboundNames.${rule.name}`),
                    proxies: [t('outboundNames.Node Select'), ...proxyList]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push({
            type: "select",
            name: t('outboundNames.Fall Back'),
            proxies: [t('outboundNames.Node Select'), ...proxyList]
        });
    }

    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    formatConfig() {
        const rules = this.generateRules();
        const ruleResults = [];

        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

        rules.filter(r => !!r.domain_suffix || !!r.domain_keyword).forEach(rule => {
            rule.domain_suffix?.forEach(s => ruleResults.push(`DOMAIN-SUFFIX,${s},${t('outboundNames.' + rule.outbound)}`));
            rule.domain_keyword?.forEach(k => ruleResults.push(`DOMAIN-KEYWORD,${k},${t('outboundNames.' + rule.outbound)}`));
        });

        rules.filter(r => !!r.site_rules?.[0]).forEach(rule => {
            rule.site_rules.forEach(s => ruleResults.push(`RULE-SET,${s},${t('outboundNames.' + rule.outbound)}`));
        });

        rules.filter(r => !!r.ip_rules?.[0]).forEach(rule => {
            rule.ip_rules.forEach(ip => ruleResults.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`));
        });

        rules.filter(r => !!r.ip_cidr).forEach(rule => {
            rule.ip_cidr.forEach(cidr => ruleResults.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`));
        });

        this.config.rules = [...ruleResults];
        this.config.rules.push(`MATCH,${t('outboundNames.Fall Back')}`);

        return yaml.dump(this.config);
    }
}
