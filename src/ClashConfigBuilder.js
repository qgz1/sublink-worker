import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, t } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { t } from './i18n/index.js';

// 深度相等比较，推荐用lodash.isEqual，简化示例手写如下
function isDeepEqual(obj1, obj2) {
    // 简单版本，处理普通对象和数组
    if (obj1 === obj2) return true;
    if (typeof obj1 !== typeof obj2) return false;
    if (typeof obj1 !== 'object' || obj1 === null || obj2 === null) return false;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!isDeepEqual(obj1[key], obj2[key])) return false;
    }
    return true;
}

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig = CLASH_CONFIG, lang, userAgent) {
        super(inputString, baseConfig, lang, userAgent);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
    }

    getProxies() {
        return this.config.proxies ? DeepCopy(this.config.proxies) : [];
    }

    getProxyName(proxy) {
        return proxy.name;
    }

    convertProxy(proxy) {
        // 公共字段提取，减少代码重复
        const common = {
            name: proxy.tag,
            type: proxy.type,
            server: proxy.server,
            port: proxy.server_port
        };

        switch(proxy.type) {
            case 'shadowsocks': {
                return {
                    ...common,
                    type: 'ss', // Clash短写
                    cipher: proxy.method,
                    password: proxy.password
                };
            }
            case 'vmess': {
                return {
                    ...common,
                    uuid: proxy.uuid,
                    alterId: proxy.alter_id,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    servername: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined
                };
            }
            case 'vless': {
                return {
                    ...common,
                    uuid: proxy.uuid,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    flow: proxy.flow ?? undefined,
                };
            }
            case 'hysteria2': {
                return {
                    ...common,
                    obfs: proxy.obfs?.type,
                    'obfs-password': proxy.obfs?.password,
                    password: proxy.password,
                    auth: proxy.auth,
                    up: proxy.up_mbps,
                    down: proxy.down_mbps,
                    'recv-window-conn': proxy.recv_window_conn,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure ?? true,
                };
            }
            case 'trojan': {
                return {
                    ...common,
                    password: proxy.password,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    sni: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    flow: proxy.flow ?? undefined,
                };
            }
            case 'tuic': {
                return {
                    ...common,
                    uuid: proxy.uuid,
                    password: proxy.password,
                    'congestion-controller': proxy.congestion,
                    'skip-cert-verify': proxy.tls?.insecure,
                    'disable-sni': true,
                    alpn: proxy.tls?.alpn,
                    sni: proxy.tls?.server_name,
                    'udp-relay-mode': 'native',
                };
            }
            default:
                return proxy; // 原样返回未知格式
        }
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];

        // 先深度复制保护，防止外部影响
        const proxies = DeepCopy(this.config.proxies);

        // 严格匹配同名代理避免误判
        const sameNameProxies = proxies.filter(p => p.name === proxy.name);

        // 深度判断是否有相同代理（排除name）
        const isIdentical = sameNameProxies.some(p => {
            const { name: _, ...restP } = p;
            const { name: __, ...restProxy } = proxy;
            return isDeepEqual(restP, restProxy);
        });

        if (isIdentical) return; // 有相同代理，则不添加

        // 名字相同但内容不同，追加数字后缀避免重复名
        let newName = proxy.name;
        if (sameNameProxies.length > 0) {
            newName = `${proxy.name} ${sameNameProxies.length + 1}`;
        }

        this.config.proxies.push({ ...proxy, name: newName });
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
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];

        // 先复制防副作用
        const proxiesCopy = DeepCopy(proxyList);
        proxiesCopy.unshift(t('outboundNames.Auto Select'), 'DIRECT', 'REJECT');

        this.config['proxy-groups'].unshift({
            type: "select",
            name: t('outboundNames.Node Select'),
            proxies: proxiesCopy
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        const proxiesCopy = DeepCopy(proxyList);
        outbounds.forEach(outbound => {
            if (outbound !== t('outboundNames.Node Select')) {
                this.config['proxy-groups'].push({
                    type: "select",
                    name: t(`outboundNames.${outbound}`),
                    proxies: [t('outboundNames.Node Select'), ...proxiesCopy]
                });
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.config['proxy-groups'] = this.config['proxy-groups'] || [];
            const proxiesCopy = DeepCopy(proxyList);
            this.customRules.forEach(rule => {
                this.config['proxy-groups'].push({
                    type: "select",
                    name: t(`outboundNames.${rule.name}`),
                    proxies: [t('outboundNames.Node Select'), ...proxiesCopy]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push({
            type: "select",
            name: t('outboundNames.Fall Back'),
            proxies: [t('outboundNames.Node Select'), ...DeepCopy(proxyList)]
        });
    }

    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    formatConfig() {
        const rules = this.generateRules();

        // 获取.mrs格式规则集provider
        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = {
            ...site_rule_providers,
            ...ip_rule_providers
        };

        const ruleResults = [];

        // 合并一次遍历，提升效率
        rules.forEach(rule => {
            if (rule.domain_suffix) {
                rule.domain_suffix.forEach(suffix => {
                    ruleResults.push(`DOMAIN-SUFFIX,${suffix},${t('outboundNames.' + rule.outbound)}`);
                });
            }
            if (rule.domain_keyword) {
                rule.domain_keyword.forEach(keyword => {
                    ruleResults.push(`DOMAIN-KEYWORD,${keyword},${t('outboundNames.' + rule.outbound)}`);
                });
            }
            if (rule.site_rules && rule.site_rules.length > 0) {
                rule.site_rules.forEach(site => {
                    ruleResults.push(`RULE-SET,${site},${t('outboundNames.' + rule.outbound)}`);
                });
            }
            if (rule.ip_rules && rule.ip_rules.length > 0) {
                rule.ip_rules.forEach(ip => {
                    ruleResults.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`);
                });
            }
            if (rule.ip_cidr) {
                rule.ip_cidr.forEach(cidr => {
                    ruleResults.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`);
                });
            }
        });

        ruleResults.push(`MATCH,${t('outboundNames.Fall Back')}`);

        this.config.rules = ruleResults;

        return yaml.dump(this.config);
    }
}
