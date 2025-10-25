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

    // ===========================
    //   基础代理节点转换部分
    // ===========================
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
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined
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
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled
                        ? {
                              'public-key': proxy.tls.reality.public_key,
                              'short-id': proxy.tls.reality.short_id
                          }
                        : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc'
                        ? { 'grpc-service-name': proxy.transport.service_name }
                        : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure,
                    flow: proxy.flow ?? undefined
                };
            case 'hysteria2':
                return {
                    name: proxy.tag,
                    type: proxy.type,
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
            case 'trojan':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    sni: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled
                        ? {
                              'public-key': proxy.tls.reality.public_key,
                              'short-id': proxy.tls.reality.short_id
                          }
                        : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc'
                        ? { 'grpc-service-name': proxy.transport.service_name }
                        : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure,
                    flow: proxy.flow ?? undefined
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
                    'skip-cert-verify': proxy.tls?.insecure,
                    'disable-sni': true,
                    alpn: proxy.tls?.alpn,
                    sni: proxy.tls?.server_name,
                    'udp-relay-mode': 'native'
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

    // ===========================
    // 🔧 简化代理组逻辑部分
    // ===========================
    addProxyGroups(proxyList) {
        this.config['proxy-groups'] = [];

        const nodeSelect = t('outboundNames.Node Select');
        const autoSelect = t('outboundNames.Auto Select');
        const fallBack = t('outboundNames.Fall Back');

        // ① 节点选择组（手动）
        this.config['proxy-groups'].push({
            name: nodeSelect,
            type: 'select',
            proxies: ['DIRECT', 'REJECT', autoSelect, ...proxyList]
        });

        // ② 自动测速组（全局测速）
        this.config['proxy-groups'].push({
            name: autoSelect,
            type: 'url-test',
            proxies: [...proxyList],
            url: 'https://cp.cloudflare.com/generate_204',
            interval: 600,
            tolerance: 50,
            lazy: true
        });

        // ③ 地区测速组
        const regions = {
            '🇭🇰 香港自动': /香港|HK|Hong/i,
            '🇸🇬 新加坡自动': /新加坡|SG|Singapore/i,
            '🇯🇵 日本自动': /日本|JP|Tokyo|Osaka/i,
            '🇺🇸 美国自动': /美国|US|United/i,
            '🇹🇼 台湾自动': /台湾|TW|Taiwan/i,
            '🇬🇧 英国自动': /英国|UK|London/i
        };

        for (const [name, regex] of Object.entries(regions)) {
            const matched = proxyList.filter(p => regex.test(p));
            if (!matched.length) continue;

            this.config['proxy-groups'].push({
                name,
                type: 'url-test',
                proxies: matched,
                url: 'https://cp.cloudflare.com/generate_204',
                interval: 600,
                tolerance: 50,
                lazy: true
            });
        }

        // ④ 兜底组
        this.config['proxy-groups'].push({
            name: fallBack,
            type: 'select',
            proxies: [nodeSelect, ...proxyList]
        });
    }

    // ===========================
    //   规则部分保持不变
    // ===========================
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

        return yaml.dump(this.config, { skipInvalid: true, forceQuotes: true });
    }
}
