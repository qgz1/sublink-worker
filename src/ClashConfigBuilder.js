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
            const { name: _, ...restOfProxy } = proxy;
            const { name: __, ...restOfP } = p;
            return JSON.stringify(restOfProxy) === JSON.stringify(restOfP);
        });

        if (isIdentical) return;

        if (similarProxies.length > 0) {
            proxy.name = `${proxy.name} ${similarProxies.length + 1}`;
        }

        this.config.proxies.push(proxy);
    }

    // ✅ 优化自动测速组：地区+全局，仅生成一次
    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];

        if (this.config['proxy-groups'].some(g => g.name === t('outboundNames.Auto Select'))) return;

        const regions = {
            "🇭🇰 香港自动": proxyList.filter(p => /HK|Hong|香港/i.test(p)),
            "🇸🇬 新加坡自动": proxyList.filter(p => /SG|Singapore|新加坡/i.test(p)),
            "🇺🇸 美国自动": proxyList.filter(p => /US|United|美/i.test(p))
        };

        Object.entries(regions).forEach(([regionName, regionProxies]) => {
            if (regionProxies.length > 0) {
                this.config['proxy-groups'].push({
                    name: regionName,
                    type: 'url-test',
                    proxies: DeepCopy(regionProxies),
                    url: 'https://www.gstatic.com/generate_204',
                    interval: 300,
                    lazy: true
                });
            }
        });

        this.config['proxy-groups'].push({
            name: t('outboundNames.Auto Select'),
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://www.gstatic.com/generate_204',
            interval: 300,
            lazy: true
        });
    }

    // ✅ 节点选择组，包含地区测速组
    addNodeSelectGroup(proxyList) {
        const autoSelectName = t('outboundNames.Auto Select');
        proxyList.unshift(autoSelectName, 'DIRECT', 'REJECT');

        const regionGroups = ['🇭🇰 香港自动', '🇸🇬 新加坡自动', '🇺🇸 美国自动']
            .filter(r => this.config['proxy-groups']?.some(g => g.name === r));

        const mergedProxies = [...regionGroups, ...proxyList];

        this.config['proxy-groups'].unshift({
            type: "select",
            name: t('outboundNames.Node Select'),
            proxies: DeepCopy(mergedProxies)
        });
    }

    // ✅ 出站组优化 + 去重
    addOutboundGroups(outbounds, proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');

        outbounds.forEach(outbound => {
            const outboundName = t(`outboundNames.${outbound}`);

            if (outboundName !== nodeSelect) {
                let optimizedProxies = [
                    nodeSelect,
                    autoSelect,
                    'DIRECT',
                    'REJECT',
                    ...proxyList
                ];

                if (/media|stream|video|youtube|netflix/i.test(outbound)) {
                    optimizedProxies.unshift('🇭🇰 香港自动', '🇸🇬 新加坡自动');
                } else if (/openai|chatgpt|ai/i.test(outbound)) {
                    optimizedProxies.unshift('🇸🇬 新加坡自动', '🇺🇸 美国自动');
                }

                optimizedProxies = [...new Set(optimizedProxies)];

                this.config['proxy-groups'].push({
                    type: "select",
                    name: outboundName,
                    proxies: DeepCopy(optimizedProxies)
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

    // ✅ fallback 优化为测速型 fallback
    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push({
            type: "fallback",
            name: t('outboundNames.Fall Back'),
            proxies: [t('outboundNames.Node Select'), t('outboundNames.Auto Select'), ...proxyList],
            url: 'https://www.gstatic.com/generate_204',
            interval: 300
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

        rules.filter(rule => !!rule.domain_suffix || !!rule.domain_keyword).map(rule => {
            rule.domain_suffix.forEach(suffix => {
                ruleResults.push(`DOMAIN-SUFFIX,${suffix},${t('outboundNames.' + rule.outbound)}`);
            });
            rule.domain_keyword.forEach(keyword => {
                ruleResults.push(`DOMAIN-KEYWORD,${keyword},${t('outboundNames.' + rule.outbound)}`);
            });
        });

        rules.filter(rule => !!rule.site_rules[0]).map(rule => {
            rule.site_rules.forEach(site => {
                ruleResults.push(`RULE-SET,${site},${t('outboundNames.' + rule.outbound)}`);
            });
        });

        rules.filter(rule => !!rule.ip_rules[0]).map(rule => {
            rule.ip_rules.forEach(ip => {
                ruleResults.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`);
            });
        });

        rules.filter(rule => !!rule.ip_cidr).map(rule => {
            rule.ip_cidr.forEach(cidr => {
                ruleResults.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`);
            });
        });

        this.config.rules = [...ruleResults];
        this.config.rules.push(`MATCH,${t('outboundNames.Fall Back')}`);

        return yaml.dump(this.config);
    }
}
