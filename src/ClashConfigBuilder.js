import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
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
                return {
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
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined
                };
            case 'vless':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls.utls?.fingerprint,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined,
                    'reality-opts': proxy.tls.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls.insecure,
                    'flow': proxy.flow ?? undefined,
                };
            case 'hysteria2':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    obfs: proxy.obfs.type,
                    'obfs-password': proxy.obfs.password,
                    password: proxy.password,
                    auth: proxy.auth,
                    up: proxy.up_mbps,
                    down: proxy.down_mbps,
                    'recv-window-conn': proxy.recv_window_conn,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || true,
                };
            case 'trojan':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls.utls?.fingerprint,
                    sni: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined,
                    'reality-opts': proxy.tls.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls.insecure,
                    'flow': proxy.flow ?? undefined,
                };
            case 'tuic':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    password: proxy.password,
                    'congestion-controller': proxy.congestion,
                    'skip-cert-verify': proxy.tls.insecure,
                    'disable-sni': true,
                    'alpn': proxy.tls.alpn,
                    'sni': proxy.tls.server_name,
                    'udp-relay-mode': 'native',
                };
            default:
                return proxy;
        }
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

    // 优化1：自动选择组容错机制
    addAutoSelectGroup(proxyList) {
        const autoName = t('outboundNames.Auto Select');
        if (this.config['proxy-groups']?.some(g => g.name === autoName)) return;

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push({
            name: autoName,
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://www.gstatic.com/generate_204',
            backupUrl: 'https://connectivitycheck.gstatic.com/generate_204', // 新增备用测试地址
            interval: 600, // 延长测试间隔
            lazy: true, // 闲置时不测试
            tolerance: 100, // 扩大容差
            'max-failed-times': 2, // 失败2次后切换
            'retry-interval': 20 // 缩短重试间隔
        });
    }

    // 优化2：节点选择组优先级与默认值
    addNodeSelectGroup(proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');

        const merged = new Set([autoSelect, 'DIRECT', 'REJECT', ...proxyList]);
        if (this.config['proxy-groups']?.some(g => g.name === nodeSelect)) return;

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].unshift({
            type: "select",
            name: nodeSelect,
            proxies: DeepCopy([...merged]),
            'default': autoSelect // 新增默认值
        });
    }

    // 优化3：出站组按功能分类优先级
    addOutboundGroups(outbounds, proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');
        // 按功能定义优先代理组
        const outboundPriorities = {
            '非中国': ['🇺🇸 美国自动', '🇭🇰 香港自动'],
            '媒体': ['🇭🇰 香港自动', '🇸🇬 新加坡自动'],
            'AI': ['🇸🇬 新加坡自动', '🇺🇸 美国自动'],
            '漏网之鱼': [nodeSelect, autoSelect]
        };

        outbounds.forEach(outbound => {
            const outboundName = t(`outboundNames.${outbound}`);
            if (this.config['proxy-groups']?.some(g => g.name === outboundName)) return;

            let proxies;
            // 国内服务仅直连
            if (outboundName === t('outboundNames.国内服务') || outboundName === '🔒 国内服务') {
                proxies = ['DIRECT'];
            } else {
                // 匹配功能对应的优先代理
                const matchedPriority = Object.entries(outboundPriorities).find(([key]) => 
                    outboundName.includes(key)
                )?.[1] || [];
                // 合并去重
                proxies = [...new Set([...matchedPriority, nodeSelect, autoSelect, 'DIRECT', 'REJECT', ...proxyList])];
            }

            this.config['proxy-groups'].push({
                type: "select",
                name: outboundName,
                proxies: DeepCopy(proxies),
                'default': proxies[0] // 按优先级设默认值
            });
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

    // 优化4：规则优先级与漏网域名补充
    formatConfig() {
        const rules = this.generateRules();
        const ruleResults = [];

        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

        // 1. 私有网络规则前置（解决UDP拨号失败）
        const privateNetworks = [
            '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 
            '100.64.0.0/10', 'fe80::/10', 'fc00::/7'
        ];
        privateNetworks.forEach(cidr => {
            ruleResults.push(`IP-CIDR,${cidr},🏠 私有网络[DIRECT],no-resolve,force`);
        });

        // 2. 补充漏网域名规则（覆盖日志中的未匹配域名）
        const leakDomains = [
            'qgz789.qzz.io', 'api.ttt.sh', 'd.skk.moe', 
            'qqwry.api.skk.moe', 'api-ipv4.ip.sb', 'api.ipify.org'
        ];
        leakDomains.forEach(domain => {
            ruleResults.push(`DOMAIN,${domain},🌐 非中国`);
        });

        // 3. 原有规则（保持逻辑，调整顺序）
        rules.filter(r => !!r.domain_keyword).forEach(rule => {
            const target = t('outboundNames.' + rule.outbound);
            rule.domain_keyword.forEach(k => ruleResults.push(`DOMAIN-KEYWORD,${k},${target}`));
        });

        rules.filter(r => !!r.domain_suffix).forEach(rule => {
            const target = t('outboundNames.' + rule.outbound);
            rule.domain_suffix.forEach(s => ruleResults.push(`DOMAIN-SUFFIX,${s},${target}`));
        });

        rules.filter(r => !!r.site_rules?.[0]).forEach(rule => {
            const target = t('outboundNames.' + rule.outbound);
            rule.site_rules.forEach(s => ruleResults.push(`RULE-SET,${s},${target}`));
        });

        rules.filter(r => !!r.ip_rules?.[0]).forEach(rule => {
            const target = t('outboundNames.' + rule.outbound);
            rule.ip_rules.forEach(ip => ruleResults.push(`RULE-SET,${ip},${target},no-resolve`));
        });

        rules.filter(r => !!r.ip_cidr).forEach(rule => {
            const target = t('outboundNames.' + rule.outbound);
            rule.ip_cidr.forEach(cidr => ruleResults.push(`IP-CIDR,${cidr},${target},no-resolve`));
        });

        // 最终规则去重
        this.config.rules = [...new Set(ruleResults), `MATCH,${t('outboundNames.Fall Back')}`];

        return yaml.dump(this.config);
    }
}
