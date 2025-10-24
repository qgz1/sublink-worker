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
        // 保持原有的代理转换逻辑不变
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
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined
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
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled
                        ? {
                              'public-key': proxy.tls.reality.public_key,
                              'short-id': proxy.tls.reality.short_id
                          }
                        : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc'
                        ? { 'grpc-service-name': proxy.transport.service_name }
                        : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure,
                    flow: proxy.flow ?? undefined
                };
            case 'hysteria2':
                return {
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
                    'skip-cert-verify': proxy.tls?.insecure ?? true
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
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    sni: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled
                        ? {
                              'public-key': proxy.tls.reality.public_key,
                              'short-id': proxy.tls.reality.short_id
                          }
                        : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc'
                        ? { 'grpc-service-name': proxy.transport.service_name }
                        : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure,
                    flow: proxy.flow ?? undefined
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
                    'skip-cert-verify': proxy.tls?.insecure,
                    'disable-sni': true,
                    alpn: proxy.tls?.alpn,
                    sni: proxy.tls?.server_name,
                    'udp-relay-mode': 'native'
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

    // 🚀 创建新的代理组结构
    addFixedProxyGroups(proxyList) {
        // 清空现有的代理组
        this.config['proxy-groups'] = [];

        // 🚀 节点选择 - 手动选择节点
        this.config['proxy-groups'].push({
            name: '🚀 节点选择',
            type: 'select',
            proxies: [
                '♻️ 自动选择',
                '🔯 故障转移', 
                '🔮 负载均衡',
                'DIRECT',
                ...DeepCopy(proxyList) // 包含所有具体节点
            ]
        });

        // ♻️ 自动选择 - URL测试自动选择
        this.config['proxy-groups'].push({
            name: '♻️ 自动选择',
            type: 'url-test',
            url: 'http://www.gstatic.com/generate_204',
            interval: 300,
            tolerance: 50,
            proxies: DeepCopy(proxyList) // 包含所有节点用于自动选择
        });

        // 🔯 故障转移 - 故障转移策略
        this.config['proxy-groups'].push({
            name: '🔯 故障转移',
            type: 'fallback',
            url: 'http://www.gstatic.com/generate_204',
            interval: 180,
            proxies: DeepCopy(proxyList) // 包含所有节点用于故障转移
        });

        // 🔮 负载均衡 - 负载均衡策略
        this.config['proxy-groups'].push({
            name: '🔮 负载均衡',
            type: 'load-balance',
            strategy: 'consistent-hashing',
            url: 'http://www.gstatic.com/generate_204',
            interval: 180,
            proxies: DeepCopy(proxyList) // 包含所有节点用于负载均衡
        });

        // 🎯 全球直连 - 直连或代理选择
        this.config['proxy-groups'].push({
            name: '🎯 全球直连',
            type: 'select',
            proxies: [
                'DIRECT',
                '🚀 节点选择',
                '♻️ 自动选择'
            ]
        });

        // 🛑 全球拦截 - 拒绝或直连选择
        this.config['proxy-groups'].push({
            name: '🛑 全球拦截',
            type: 'select',
            proxies: [
                'REJECT',
                'DIRECT'
            ]
        });

        // 🐟 漏网之鱼 - 未匹配规则的流量处理
        this.config['proxy-groups'].push({
            name: '🐟 漏网之鱼',
            type: 'select',
            proxies: [
                '🚀 节点选择',
                '🎯 全球直连',
                '♻️ 自动选择',
                '🔯 故障转移',
                '🔮 负载均衡'
            ]
        });
    }

    // 重写代理组添加方法
    addProxyGroups(proxyList) {
        this.addFixedProxyGroups(proxyList);
    }

    // 移除旧的代理组创建方法
    addRegionGroups(proxyList) {
        // 不再使用地区分组
    }

    addAutoSelectGroup(proxyList) {
        // 功能已整合到 addFixedProxyGroups
    }

    addNodeSelectGroup(proxyList) {
        // 功能已整合到 addFixedProxyGroups
    }

    addOutboundGroups(outbounds, proxyList) {
        // 不再创建基于规则的出站组
    }

    addCustomRuleGroups(proxyList) {
        // 不再创建自定义规则组
    }

    addFallBackGroup(proxyList) {
        // 功能已整合到 addFixedProxyGroups 中的 🐟 漏网之鱼
    }

    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    formatConfig() {
        const rules = this.generateRules();
        const ruleResults = [];

        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

        // 定义规则到代理组的映射关系
        const outboundMapping = {
            // 直连类规则
            'Bilibili': '🎯 全球直连',
            'Location:CN': '🎯 全球直连',
            'Private': '🎯 全球直连',
            
            // 拦截类规则
            'Ad Block': '🛑 全球拦截',
            
            // 代理类规则（所有其他规则）
            'AI Services': '🚀 节点选择',
            'Youtube': '🚀 节点选择',
            'Google': '🚀 节点选择',
            'Telegram': '🚀 节点选择',
            'Github': '🚀 节点选择',
            'Microsoft': '🚀 节点选择',
            'Apple': '🚀 节点选择',
            'Social Media': '🚀 节点选择',
            'Streaming': '🚀 节点选择',
            'Gaming': '🚀 节点选择',
            'Education': '🚀 节点选择',
            'Financial': '🚀 节点选择',
            'Cloud Services': '🚀 节点选择',
            'Non-China': '🚀 节点选择'
        };

        // 处理域名后缀规则
        rules.filter(r => !!r.domain_suffix || !!r.domain_keyword).forEach(rule => {
            const outbound = outboundMapping[rule.outbound] || '🚀 节点选择';
            rule.domain_suffix?.forEach(s => ruleResults.push(`DOMAIN-SUFFIX,${s},${outbound}`));
            rule.domain_keyword?.forEach(k => ruleResults.push(`DOMAIN-KEYWORD,${k},${outbound}`));
        });

        // 处理站点规则集
        rules.filter(r => !!r.site_rules?.[0]).forEach(rule => {
            const outbound = outboundMapping[rule.outbound] || '🚀 节点选择';
            rule.site_rules.forEach(s => ruleResults.push(`RULE-SET,${s},${outbound}`));
        });

        // 处理IP规则集
        rules.filter(r => !!r.ip_rules?.[0]).forEach(rule => {
            const outbound = outboundMapping[rule.outbound] || '🚀 节点选择';
            rule.ip_rules.forEach(ip => ruleResults.push(`RULE-SET,${ip},${outbound},no-resolve`));
        });

        // 处理IP CIDR规则
        rules.filter(r => !!r.ip_cidr).forEach(rule => {
            const outbound = outboundMapping[rule.outbound] || '🚀 节点选择';
            rule.ip_cidr.forEach(cidr => ruleResults.push(`IP-CIDR,${cidr},${outbound},no-resolve`));
        });

        this.config.rules = [...ruleResults];
        // 使用 🐟 漏网之鱼 作为默认规则
        this.config.rules.push(`MATCH,🐟 漏网之鱼`);

        return yaml.dump(this.config);
    }
}
