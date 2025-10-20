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
        // 初始化代理组，避免后续空值判断
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
    }

    // 原有方法：保持不变
    getProxies() {
        return this.config.proxies || [];
    }

    // 原有方法：保持不变
    getProxyName(proxy) {
        return proxy.name;
    }

    // 原有方法：保持不变（代理转换逻辑）
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
            case 'trojan':
            case 'hysteria2':
            case 'tuic':
                // 其他代理类型转换逻辑保持不变
                return { ...proxy, name: proxy.tag };
            default:
                return proxy;
        }
    }

    // 原有方法：保持不变（代理添加逻辑）
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

    // 优化1：自动选择组 - 增强稳定性与资源控制
    addAutoSelectGroup(proxyList) {
        const autoName = t('outboundNames.Auto Select');
        if (this.config['proxy-groups']?.some(g => g.name === autoName)) return;

        // 过滤无效代理（空值、重复项）
        const validProxies = [...new Set(proxyList)].filter(p => typeof p === 'string' && p.trim());
        
        this.config['proxy-groups'].push({
            name: autoName,
            type: 'url-test',
            proxies: DeepCopy(validProxies),
            url: 'https://www.gstatic.com/generate_204',
            backupUrl: 'https://connectivitycheck.gstatic.com/generate_204', // 备用测试地址
            interval: 600, // 延长检查间隔，减少资源消耗
            lazy: true, // 闲置时不检查，降低无效请求
            tolerance: 100, // 扩大容差，避免频繁切换
            'max-failed-times': 2 // 失败2次后切换节点
        });
    }

    // 优化2：节点选择组 - 明确优先级与默认值
    addNodeSelectGroup(proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');

        // 固定优先级：自动选择 > 直连 > 拒绝 > 其他代理
        const orderedProxies = [
            autoSelect, 
            'DIRECT', 
            'REJECT', 
            ...proxyList.filter(p => !['DIRECT', 'REJECT', autoSelect].includes(p)) // 去重已有项
        ];
        const merged = [...new Set(orderedProxies)]; // 最终去重
        
        if (this.config['proxy-groups']?.some(g => g.name === nodeSelect)) return;

        this.config['proxy-groups'].unshift({
            type: "select",
            name: nodeSelect,
            proxies: DeepCopy(merged),
            'default': autoSelect, // 默认选中自动选择
            'udp': true // 明确启用UDP支持
        });
    }

    // 优化3：出站组 - 强化去重与优先级控制
    addOutboundGroups(outbounds, proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');

        outbounds.forEach(outbound => {
            const outboundName = t(`outboundNames.${outbound}`);
            
            // 跳过节点选择组 + 已存在的组，避免重复添加
            if (outboundName === nodeSelect || this.config['proxy-groups']?.some(g => g.name === outboundName)) {
                return;
            }

            let optimized;

            // 国内服务组：仅保留直连
            if (outboundName === t('outboundNames.国内服务') || outboundName === '🔒 国内服务') {
                optimized = ['DIRECT'];
            } else {
                // 基础优先级：节点选择 > 自动选择 > 直连 > 拒绝 > 其他代理
                const baseProxies = [nodeSelect, autoSelect, 'DIRECT', 'REJECT'];
                const uniqueProxies = proxyList.filter(p => !baseProxies.includes(p)); // 去重基础项
                optimized = [...new Set([...baseProxies, ...uniqueProxies])];

                // 基于实际组名匹配媒体/AI类型（更准确）
                if (/media|stream|video|youtube|netflix/i.test(outboundName)) {
                    optimized.unshift('🇭🇰 香港自动', '🇸🇬 新加坡自动');
                    optimized = [...new Set(optimized)]; // 二次去重
                } else if (/openai|chatgpt|ai/i.test(outboundName)) {
                    optimized.unshift('🇸🇬 新加坡自动', '🇺🇸 美国自动');
                    optimized = [...new Set(optimized)];
                }
            }

            this.config['proxy-groups'].push({
                type: "select",
                name: outboundName,
                proxies: DeepCopy(optimized),
                'default': optimized[0] // 默认选中优先级最高的代理
            });
        });
    }

    // 优化4：自定义规则组 - 容错与优先级优化
    addCustomRuleGroups(proxyList) {
        if (!Array.isArray(this.customRules) || this.customRules.length === 0) return; // 容错处理

        this.customRules.forEach(rule => {
            const groupName = t(`outboundNames.${rule.name}`);
            // 跳过已存在的自定义组
            if (this.config['proxy-groups']?.some(g => g.name === groupName)) return;

            // 去重并固定优先级：节点选择 > 其他代理
            const uniqueProxies = [...new Set(proxyList)];
            const proxies = [t('outboundNames.Node Select'), ...uniqueProxies.filter(p => p !== t('outboundNames.Node Select'))];

            this.config['proxy-groups'].push({
                type: "select",
                name: groupName,
                proxies: DeepCopy(proxies),
                'default': t('outboundNames.Node Select') // 默认选中节点选择
            });
        });
    }

    // 优化5：fallback组 - 强化兜底逻辑
    addFallBackGroup(proxyList) {
        const fallBackName = t('outboundNames.Fall Back');
        // 跳过已存在的fallback组
        if (this.config['proxy-groups']?.some(g => g.name === fallBackName)) return;

        // 兜底优先级：节点选择 > 自动选择 > 直连 > 其他代理
        const baseFallBack = [
            t('outboundNames.Node Select'),
            t('outboundNames.Auto Select'),
            'DIRECT'
        ];
        const uniqueProxies = [...new Set(proxyList)].filter(p => !baseFallBack.includes(p));
        const proxies = [...baseFallBack, ...uniqueProxies];

        this.config['proxy-groups'].push({
            type: "select",
            name: fallBackName,
            proxies: DeepCopy(proxies),
            'default': t('outboundNames.Node Select') // 默认用节点选择兜底
        });
    }

    // 原有方法：保持不变
    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    // 原有方法：保持不变（规则格式化逻辑）
    formatConfig() {
        const rules = this.generateRules();
        const ruleResults = [];

        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

        // 原有规则生成逻辑（保持不变）
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

        this.config.rules = [...new Set(ruleResults), `MATCH,${t('outboundNames.Fall Back')}`];

        return yaml.dump(this.config);
    }
}
