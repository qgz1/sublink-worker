import yaml from 'js-yaml';
import { CLASimport yaml from 'js-yaml';
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

    // 使用映射对象简化convertProxy
    static proxyTypeMap = {
        'shadowsocks': proxy => ({
            name: proxy.tag,
            type: 'ss',
            server: proxy.server,
            port: proxy.server_port,
            cipher: proxy.method,
            password: proxy.password
        }),
        'vmess': proxy => ({
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
            'ws-opts': proxy.transport?.type === 'ws' ? {
                path: proxy.transport?.path,
                headers: proxy.transport?.headers
            } : undefined
        }),
        'vless': proxy => ({
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
            'ws-opts': proxy.transport?.type === 'ws' ? {
                path: proxy.transport?.path,
                headers: proxy.transport?.headers
            } : undefined,
            'reality-opts': proxy.tls?.reality?.enabled ? {
                'public-key': proxy.tls.reality.public_key,
                'short-id': proxy.tls.reality.short_id,
            } : undefined,
            'grpc-opts': proxy.transport?.type === 'grpc' ? {
                'grpc-service-name': proxy.transport?.service_name,
            } : undefined,
            tfo: proxy.tcp_fast_open,
            'skip-cert-verify': proxy.tls?.insecure,
            'flow': proxy.flow ?? undefined,
        }),
        'hysteria2': proxy => ({
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
            'skip-cert-verify': proxy.tls?.insecure || true,
        }),
        'trojan': proxy => ({
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
            'ws-opts': proxy.transport?.type === 'ws' ? {
                path: proxy.transport?.path,
                headers: proxy.transport?.headers
            } : undefined,
            'reality-opts': proxy.tls?.reality?.enabled ? {
                'public-key': proxy.tls.reality.public_key,
                'short-id': proxy.tls.reality.short_id,
            } : undefined,
            'grpc-opts': proxy.transport?.type === 'grpc' ? {
                'grpc-service-name': proxy.transport?.service_name,
            } : undefined,
            tfo: proxy.tcp_fast_open,
            'skip-cert-verify': proxy.tls?.insecure,
            'flow': proxy.flow ?? undefined,
        }),
        'tuic': proxy => ({
            name: proxy.tag,
            type: proxy.type,
            server: proxy.server,
            port: proxy.server_port,
            uuid: proxy.uuid,
            password: proxy.password,
            'congestion-controller': proxy.congestion,
            'skip-cert-verify': proxy.tls?.insecure,
            'disable-sni': true,
            'alpn': proxy.tls?.alpn,
            'sni': proxy.tls?.server_name,
            'udp-relay-mode': 'native',
        }),
    };

    convertProxy(proxy) {
        const converter = ClashConfigBuilder.proxyTypeMap[proxy.type];
        if (converter) {
            return converter(proxy);
        }
        return proxy; // 默认返回原对象
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

    addNodeSelectGroup(proxyList) {
    proxyList.unshift(t('outboundNames.Auto Select'), 'REJECT', 'DIRECT');
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

    addFallBackGroup(proxyList) {
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

        // 处理规则集
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
}H_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
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
