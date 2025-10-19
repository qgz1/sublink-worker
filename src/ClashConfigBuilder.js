import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        super(inputString, baseConfig || CLASH_CONFIG, lang, userAgent);
        this.selectedRules = selectedRules;
        this.customRules = customRules || [];
    }

    getProxies() {
        return this.config.proxies || [];
    }

    // 转换代理为 Clash 支持格式
    convertProxy(proxy) {
        const base = {
            name: proxy.tag,
            type: proxy.type,
            server: proxy.server,
            port: proxy.server_port,
        };

        switch (proxy.type) {
            case 'shadowsocks':
                return { ...base, cipher: proxy.method, password: proxy.password };
            case 'vmess':
            case 'vless':
                return {
                    ...base,
                    uuid: proxy.uuid,
                    alterId: proxy.alter_id || 0,
                    cipher: proxy.security || 'auto',
                    tls: proxy.tls?.enabled || false,
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? { path: proxy.transport.path, headers: proxy.transport.headers } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? { 'grpc-service-name': proxy.transport.service_name } : undefined,
                };
            case 'trojan':
                return {
                    ...base,
                    password: proxy.password,
                    cipher: proxy.security || 'auto',
                    tls: proxy.tls?.enabled || false,
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? { path: proxy.transport.path, headers: proxy.transport.headers } : undefined,
                };
            default:
                return proxy;
        }
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        const similar = this.config.proxies.filter(p => p.name === proxy.name);
        if (similar.length > 0) proxy.name += ` ${similar.length + 1}`;
        this.config.proxies.push(proxy);
    }

    addAutoSelectGroup(proxyList) {
        const autoName = t('outboundNames.Auto Select');
        if (!this.config['proxy-groups']) this.config['proxy-groups'] = [];
        if (this.config['proxy-groups'].some(g => g.name === autoName)) return;

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
        const nodeName = t('outboundNames.Node Select');
        const autoName = t('outboundNames.Auto Select');

        if (!this.config['proxy-groups']) this.config['proxy-groups'] = [];
        if (this.config['proxy-groups'].some(g => g.name === nodeName)) return;

        const merged = ['DIRECT', 'REJECT', autoName, ...proxyList];
        this.config['proxy-groups'].unshift({
            type: 'select',
            name: nodeName,
            proxies: DeepCopy(merged)
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        const autoName = t('outboundNames.Auto Select');
        const nodeName = t('outboundNames.Node Select');

        if (!this.config['proxy-groups']) this.config['proxy-groups'] = [];

        outbounds.forEach(outbound => {
            const name = t(`outboundNames.${outbound}`);
            let groupProxies;

            if (/国内服务|🔒 国内服务/.test(name)) {
                groupProxies = ['DIRECT'];
            } else if (/fallback|漏网之鱼/i.test(outbound)) {
                groupProxies = [nodeName, autoName, 'DIRECT', ...proxyList];
            } else {
                groupProxies = [nodeName, autoName, 'DIRECT', 'REJECT', ...proxyList];
            }

            this.config['proxy-groups'].push({
                type: 'select',
                name,
                proxies: DeepCopy(groupProxies)
            });
        });
    }

    addCustomRuleGroups(proxyList) {
        const nodeName = t('outboundNames.Node Select');
        this.customRules.forEach(rule => {
            this.config['proxy-groups'].push({
                type: 'select',
                name: t(`outboundNames.${rule.name}`),
                proxies: [nodeName, ...proxyList]
            });
        });
    }

    addFallBackGroup(proxyList) {
        const name = t('outboundNames.Fall Back');
        const nodeName = t('outboundNames.Node Select');
        this.config['proxy-groups'].push({
            name,
            type: 'fallback',
            proxies: [nodeName, ...proxyList]
        });
    }

    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    formatConfig() {
        const rules = this.generateRules();
        const results = [];

        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

        rules.forEach(rule => {
            rule.domain_suffix?.forEach(s => results.push(`DOMAIN-SUFFIX,${s},${t('outboundNames.' + rule.outbound)}`));
            rule.domain_keyword?.forEach(k => results.push(`DOMAIN-KEYWORD,${k},${t('outboundNames.' + rule.outbound)}`));
            rule.site_rules?.forEach(s => results.push(`RULE-SET,${s},${t('outboundNames.' + rule.outbound)}`));
            rule.ip_rules?.forEach(ip => results.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`));
            rule.ip_cidr?.forEach(cidr => results.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`));
        });

        results.push(`MATCH,${t('outboundNames.Fall Back')}`);
        this.config.rules = results;

        return yaml.dump(this.config);
    }
}
