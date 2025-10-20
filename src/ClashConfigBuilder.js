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
        // 初始化代理组，避免后续判断空值
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
    }

    // 其他方法（getProxies、getProxyName、convertProxy）保持不变...

    // 关键优化：彻底解决代理名称重复（基于完整配置生成唯一名称）
    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        
        // 生成代理唯一标识（基于核心配置，避免名称重复）
        const getUniqueKey = (p) => {
            // 包含所有关键配置字段，确保唯一
            return `${p.type}-${p.server}-${p.port}-${p.uuid || p.password}-${p.cipher || ''}`;
        };

        const newProxyKey = getUniqueKey(proxy);
        // 检查是否已存在相同配置的代理
        const isDuplicate = this.config.proxies.some(p => getUniqueKey(p) === newProxyKey);
        if (isDuplicate) return;

        // 若名称重复但配置不同，强制重命名（添加唯一后缀）
        const nameExists = this.config.proxies.some(p => p.name === proxy.name);
        if (nameExists) {
            const suffix = Math.random().toString(36).substring(2, 6); // 随机4位字符串
            proxy.name = `${proxy.name}-${suffix}`;
        }

        this.config.proxies.push(proxy);
    }

    // 优化自动选择组：增强容错与备用机制
    addAutoSelectGroup(proxyList) {
        const autoName = t('outboundNames.Auto Select');
        if (this.config['proxy-groups'].some(g => g.name === autoName)) return;

        this.config['proxy-groups'].push({
            name: autoName,
            type: 'url-test',
            proxies: DeepCopy(proxyList.filter(p => !p.includes('REJECT'))), // 排除拒绝节点
            url: 'https://www.gstatic.com/generate_204',
            backupUrl: 'https://www.google.com/generate_204', // 增加Google备用地址
            interval: 600,
            lazy: true,
            tolerance: 100,
            'max-failed-times': 1, // 失败1次立即切换
            'retry-interval': 10,
            'health-check': { // 新增健康检查配置
                enable: true,
                interval: 30
            }
        });
    }

    // 优化节点选择组：确保私有网络代理在最前
    addNodeSelectGroup(proxyList) {
        const autoSelect = t('outboundNames.Auto Select');
        const nodeSelect = t('outboundNames.Node Select');
        const privateNetwork = '🏠 私有网络';

        // 强制顺序：私有网络 > 自动选择 > 直连 > 其他节点
        const merged = Array.from(new Set([
            privateNetwork, 
            autoSelect, 
            'DIRECT', 
            'REJECT', 
            ...proxyList
        ]));

        if (this.config['proxy-groups'].some(g => g.name === nodeSelect)) return;

        this.config['proxy-groups'].unshift({
            type: "select",
            name: nodeSelect,
            proxies: DeepCopy(merged),
            'default': autoSelect,
            'udp': true // 明确启用UDP
        });
    }

    // 优化出站组：针对私有网络和漏网之鱼单独强化
    addOutboundGroups(outbounds, proxyList) {
        const nodeSelect = t('outboundNames.Node Select');
        const privateNetwork = '🏠 私有网络';

        outbounds.forEach(outbound => {
            const outboundName = t(`outboundNames.${outbound}`);
            if (this.config['proxy-groups'].some(g => g.name === outboundName)) return;

            let proxies;
            // 私有网络组：仅保留DIRECT，强制直连
            if (outboundName === privateNetwork) {
                proxies = ['DIRECT'];
            } 
            // 漏网之鱼组：优先自动选择和节点选择，减少失败
            else if (outboundName === '🐟 漏网之鱼') {
                proxies = [t('outboundNames.Auto Select'), nodeSelect, ...proxyList, 'DIRECT'];
            } 
            // 国内服务组：仅直连
            else if ([t('outboundNames.国内服务'), '🔒 国内服务'].includes(outboundName)) {
                proxies = ['DIRECT'];
            } 
            // 其他组：默认优先级
            else {
                proxies = [nodeSelect, t('outboundNames.Auto Select'), ...proxyList, 'DIRECT', 'REJECT'];
            }

            this.config['proxy-groups'].push({
                type: "select",
                name: outboundName,
                proxies: DeepCopy(Array.from(new Set(proxies))), // 去重
                'default': proxies[0] // 强制第一个为默认
            });
        });
    }

    // 其他方法（addCustomRuleGroups、addFallBackGroup、generateRules）保持不变...

    // 优化规则：确保私有网络规则绝对优先，补充最新漏网域名
    formatConfig() {
        const rules = this.generateRules();
        const ruleResults = [];

        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

        // 1. 私有网络规则（放在最前面，确保优先匹配）
        const privateNetworks = [
            '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 
            '100.64.0.0/10', 'fe80::/10', 'fc00::/7'
        ];
        privateNetworks.forEach(cidr => {
            // 不依赖force参数，通过顺序确保优先级
            ruleResults.unshift(`IP-CIDR,${cidr},🏠 私有网络[DIRECT],no-resolve`);
        });

        // 2. 补充日志中最新出现的漏网域名（精确匹配）
        const leakDomains = [
            'qgz789.qzz.io', 'api.ttt.sh', 'd.skk.moe', 'qqwry.api.skk.moe',
            'api-ipv4.ip.sb', 'api.ipify.org', 'github.com', 'avatars.githubusercontent.com',
            '150.230.46.101', '192.9.243.240', '142.171.123.133' // 补充漏网IP
        ];
        leakDomains.forEach(target => {
            if (target.includes('.')) {
                // 域名
                ruleResults.push(`DOMAIN,${target},🌐 非中国`);
                ruleResults.push(`DOMAIN-SUFFIX,${target.split('.').slice(-2).join('.')},🌐 非中国`); // 后缀匹配
            } else {
                // IP
                ruleResults.push(`IP-CIDR,${target}/32,🌐 非中国,no-resolve`);
            }
        });

        // 3. 原有规则（保持逻辑）
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

        // 最终规则：去重 + 确保漏网之鱼有备用
        this.config.rules = [...Array.from(new Set(ruleResults)), `MATCH,${t('outboundNames.Fall Back')}`];

        // 强制漏网之鱼组包含自动选择作为备用
        const fishGroup = this.config['proxy-groups'].find(g => g.name === '🐟 漏网之鱼');
        if (fishGroup && !fishGroup.proxies.includes(t('outboundNames.Auto Select'))) {
            fishGroup.proxies.unshift(t('outboundNames.Auto Select'));
        }

        return yaml.dump(this.config);
    }
}
