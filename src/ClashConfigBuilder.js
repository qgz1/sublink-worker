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
        // 【修复1】恢复原有初始化逻辑，不强制赋值proxy-groups（兼容订阅解析）
        // 移除：this.config['proxy-groups'] = this.config['proxy-groups'] || [];
    }

    // 原有方法（getProxies、getProxyName、convertProxy、addProxyToConfig）保持不变...

    // 【修复2】自动选择组：移除Premium字段，适配基础版Clash
    addAutoSelectGroup(proxyList) {
        const autoName = t('outboundNames.Auto Select');
        if (this.config['proxy-groups']?.some(g => g.name === autoName)) return;

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        // 宽松过滤：仅过滤空字符串，避免过度过滤导致代理列表为空
        const validProxies = proxyList.filter(p => {
            const val = String(p).trim();
            return val !== '' && !['null', 'undefined'].includes(val);
        });
        // 容错：若过滤后为空，保留原始列表（避免订阅代理全部被过滤）
        const finalProxies = validProxies.length > 0 ? validProxies : proxyList;

        this.config['proxy-groups'].push({
            name: autoName,
            type: 'url-test',
            proxies: DeepCopy(finalProxies),
            url: 'https://www.gstatic.com/generate_204', // 仅保留基础字段
            interval: 300, // 恢复默认间隔（基础版Clash更适配）
            lazy: false, // 关闭lazy（部分基础内核不支持）
            // 移除：backupUrl、tolerance、max-failed-times（Premium专属）
        });
    }

    // 【修复3】节点选择组：简化扩展字段，确保兼容性
    addNodeSelectGroup(proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');

        // 固定优先级，但不依赖Set的无序性（用数组去重，兼容基础版）
        const orderedProxies = [autoSelect, 'DIRECT', 'REJECT'];
        proxyList.forEach(p => {
            const val = String(p).trim();
            if (val && !orderedProxies.includes(val)) {
                orderedProxies.push(val);
            }
        });

        if (this.config['proxy-groups']?.some(g => g.name === nodeSelect)) return;

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].unshift({
            type: "select",
            name: nodeSelect,
            proxies: DeepCopy(orderedProxies),
            // 移除：udp: true（基础版Clash默认启用UDP，无需显式配置）
            // 保留default（基础版支持，但需确保值存在于proxies中）
            'default': orderedProxies.includes(autoSelect) ? autoSelect : 'DIRECT'
        });
    }

    // 【修复4】出站组：简化去重逻辑，避免过滤订阅代理
    addOutboundGroups(outbounds, proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');

        outbounds.forEach(outbound => {
            const outboundName = t(`outboundNames.${outbound}`);
            if (outboundName === nodeSelect || this.config['proxy-groups']?.some(g => g.name === outboundName)) {
                return;
            }

            let optimized;
            if (outboundName === t('outboundNames.国内服务') || outboundName === '🔒 国内服务') {
                optimized = ['DIRECT'];
            } else {
                // 基础优先级：不过滤订阅代理，仅去重（用数组而非Set，避免顺序混乱）
                const baseProxies = [nodeSelect, autoSelect, 'DIRECT', 'REJECT'];
                const mergedProxies = [...baseProxies];
                proxyList.forEach(p => {
                    const val = String(p).trim();
                    if (val && !mergedProxies.includes(val)) {
                        mergedProxies.push(val);
                    }
                });
                optimized = mergedProxies;

                // 媒体/AI代理添加：简化正则匹配，避免过度过滤
                if (outboundName.match(/media|stream|video|youtube|netflix/i)) {
                    ['🇭🇰 香港自动', '🇸🇬 新加坡自动'].forEach(p => {
                        if (!optimized.includes(p)) optimized.unshift(p);
                    });
                } else if (outboundName.match(/openai|chatgpt|ai/i)) {
                    ['🇸🇬 新加坡自动', '🇺🇸 美国自动'].forEach(p => {
                        if (!optimized.includes(p)) optimized.unshift(p);
                    });
                }
            }

            this.config['proxy-groups'].push({
                type: "select",
                name: outboundName,
                proxies: DeepCopy(optimized),
                // 保留default，但确保值存在（避免配置无效）
                'default': optimized[0] || 'DIRECT'
            });
        });
    }

    // 【修复5】自定义规则组/ fallback组：兼容订阅代理格式
    addCustomRuleGroups(proxyList) {
        // 容错：允许非数组（如订阅返回null），避免forEach报错
        if (!Array.isArray(this.customRules) || this.customRules.length === 0) return;

        this.customRules.forEach(rule => {
            const groupName = t(`outboundNames.${rule.name}`);
            if (this.config['proxy-groups']?.some(g => g.name === groupName)) return;

            // 简化去重：仅字符串去重，不过滤非字符串（兼容订阅特殊格式）
            const uniqueProxies = [];
            proxyList.forEach(p => {
                const val = String(p).trim();
                if (val && !uniqueProxies.includes(val)) {
                    uniqueProxies.push(val);
                }
            });
            const proxies = [t('outboundNames.Node Select'), ...uniqueProxies];

            this.config['proxy-groups'].push({
                type: "select",
                name: groupName,
                proxies: DeepCopy(proxies),
                'default': t('outboundNames.Node Select')
            });
        });
    }

    addFallBackGroup(proxyList) {
        const fallBackName = t('outboundNames.Fall Back');
        if (this.config['proxy-groups']?.some(g => g.name === fallBackName)) return;

        // 简化兜底逻辑：不强制过滤，仅去重
        const baseFallBack = [t('outboundNames.Node Select'), t('outboundNames.Auto Select'), 'DIRECT'];
        const merged = [...baseFallBack];
        proxyList.forEach(p => {
            const val = String(p).trim();
            if (val && !merged.includes(val)) {
                merged.push(val);
            }
        });

        this.config['proxy-groups'].push({
            type: "select",
            name: fallBackName,
            proxies: DeepCopy(merged),
            'default': t('outboundNames.Node Select')
        });
    }

    // 原有方法（generateRules、formatConfig）保持不变...
}
