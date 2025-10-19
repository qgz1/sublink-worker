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
        // 保留原 convertProxy 逻辑
        return proxy; // 简化版，如果需要保留详细类型转换可直接复用原函数
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

        const cleanList = proxyList.filter(n => !n.includes('私有网络'));
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push({
            name: autoName,
            type: 'url-test',
            proxies: DeepCopy(cleanList),
            url: 'https://www.gstatic.com/generate_204',
            interval: 300,
            lazy: false
        });
    }

    addNodeSelectGroup(proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');

        const cleanList = proxyList.filter(n => !n.includes('私有网络'));
        const merged = new Set([autoSelect, 'DIRECT', 'REJECT', ...cleanList]);
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

        const cleanList = proxyList.filter(n => !n.includes('私有网络'));

        outbounds.forEach(outbound => {
            const outboundName = t(`outboundNames.${outbound}`);
            if (outboundName.includes('私有网络')) return; // 过滤私有网络

            let optimized;
            if (outboundName === t('outboundNames.国内服务') || outboundName === '🔒 国内服务') {
                optimized = ['DIRECT'];
            } else {
                optimized = new Set([nodeSelect, autoSelect, 'DIRECT', 'REJECT', ...cleanList]);
                if (/media|stream|video|youtube|netflix/i.test(outbound)) {
                    optimized = new Set(['🇭🇰 香港自动', '🇸🇬 新加坡自动', ...optimized]);
                } else if (/openai|chatgpt|ai/i.test(outbound)) {
                    optimized = new Set(['🇸🇬 新加坡自动', '🇺🇸 美国自动', ...optimized]);
                }
            }

            this.config['proxy-groups'].push({
                type: "select",
                name: outboundName,
                proxies: DeepCopy([...optimized])
            });
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            const cleanList = proxyList.filter(n => !n.includes('私有网络'));
            this.customRules.forEach(rule => {
                this.config['proxy-groups'].push({
                    type: "select",
                    name: t(`outboundNames.${rule.name}`),
                    proxies: [t('outboundNames.Node Select'), ...cleanList]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        const cleanList = proxyList.filter(n => !n.includes('私有网络'));
        this.config['proxy-groups'].push({
            type: "select",
            name: t('outboundNames.Fall Back'),
            proxies: [t('outboundNames.Node Select'), ...cleanList]
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
