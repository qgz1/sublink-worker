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

    // ------------------- 自动地区测速组 -------------------
    addRegionGroups(proxyList) {
        const regions = {
            '🇭🇰 香港自动': /香港|HK|Hong/i,
            '🇸🇬 新加坡自动': /新加坡|SG|Singapore/i,
            '🇯🇵 日本自动': /日本|JP|Tokyo|Osaka/i,
            '🇺🇸 美国自动': /美国|US|United/i,
            '🇹🇼 台湾自动': /台湾|TW|Taiwan/i,
            '🇬🇧 英国自动': /英国|UK|London/i
        };

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];

        for (const [regionName, regex] of Object.entries(regions)) {
            const matched = proxyList.filter(p => regex.test(p));
            if (matched.length === 0) continue;

            this.config['proxy-groups'].push({
                name: regionName,
                type: 'url-test',
                proxies: matched,
                url: 'https://cp.cloudflare.com/generate_204',
                interval: 600,
                tolerance: 50,
                lazy: true
            });
        }
    }

    // 自动选择组
    addAutoSelectGroup(proxyList) {
        const autoName = t('outboundNames.Auto Select') || '自动选择';
        if (this.config['proxy-groups']?.some(g => g.name === autoName)) return;
        this.config['proxy-groups'].push({
            name: autoName,
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://cp.cloudflare.com/generate_204',
            interval: 600,
            tolerance: 50,
            lazy: true
        });
    }

    // 节点选择组
    addNodeSelectGroup(proxyList) {
        const nodeSelect = t('outboundNames.Node Select') || '节点选择';
        const autoSelect = t('outboundNames.Auto Select') || '自动选择';
        const merged = new Set([autoSelect, 'DIRECT', 'REJECT', ...proxyList]);

        this.config['proxy-groups'].unshift({
            type: 'select',
            name: nodeSelect,
            proxies: DeepCopy([...merged])
        });
    }

    // ------------------- 规则生成器 -------------------
    generateRules() {
        const result = [];
        const { customRules = [], selectedRules = [] } = this;
        const rules = [...selectedRules, ...customRules].filter(Boolean);

        rules.forEach(rule => {
            const outbound = t('outboundNames.' + rule.outbound) || '节点选择';
            rule.domain_suffix?.forEach(s => result.push(`DOMAIN-SUFFIX,${s},${outbound}`));
            rule.domain_keyword?.forEach(k => result.push(`DOMAIN-KEYWORD,${k},${outbound}`));
            rule.domain?.forEach(d => result.push(`DOMAIN,${d},${outbound}`));
            rule.site_rules?.forEach(s => result.push(`RULE-SET,${s},${outbound}`));
            rule.ip_rules?.forEach(ip => result.push(`RULE-SET,${ip},${outbound},no-resolve`));
            rule.ip_cidr?.forEach(cidr => result.push(`IP-CIDR,${cidr},${outbound},no-resolve`));
        });

        result.push(`GEOIP,CN,DIRECT`);
        result.push(`MATCH,${t('outboundNames.Node Select') || '节点选择'}`);

        return Array.from(new Set(result.filter(Boolean)));
    }

    // ------------------- 输出配置 -------------------
    formatConfig() {
        const rules = this.generateRules();
        const { site_rule_providers, ip_rule_providers } =
            generateClashRuleSets(this.selectedRules, this.customRules);

        this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

        const proxyList = this.getProxies().map(p => this.getProxyName(p));
        this.config['proxy-groups'] = [];

        this.addRegionGroups(proxyList);
        this.addAutoSelectGroup(proxyList);
        this.addNodeSelectGroup(proxyList);

        this.config.rules = [...rules];

        // 自动清理 undefined 防止 YAML 报错
        const clean = obj => {
            if (Array.isArray(obj)) return obj.map(clean).filter(Boolean);
            if (obj && typeof obj === 'object') {
                const r = {};
                for (const [k, v] of Object.entries(obj)) {
                    const c = clean(v);
                    if (c !== undefined && c !== null) r[k] = c;
                }
                return r;
            }
            return obj;
        };

        this.config = clean(this.config);

        try {
            return yaml.dump(this.config, {
                skipInvalid: true,
                sortKeys: false,
                lineWidth: -1
            });
        } catch (e) {
            return `# YAML Generate Error: ${e.message}\nproxies: []\nproxy-groups: []\nrules: []`;
        }
    }
}
