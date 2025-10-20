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

    /** 获取代理列表 */
    getProxies() {
        return this.config.proxies || [];
    }

    /** 节点命名 */
    getProxyName(proxy) {
        return proxy.name;
    }

    /** 节点格式转换 */
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
                    type: 'vmess',
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
                return { ...proxy, name: proxy.tag };
            default:
                return proxy;
        }
    }

    /** 防止重复节点 */
    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        const same = this.config.proxies.some(p => p.name === proxy.name);
        if (!same) this.config.proxies.push(proxy);
    }

    /** 🧠 智能地区分组 + 测速优化 */
    addRegionAutoGroups(proxyList) {
        const regions = {
            '🇭🇰 香港自动': /(香港|HK|🇭🇰)/i,
            '🇸🇬 新加坡自动': /(新加坡|SG|🇸🇬)/i,
            '🇺🇸 美国自动': /(美国|US|🇺🇸)/i,
            '🇯🇵 日本自动': /(日本|JP|🇯🇵)/i,
            '🇹🇼 台湾自动': /(台湾|TW|台北|🇹🇼)/i,
            '🇰🇷 韩国自动': /(韩国|KR|🇰🇷)/i,
            '🇬🇧 英国自动': /(英国|UK|伦敦|GB|🇬🇧)/i,
            '🇩🇪 德国自动': /(德国|DE|🇩🇪)/i,
            '🇨🇦 加拿大自动': /(加拿大|CA|🇨🇦)/i,
            '🇦🇺 澳大利亚自动': /(澳大利亚|AU|🇦🇺)/i,
        };

        this.config['proxy-groups'] = this.config['proxy-groups'] || [];

        Object.entries(regions).forEach(([regionName, regex]) => {
            const regionProxies = proxyList.filter(p => regex.test(p));
            if (regionProxies.length > 0) {
                this.config['proxy-groups'].push({
                    name: regionName,
                    type: 'url-test',
                    proxies: DeepCopy(regionProxies),
                    url: 'https://cp.cloudflare.com/generate_204',
                    interval: 900,         // 每15分钟测速
                    tolerance: 50,         // 容忍波动50ms内不切换
                    lazy: true,            // 仅在需要时测速
                    'max-failed-times': 3, // Clash.Meta支持，防抖
                });
            }
        });
    }

    /** 🌍 自动测速总组（汇总全部节点） */
    addAutoSelectGroup(proxyList) {
        const name = t('outboundNames.Auto Select');
        if (this.config['proxy-groups']?.some(g => g.name === name)) return;
        this.config['proxy-groups'].push({
            name,
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://cp.cloudflare.com/generate_204',
            interval: 900,
            tolerance: 50,
            lazy: true,
        });
    }

    /** 手动节点选择组 */
    addNodeSelectGroup(proxyList) {
        const auto = t('outboundNames.Auto Select');
        const name = t('outboundNames.Node Select');
        const merged = new Set([auto, 'DIRECT', 'REJECT', ...proxyList]);
        if (this.config['proxy-groups']?.some(g => g.name === name)) return;
        this.config['proxy-groups'].unshift({
            type: 'select',
            name,
            proxies: DeepCopy([...merged])
        });
    }

    /** 🧩 智能服务分组（媒体 / AI / 游戏） */
    addOutboundGroups(outbounds, proxyList) {
        const auto = t('outboundNames.Auto Select');
        const node = t('outboundNames.Node Select');

        const regionPriority = {
            media: ['🇭🇰 香港自动', '🇸🇬 新加坡自动', '🇺🇸 美国自动'],
            ai: ['🇸🇬 新加坡自动', '🇺🇸 美国自动', '🇯🇵 日本自动'],
            game: ['🇯🇵 日本自动', '🇰🇷 韩国自动', '🇺🇸 美国自动'],
        };

        outbounds.forEach(outbound => {
            const name = t(`outboundNames.${outbound}`);
            if (name === node) return;

            let optimized;
            if (name === t('outboundNames.国内服务') || name === '🔒 国内服务') {
                optimized = ['DIRECT'];
            } else {
                optimized = new Set([node, auto, 'DIRECT', 'REJECT', ...proxyList]);

                if (/media|stream|video|netflix|disney|youtube/i.test(outbound)) {
                    optimized = new Set([...regionPriority.media, ...optimized]);
                } else if (/openai|chatgpt|ai|claude|gemini/i.test(outbound)) {
                    optimized = new Set([...regionPriority.ai, ...optimized]);
                } else if (/game|steam|epic|psn|nintendo/i.test(outbound)) {
                    optimized = new Set([...regionPriority.game, ...optimized]);
                }
            }

            this.config['proxy-groups'].push({
                type: 'select',
                name,
                proxies: DeepCopy([...optimized])
            });
        });
    }

    /** 自定义规则组 */
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

    /** 回退组 */
    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push({
            type: 'fallback',
            name: t('outboundNames.Fall Back'),
            proxies: [t('outboundNames.Node Select'), ...proxyList],
            url: 'https://cp.cloudflare.com/generate_204',
            interval: 900,
            lazy: true
        });
    }

    /** 生成规则 */
    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    /** 最终格式化为 YAML */
    formatConfig() {
        const rules = this.generateRules();
        const results = [];

        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

        rules.filter(r => !!r.domain_suffix || !!r.domain_keyword).forEach(rule => {
            rule.domain_suffix?.forEach(s => results.push(`DOMAIN-SUFFIX,${s},${t('outboundNames.' + rule.outbound)}`));
            rule.domain_keyword?.forEach(k => results.push(`DOMAIN-KEYWORD,${k},${t('outboundNames.' + rule.outbound)}`));
        });

        rules.filter(r => !!r.site_rules?.[0]).forEach(rule => {
            rule.site_rules.forEach(s => results.push(`RULE-SET,${s},${t('outboundNames.' + rule.outbound)}`));
        });

        rules.filter(r => !!r.ip_rules?.[0]).forEach(rule => {
            rule.ip_rules.forEach(ip => results.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`));
        });

        rules.filter(r => !!r.ip_cidr).forEach(rule => {
            rule.ip_cidr.forEach(cidr => results.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`));
        });

        this.config.rules = [...results];
        this.config.rules.push(`MATCH,${t('outboundNames.Fall Back')}`);

        return yaml.dump(this.config);
    }
}
