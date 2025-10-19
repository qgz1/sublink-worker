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
            case 'vless':
            case 'trojan':
            case 'hysteria2':
            case 'tuic':
                return { ...proxy }; // 复杂节点保留原结构，可根据需要自定义
            default:
                return proxy;
        }
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

    // 过滤节点，去掉私有网络及不必要节点
    cleanProxyList(proxyList) {
        return proxyList.filter(n =>
            this.config.proxies.some(p => p.name === n) &&
            !n.includes('私有网络') &&
            !n.includes('剩余') &&
            !n.includes('套餐') &&
            !n.includes('倍率') &&
            !n.includes('官网')
        );
    }

    addAutoSelectGroup(proxyList) {
        const autoName = t('outboundNames.Auto Select');
        if (this.config['proxy-groups']?.some(g => g.name === autoName)) return;
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push({
            name: autoName,
            type: 'url-test',
            proxies: DeepCopy(this.cleanProxyList(proxyList)),
            url: 'https://www.gstatic.com/generate_204',
            interval: 300,
            lazy: false
        });
    }

    addNodeSelectGroup(proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');
        const merged = new Set([autoSelect, 'DIRECT', 'REJECT', ...this.cleanProxyList(proxyList)]);
        if (this.config['proxy-groups']?.some(g => g.name === nodeSelect)) return;
        this.config['proxy-groups'].unshift({
            type: "select",
            name: nodeSelect,
            proxies: DeepCopy([...merged])
        });
    }

    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push({
            type: "select",
            name: t('outboundNames.Fall Back'),
            proxies: [t('outboundNames.Node Select'), ...this.cleanProxyList(proxyList)]
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');
        const cleaned = this.cleanProxyList(proxyList);

        outbounds.forEach(outbound => {
            const outboundName = t(`outboundNames.${outbound}`);
            if (outboundName === nodeSelect) return;

            let optimized;
            if (outboundName === t('outboundNames.国内服务') || outboundName === '🔒 国内服务') {
                optimized = ['DIRECT'];
            } else if (/fallback|漏网之鱼/i.test(outbound)) {
                optimized = [nodeSelect, autoSelect, 'DIRECT', ...cleaned];
            } else {
                optimized = [nodeSelect, autoSelect, 'DIRECT', 'REJECT', ...cleaned];
            }

            this.config['proxy-groups'].push({
                type: "select",
                name: outboundName,
                proxies: DeepCopy(optimized)
            });
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config['proxy-groups'].push({
                    type: "select",
                    name: t(`outboundNames.${rule.name}`),
                    proxies: [t('outboundNames.Node Select'), ...this.cleanProxyList(proxyList)]
                });
            });
        }
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
