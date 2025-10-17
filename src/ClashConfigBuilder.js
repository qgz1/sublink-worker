import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig = CLASH_CONFIG, lang, userAgent) {
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

    static proxyTypeMap = {
        // ... 你的 proxyTypeMap 内容...
    };

    convertProxy(proxy) {
        const converter = ClashConfigBuilder.proxyTypeMap[proxy.type];
        if (converter) {
            return converter(proxy);
        }
        return proxy;
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        const similarProxies = this.config.proxies.filter(p => p.name.includes(proxy.name));
        const isIdentical = similarProxies.some(p => {
            const { name: _, ...restProxy } = proxy;
            const { name: __, ...restP } = p;
            return JSON.stringify(restProxy) === JSON.stringify(restP);
        });
        if (isIdentical) return;

        if (similarProxies.length > 0) {
            proxy.name = `${proxy.name} ${similarProxies.length + 1}`;
        }
        this.config.proxies.push(proxy);
    }

    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push({
            name: t('outboundNames.Auto Select'),
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://www.gstatic.com/generate_204',
            interval: 300,
            lazy: false
        });
    }

    // 关键：在此方法中自动加入“直连”
    addNodeSelectGroup(proxyList) {
        // 自动加入“直连”
        proxyList.unshift({ name: '直连', type: 'direct' });
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].unshift({
            type: 'select',
            name: t('outboundNames.Node Select'),
            proxies: proxyList
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound !== t('outboundNames.Node Select')) {
                this.config['proxy-groups'].push({
                    type: 'select',
                    name: t(`outboundNames.${outbound}`),
                    proxies: [t('outboundNames.Node Select'), ...proxyList]
                });
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config['proxy-groups'].push({
                    type: 'select',
                    name: t(`outboundNames.${rule.name}`),
                    proxies: [t('outboundNames.Node Select'), ...proxyList]
                });
            });
        }
    }

    // 备用组
    addFallBackGroup(proxyList) {
        // 自动加入“直连”
        proxyList.unshift({ name: '直连', type: 'direct' });
        this.config['proxy-groups'].push({
            type: 'select',
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
        this.config['rule-providers'] = {
            ...site_rule_providers,
            ...ip_rule_providers
        };

        // 处理规则
        rules.forEach(rule => {
            if (rule.domain_suffix) {
                rule.domain_suffix.forEach(suffix => {
                    ruleResults.push(`DOMAIN-SUFFIX,${suffix},${t('outboundNames.'+ rule.outbound)}`);
                });
            }
            if (rule.domain_keyword) {
                rule.domain_keyword.forEach(keyword => {
                    ruleResults.push(`DOMAIN-KEYWORD,${keyword},${t('outboundNames.'+ rule.outbound)}`);
                });
            }
            if (rule.site_rules && rule.site_rules.length > 0) {
                rule.site_rules.forEach(site => {
                    ruleResults.push(`RULE-SET,${site},${t('outboundNames.'+ rule.outbound)}`);
                });
            }
            if (rule.ip_rules && rule.ip_rules.length > 0) {
                rule.ip_rules.forEach(ip => {
                    ruleResults.push(`RULE-SET,${ip},${t('outboundNames.'+ rule.outbound)},no-resolve`);
                });
            }
            if (rule.ip_cidr) {
                rule.ip_cidr.forEach(cidr => {
                    ruleResults.push(`IP-CIDR,${cidr},${t('outboundNames.'+ rule.outbound)},no-resolve`);
                });
            }
        });

        this.config.rules = [...ruleResults, `MATCH,${t('outboundNames.Fall Back')}`];

        return yaml.dump(this.config);
    }
}
