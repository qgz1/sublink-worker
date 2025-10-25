import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        super(inputString, baseConfig || CLASH_CONFIG, lang, userAgent);
        this.selectedRules = selectedRules || [];
        this.customRules = customRules || [];
    }

    // ---------- 工具函数 ----------
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
        return this.safe(proxy?.name, 'Unnamed');
    }

    // ---------- 节点类型转换 ----------
    convertProxy(proxy) {
        try {
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
                        tls: !!proxy.tls?.enabled,
                        servername: proxy.tls?.server_name || '',
                        'skip-cert-verify': !!proxy.tls?.insecure,
                        network: proxy.transport?.type || 'tcp',
                        'ws-opts': proxy.transport?.type === 'ws'
                            ? { path: proxy.transport.path, headers: proxy.transport.headers }
                            : undefined
                    };
                case 'vless':
                case 'trojan':
                case 'tuic':
                case 'hysteria2':
                    return {
                        name: proxy.tag,
                        type: proxy.type,
                        server: proxy.server,
                        port: proxy.server_port,
                        uuid: proxy.uuid,
                        password: proxy.password,
                        cipher: proxy.security,
                        tls: !!proxy.tls?.enabled,
                        sni: proxy.tls?.server_name || '',
                        'skip-cert-verify': !!proxy.tls?.insecure,
                        network: proxy.transport?.type || 'tcp'
                    };
                default:
                    return proxy;
            }
        } catch (e) {
            return { name: 'InvalidNode', type: 'ss', server: '0.0.0.0', port: 1, cipher: 'aes-128-gcm', password: 'error' };
        }
    }

    addProxyToConfig(proxy) {
        try {
            this.config.proxies = this.config.proxies || [];
            const exist = this.config.proxies.find(p => p.name === proxy.name);
            if (!exist) this.config.proxies.push(proxy);
        } catch (e) {
            console.warn('addProxyToConfig error:', e);
        }
    }

    // ---------- 自动分地区测速 ----------
    addRegionGroups(proxyList) {
        const regionMap = {
            '🇭🇰 香港自动': /香港|HK|Hong/i,
            '🇸🇬 新加坡自动': /新加坡|SG|Singapore/i,
            '🇯🇵 日本自动': /日本|JP|Tokyo|Osaka/i,
            '🇺🇸 美国自动': /美国|US|United/i,
            '🇹🇼 台湾自动': /台湾|TW|Taiwan/i,
            '🇬🇧 英国自动': /英国|UK|London/i
        };

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];

        for (const [name, regex] of Object.entries(regionMap)) {
            const matched = proxyList.filter(p => regex.test(p));
            if (matched.length === 0) continue;

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
    }

    // ---------- 自动选择组 ----------
    addAutoSelectGroup(proxyList) {
        const name = t('outboundNames.Auto Select') || '自动选择';
        if (this.config['proxy-groups'].some(g => g.name === name)) return;
        this.config['proxy-groups'].push({
            name,
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://cp.cloudflare.com/generate_204',
            interval: 600,
            tolerance: 50,
            lazy: true
        });
    }

    // ---------- 节点选择组 ----------
    addNodeSelectGroup(proxyList) {
        const nodeName = t('outboundNames.Node Select') || '节点选择';
        const autoName = t('outboundNames.Auto Select') || '自动选择';
        const merged = new Set([autoName, 'DIRECT', 'REJECT', ...proxyList]);

        this.config['proxy-groups'].unshift({
            type: 'select',
            name: nodeName,
            proxies: DeepCopy([...merged])
        });
    }

    // ---------- 规则生成 ----------
    generateRules() {
        const result = [];
        try {
            const rules = [...(this.selectedRules || []), ...(this.customRules || [])].filter(Boolean);

            for (const rule of rules) {
                const outbound = t('outboundNames.' + rule.outbound) || '节点选择';
                rule.domain_suffix?.forEach(s => result.push(`DOMAIN-SUFFIX,${s},${outbound}`));
                rule.domain_keyword?.forEach(k => result.push(`DOMAIN-KEYWORD,${k},${outbound}`));
                rule.domain?.forEach(d => result.push(`DOMAIN,${d},${outbound}`));
                rule.site_rules?.forEach(s => result.push(`RULE-SET,${s},${outbound}`));
                rule.ip_rules?.forEach(ip => result.push(`RULE-SET,${ip},${outbound},no-resolve`));
                rule.ip_cidr?.forEach(c => result.push(`IP-CIDR,${c},${outbound},no-resolve`));
            }

            result.push(`GEOIP,CN,DIRECT`);
            result.push(`MATCH,${t('outboundNames.Node Select') || '节点选择'}`);
        } catch (e) {
            console.warn('generateRules error:', e);
        }
        return Array.from(new Set(result.filter(Boolean)));
    }

    // ---------- 输出配置 ----------
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

            this.config.rules = [...rules];

            // 清理非法数据
            this.config = this.clean(this.config);

            // 强制生成安全 YAML
            let yamlText = '';
            try {
                yamlText = yaml.dump(this.config, { skipInvalid: true, sortKeys: false, lineWidth: -1 });
            } catch (err) {
                yamlText = `# YAML Encode Error: ${err.message}\nproxies: []\nproxy-groups: []\nrules: []`;
            }

            if (!yamlText || yamlText.trim().length < 10) {
                yamlText = `# Empty Output Fallback\nproxies: []\nproxy-groups: []\nrules: []`;
            }

            return yamlText;
        } catch (err) {
            return `# Fatal Error: ${err.message}\nproxies: []\nproxy-groups: []\nrules: []`;
        }
    }
}
