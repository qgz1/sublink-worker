import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
    /**
     * inputData 可以是：
     * 1. 已下载的 YAML 字符串
     * 2. JSON 字符串或对象
     */
    constructor(inputData, selectedRules, customRules, baseConfig, lang, userAgent) {
        let configObj;

        // 尝试解析 YAML
        if (typeof inputData === 'string') {
            try {
                configObj = yaml.load(inputData);
            } catch {
                try {
                    configObj = JSON.parse(inputData);
                } catch {
                    configObj = baseConfig || CLASH_CONFIG;
                }
            }
        } else if (typeof inputData === 'object') {
            configObj = inputData;
        } else {
            configObj = baseConfig || CLASH_CONFIG;
        }

        super(inputData, configObj, lang, userAgent);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
    }

    getProxies() {
        return this.config.proxies || [];
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
        if (similarProxies.length > 0) proxy.name += ` ${similarProxies.length + 1}`;

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

        outbounds.forEach(outbound => {
            const outboundName = t(`outboundNames.${outbound}`);
            if (outboundName !== nodeSelect) {
                let optimized = ['DIRECT', 'REJECT', nodeSelect, autoSelect, ...proxyList];
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

        rules.forEach(rule => {
            rule.domain_suffix?.forEach(s => ruleResults.push(`DOMAIN-SUFFIX,${s},${t('outboundNames.' + rule.outbound)}`));
            rule.domain_keyword?.forEach(k => ruleResults.push(`DOMAIN-KEYWORD,${k},${t('outboundNames.' + rule.outbound)}`));
            rule.site_rules?.forEach(s => ruleResults.push(`RULE-SET,${s},${t('outboundNames.' + rule.outbound)}`));
            rule.ip_rules?.forEach(ip => ruleResults.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`));
            rule.ip_cidr?.forEach(cidr => ruleResults.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`));
        });

        ruleResults.push(`MATCH,${t('outboundNames.Fall Back')}`);
        this.config.rules = ruleResults;

        return yaml.dump(this.config);
    }
}
