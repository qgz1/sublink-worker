import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

function sanitizeName(name) {
    if (!name) return 'Unnamed';
    // 移除不可打印字符和控制符，包括 emoji 控制字符
    return String(name).replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        super(inputString, baseConfig || CLASH_CONFIG, lang, userAgent);
        this.selectedRules = selectedRules || [];
        this.customRules = customRules || [];
    }

    safe(value, fallback = '') {
        return value === undefined || value === null ? fallback : value;
    }

    clean(obj) {
        if (Array.isArray(obj)) return obj.map(o => this.clean(o)).filter(Boolean);
        if (obj && typeof obj === 'object') {
            const result = {};
            for (const [k, v] of Object.entries(obj)) {
                const cleaned = this.clean(v);
                if (cleaned !== undefined && cleaned !== null) result[k] = cleaned;
            }
            return result;
        }
        if (typeof obj === 'number' && !isFinite(obj)) return undefined;
        return obj;
    }

    getProxies() {
        return Array.isArray(this.config.proxies) ? this.config.proxies : [];
    }

    getProxyName(proxy) {
        return sanitizeName(this.safe(proxy?.name, 'Unnamed'));
    }

    convertProxy(proxy) {
        try {
            const base = { name: sanitizeName(proxy.tag || 'Unnamed'), type: proxy.type, server: proxy.server, port: proxy.server_port };
            switch (proxy.type) {
                case 'shadowsocks':
                    return { ...base, cipher: proxy.method, password: proxy.password };
                case 'vmess':
                    return { ...base, uuid: proxy.uuid, alterId: proxy.alter_id, cipher: proxy.security, tls: !!proxy.tls?.enabled };
                default:
                    return base;
            }
        } catch {
            return { name: 'InvalidNode', type: 'ss', server: '0.0.0.0', port: 1, cipher: 'aes-128-gcm', password: 'error' };
        }
    }

    addProxyToConfig(proxy) {
        try {
            this.config.proxies = this.config.proxies || [];
            if (!this.config.proxies.find(p => p.name === proxy.name)) {
                this.config.proxies.push(proxy);
            }
        } catch {}
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
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        for (const [name, regex] of Object.entries(regions)) {
            const matched = proxyList.filter(p => regex.test(p));
            if (matched.length > 0) {
                this.config['proxy-groups'].push({ name: sanitizeName(name), type: 'url-test', proxies: matched, url: 'https://cp.cloudflare.com/generate_204', interval: 600, tolerance: 50, lazy: true });
            }
        }
    }

    addAutoSelectGroup(proxyList) {
        const name = sanitizeName(t('outboundNames.Auto Select') || '自动选择');
        if (!this.config['proxy-groups'].some(g => g.name === name)) {
            this.config['proxy-groups'].push({ name, type: 'url-test', proxies: DeepCopy(proxyList), url: 'https://cp.cloudflare.com/generate_204', interval: 600, tolerance: 50, lazy: true });
        }
    }

    addNodeSelectGroup(proxyList) {
        const nodeName = sanitizeName(t('outboundNames.Node Select') || '节点选择');
        const autoName = sanitizeName(t('outboundNames.Auto Select') || '自动选择');
        const merged = Array.from(new Set([autoName, 'DIRECT', 'REJECT', ...proxyList]));
        this.config['proxy-groups'].unshift({ type: 'select', name: nodeName, proxies: DeepCopy(merged) });
    }

    generateRules() {
        const result = [];
        const rules = [...(this.selectedRules || []), ...(this.customRules || [])].filter(Boolean);
        for (const rule of rules) {
            const outbound = sanitizeName(t('outboundNames.' + rule.outbound) || '节点选择');
            rule.domain_suffix?.forEach(s => result.push(`DOMAIN-SUFFIX,${s},${outbound}`));
            rule.domain_keyword?.forEach(k => result.push(`DOMAIN-KEYWORD,${k},${outbound}`));
            rule.site_rules?.forEach(s => result.push(`RULE-SET,${s},${outbound}`));
            rule.ip_rules?.forEach(ip => result.push(`RULE-SET,${ip},${outbound},no-resolve`));
            rule.ip_cidr?.forEach(c => result.push(`IP-CIDR,${c},${outbound},no-resolve`));
        }
        result.push(`GEOIP,CN,DIRECT`);
        result.push(`MATCH,${sanitizeName(t('outboundNames.Node Select') || '节点选择')}`);
        return Array.from(new Set(result.filter(Boolean)));
    }

    formatConfig() {
        try {
            const rules = this.generateRules();
            const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
            this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

            const proxyList = this.getProxies().map(p => this.getProxyName(p));
            this.config['proxy-groups'] = [];
            this.addRegionGroups(proxyList);
            this.addAutoSelectGroup(proxyList);
            this.addNodeSelectGroup(proxyList);
            this.config.rules = rules;
            this.config = this.clean(this.config);

            return yaml.dump(this.config, { skipInvalid: true, sortKeys: false, lineWidth: -1 });
        } catch (err) {
            return `# Fatal Error: ${err.message}\nproxies: []\nproxy-groups: []\nrules: []`;
        }
    }
}
