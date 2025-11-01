import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

/**
 * ClashConfigBuilder
 * - DeepCopy base config to avoid mutating global constants
 * - Support runtime addRule/addRawRule with proper merging into rule providers
 * - Stable compare proxies to avoid duplicate insertion based on sorted keys stringify
 * - Sanitize proxy names (remove commas/newlines) to keep generated rules safe
 * - Merge rule traversal to reduce multiple filters
 */
export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        if (!baseConfig) baseConfig = CLASH_CONFIG;
        // Deep copy base config before handing to parent to avoid editing global template
        super(inputString, DeepCopy(baseConfig), lang, userAgent);

        this.selectedRules = selectedRules;
        this.customRules = customRules;

        // runtime additions
        this.runtimeCustomRules = [];
        this.extraRuleStrings = { before: [], after: [] };

        // ensure fields exist
        this.config.proxies = this.config.proxies || [];
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config.rules = this.config.rules || [];
        this.config['rule-providers'] = this.config['rule-providers'] || {};
    }

    addRule(rule) {
        if (!rule || typeof rule !== 'object') return false;
        if (!rule.name || !rule.outbound) return false;
        rule.outbound = String(rule.outbound);
        this.runtimeCustomRules.push(rule);
        return true;
    }

    addRawRule(ruleString, position = 'before') {
        if (typeof ruleString !== 'string' || !ruleString.trim()) return false;
        if (!['before', 'after'].includes(position)) position = 'before';
        this.extraRuleStrings[position].push(ruleString.trim());
        return true;
    }

    getProxies() {
        return this.config.proxies || [];
    }

    getProxyName(proxy) {
        return proxy.name;
    }

    // sanitize proxy names early when converting from source format
    convertProxy(proxy) {
        const sanitize = (name) => this.sanitizeProxyName(name ?? proxy.tag ?? proxy.name);

        switch (proxy.type) {
            case 'shadowsocks':
                return {
                    name: sanitize(proxy.tag),
                    type: 'ss',
                    server: proxy.server,
                    port: proxy.server_port,
                    cipher: proxy.method,
                    password: proxy.password
                };
            case 'vmess':
                return {
                    name: sanitize(proxy.tag),
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
                    name: sanitize(proxy.tag),
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
                    name: sanitize(proxy.tag),
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
                    // default false to avoid insecure bypass by default
                    'skip-cert-verify': proxy.tls?.insecure ?? false
                };
            case 'trojan':
                return {
                    name: sanitize(proxy.tag),
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
                    name: sanitize(proxy.tag),
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
                // ensure name sanitized for unknown types too
                return { ...proxy, name: sanitize(proxy.name ?? proxy.tag) };
        }
    }

    // Deterministic stringify using JSON.stringify with sorted object keys
    stableStringify(obj) {
        const seen = new WeakSet();
        const replacer = (key, value) => {
            if (value && typeof value === 'object') {
                if (seen.has(value)) {
                    // circular reference -> stringify placeholder
                    return '[Circular]';
                }
                seen.add(value);
                if (!Array.isArray(value)) {
                    const sorted = {};
                    Object.keys(value).sort().forEach(k => { sorted[k] = value[k]; });
                    return sorted;
                }
            }
            return value;
        };
        try {
            return JSON.stringify(obj, replacer);
        } catch (e) {
            // fallback: best-effort string
            return String(obj);
        }
    }

    sanitizeProxyName(name) {
        if (typeof name !== 'string') return name;
        return name.replace(/[,\\\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // escape regex special chars for exact base name matching
    escapeRegex(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];

        // sanitize early
        proxy.name = this.sanitizeProxyName(proxy.name);

        const baseName = proxy.name;
        const baseRegex = new RegExp(`^${this.escapeRegex(baseName)}(?: \\d+)?$`);

        // find proxies with same base name (including numbered variants)
        const sameNameProxies = this.config.proxies.filter(p => baseRegex.test(p.name));

        // determine if identical (compare all other properties except name)
        const { name: _, ...restNew } = proxy;
        const isIdentical = sameNameProxies.some(p => {
            const { name: __, ...restExisting } = p;
            return this.stableStringify(restNew) === this.stableStringify(restExisting);
        });

        if (isIdentical) return;

        if (sameNameProxies.length > 0) {
            // choose next available index (count existing matching base)
            const indices = sameNameProxies.map(p => {
                const m = p.name.match(/ (\d+)$/);
                return m ? Number(m[1]) : 1;
            });
            const nextIdx = Math.max(...indices) + 1;
            proxy.name = `${baseName} ${nextIdx}`;
        }

        this.config.proxies.push(proxy);
    }

    addRegionGroups(proxyList) {
        const regions = {
            '🇭🇰 香港自动': /香港|HK|Hong/i,
            '🇸🇬 新加坡自动': /新加坡|SG|Singapore/i,
            '🇯🇵 日本自动': /日本|JP|Tokyo|Osaka/i,
            '🇺🇸 美国自动': /美国|US|United/i,
            '🇹🇼 台湾自动': /台湾|TW|Taiwan/i,
            '🇬🇧 英国自动': /英国|UK|London/i
        };

        const proxies = Array.isArray(proxyList) ? proxyList : [];

        for (const [regionName, regex] of Object.entries(regions)) {
            const matched = proxies.filter(p => typeof p === 'string' && regex.test(p));
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

    addAutoSelectGroup(proxyList) {
        const autoName = t('outboundNames.Auto Select');
        if (this.config['proxy-groups']?.some(g => g.name === autoName)) return;

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
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

    addNodeSelectGroup(proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');

        const merged = new Set([autoSelect, 'DIRECT', 'REJECT', ...proxyList]);
        if (this.config['proxy-groups']?.some(g => g.name === nodeSelect)) return;

        this.config['proxy-groups'].unshift({
            type: 'select',
            name: nodeSelect,
            proxies: DeepCopy([...merged])
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');

        outbounds.forEach(outbound => {
            const outboundName = t(`outboundNames.${outbound}`);
            if (outboundName === nodeSelect) return;

            let optimized;
            if (outboundName === t('outboundNames.国内服务') || outboundName === '🔒 国内服务') {
                optimized = ['DIRECT'];
            } else {
                optimized = new Set([nodeSelect, autoSelect, 'DIRECT', 'REJECT', ...proxyList]);

                if (/media|stream|video|youtube|netflix/i.test(outbound)) {
                    optimized = new Set(['🇭🇰 香港自动', '🇸🇬 新加坡自动', ...optimized]);
                } else if (/openai|chatgpt|ai/i.test(outbound)) {
                    optimized = new Set(['🇸🇬 新加坡自动', '🇺🇸 美国自动', ...optimized]);
                }
            }

            this.config['proxy-groups'].push({
                type: 'select',
                name: outboundName,
                proxies: DeepCopy([...optimized])
            });
        });
    }

    addCustomRuleGroups(proxyList) {
        const nodeSelectName = t('outboundNames.Node Select');

        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                if (!rule || !rule.name) return;
                this.config['proxy-groups'].push({
                    type: 'select',
                    name: t(`outboundNames.${rule.name}`),
                    proxies: [nodeSelectName, ...proxyList]
                });
            });
        }
        if (Array.isArray(this.runtimeCustomRules)) {
            this.runtimeCustomRules.forEach(rule => {
                if (!rule || !rule.name) return;
                this.config['proxy-groups'].push({
                    type: 'select',
                    name: t(`outboundNames.${rule.name}`),
                    proxies: [nodeSelectName, ...proxyList]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push({
            type: 'select',
            name: t('outboundNames.Fall Back'),
            proxies: [t('outboundNames.Node Select'), ...proxyList]
        });
    }

    generateRules() {
        const mergedCustomRules = Array.isArray(this.customRules) ? [...this.customRules] : [];
        if (Array.isArray(this.runtimeCustomRules) && this.runtimeCustomRules.length > 0) {
            mergedCustomRules.push(...this.runtimeCustomRules);
        }
        return generateRules(this.selectedRules, mergedCustomRules);
    }

    formatConfig() {
        // Build merged custom rules once for rule providers and rules generation
        const mergedCustomRules = Array.isArray(this.customRules) ? [...this.customRules] : [];
        if (Array.isArray(this.runtimeCustomRules) && this.runtimeCustomRules.length > 0) {
            mergedCustomRules.push(...this.runtimeCustomRules);
        }

        const rules = this.generateRules();
        const ruleResults = [];

        // Ensure rule-providers include runtime custom rules (merge into existing)
        const { site_rule_providers = {}, ip_rule_providers = {} } = generateClashRuleSets(this.selectedRules, mergedCustomRules);
        this.config['rule-providers'] = {
            ...DeepCopy(this.config['rule-providers'] || {}),
            ...DeepCopy(site_rule_providers),
            ...DeepCopy(ip_rule_providers)
        };

        // Single pass through rules to build rule lines (defensive array checks)
        if (Array.isArray(rules)) {
            rules.forEach(rule => {
                const outboundLabel = rule.outbound ? t('outboundNames.' + rule.outbound) : t('outboundNames.Fall Back');

                if (Array.isArray(rule.domain_suffix)) {
                    rule.domain_suffix.forEach(s => ruleResults.push(`DOMAIN-SUFFIX,${s},${outboundLabel}`));
                }
                if (Array.isArray(rule.domain_keyword)) {
                    rule.domain_keyword.forEach(k => ruleResults.push(`DOMAIN-KEYWORD,${k},${outboundLabel}`));
                }
                if (Array.isArray(rule.site_rules)) {
                    rule.site_rules.forEach(s => ruleResults.push(`RULE-SET,${s},${outboundLabel}`));
                }
                if (Array.isArray(rule.ip_rules)) {
                    rule.ip_rules.forEach(ip => ruleResults.push(`RULE-SET,${ip},${outboundLabel},no-resolve`));
                }
                if (Array.isArray(rule.ip_cidr)) {
                    rule.ip_cidr.forEach(cidr => ruleResults.push(`IP-CIDR,${cidr},${outboundLabel},no-resolve`));
                }
            });
        }

        const before = Array.isArray(this.extraRuleStrings.before) ? this.extraRuleStrings.before : [];
        const after = Array.isArray(this.extraRuleStrings.after) ? this.extraRuleStrings.after : [];
        const mergedRules = [...before, ...ruleResults];

        mergedRules.push(`MATCH,${t('outboundNames.Fall Back')}`);

        // put 'after' rules just before final MATCH
        const finalRules = mergedRules.length > 0
            ? [...mergedRules.slice(0, -1), ...after, mergedRules[mergedRules.length - 1]]
            : [...after, `MATCH,${t('outboundNames.Fall Back')}`];

        this.config.rules = finalRules;

        return yaml.dump(this.config, { noRefs: true });
    }
}
