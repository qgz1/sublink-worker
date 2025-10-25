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

    // --- 工具函数：去掉空字段 / 不兼容字段 ---
    cleanObject(obj) {
        if (obj && typeof obj === 'object') {
            for (const key in obj) {
                const value = obj[key];
                // 删除空对象、undefined、null
                if (value === undefined || value === null) {
                    delete obj[key];
                    continue;
                }
                if (typeof value === 'object') {
                    this.cleanObject(value);
                    if (Object.keys(value).length === 0) delete obj[key];
                }
            }
        }
        return obj;
    }

    // --- 节点转换 ---
    convertProxy(proxy) {
        let p;
        switch (proxy.type) {
            case 'shadowsocks':
                p = {
                    name: proxy.tag,
                    type: 'ss',
                    server: proxy.server,
                    port: proxy.server_port,
                    cipher: proxy.method,
                    password: proxy.password
                };
                break;
            case 'vmess':
            case 'vless':
            case 'trojan':
            case 'tuic':
            case 'hysteria2':
                p = DeepCopy(proxy);
                p.name = proxy.tag;
                p.port = proxy.server_port;
                delete p.tag;
                delete p.server_port;
                break;
            default:
                p = proxy;
        }
        return this.cleanObject(p);
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        const similar = this.config.proxies.filter(p => p.name.includes(proxy.name));

        const isIdentical = similar.some(p => {
            const { name: _, ...rest1 } = proxy;
            const { name: __, ...rest2 } = p;
            return JSON.stringify(rest1) === JSON.stringify(rest2);
        });
        if (isIdentical) return;

        if (similar.length > 0) proxy.name = `${proxy.name} ${similar.length + 1}`;
        this.config.proxies.push(proxy);
    }

    // --- 新增统一代理组构建函数 ---
    addProxyGroups(proxyList) {
        this.config['proxy-groups'] = [];

        const nodeSelect = t('outboundNames.Node Select');
        const autoSelect = t('outboundNames.Auto Select');
        const fallBack = t('outboundNames.Fall Back');

        // ① 手动选择
        this.config['proxy-groups'].push({
            name: nodeSelect,
            type: 'select',
            proxies: ['DIRECT', 'REJECT', autoSelect, ...proxyList]
        });

        // ② 自动测速
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

    // --- 生成规则 ---
    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    // --- 最终输出 ---
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

        // ✅ 安全 YAML 输出
        return yaml.dump(this.cleanObject(this.config), { skipInvalid: true, forceQuotes: true });
    }
}
