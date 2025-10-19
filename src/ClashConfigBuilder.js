import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
    super(inputString, baseConfig || CLASH_CONFIG, lang, userAgent);
    this.selectedRules = selectedRules;
    this.customRules = customRules;
    this.config['proxy-groups'] = this.config['proxy-groups'] || [];
  }

  /** 获取代理列表 */
  getProxies() {
    return this.config.proxies || [];
  }

  /** 添加代理 */
  addProxyToConfig(proxy) {
    this.config.proxies = this.config.proxies || [];
    const similar = this.config.proxies.filter(p => p.name.includes(proxy.name));
    const isSame = similar.some(p => {
      const { name: _, ...a } = proxy;
      const { name: __, ...b } = p;
      return JSON.stringify(a) === JSON.stringify(b);
    });
    if (isSame) return;
    if (similar.length > 0) proxy.name += ` ${similar.length + 1}`;
    this.config.proxies.push(proxy);
  }

  /** 自动选择组 */
  addAutoSelectGroup(proxyList) {
    const name = t('outboundNames.Auto Select');
    if (this.config['proxy-groups'].some(g => g.name === name)) return;

    const clean = proxyList.filter(n => !n.match(/剩余|套餐|倍率|官网/));
    this.config['proxy-groups'].push({
      name,
      type: 'url-test',
      proxies: DeepCopy(clean),
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      lazy: true
    });
  }

  /** 节点选择组 */
  addNodeSelectGroup(proxyList) {
    const auto = t('outboundNames.Auto Select');
    const node = t('outboundNames.Node Select');
    if (this.config['proxy-groups'].some(g => g.name === node)) return;

    const clean = proxyList.filter(n => !n.match(/剩余|套餐|倍率|官网/));
    const merged = [auto, 'DIRECT', 'REJECT', ...clean.slice(0, 20)];

    this.config['proxy-groups'].unshift({
      type: 'select',
      name: node,
      proxies: DeepCopy(merged)
    });
  }

  /** 出站分组 */
  addOutboundGroups(outbounds, proxyList) {
    const auto = t('outboundNames.Auto Select');
    const node = t('outboundNames.Node Select');
    const clean = proxyList.filter(n => !n.match(/剩余|套餐|倍率|官网/));

    outbounds.forEach(outbound => {
      const name = t(`outboundNames.${outbound}`);
      if (this.config['proxy-groups'].some(g => g.name === name)) return;

      let base = [];
      if (/国内服务|🔒 国内服务/.test(name)) {
        base = ['DIRECT'];
      } else if (/fallback|漏网之鱼/i.test(outbound)) {
        base = [node, auto, 'DIRECT', ...clean];
      } else {
        base = [node, auto, 'DIRECT', 'REJECT', ...clean];
      }

      this.config['proxy-groups'].push({
        type: 'select',
        name,
        proxies: DeepCopy(base)
      });
    });
  }

  /** 自定义规则组 */
  addCustomRuleGroups(proxyList) {
    if (!Array.isArray(this.customRules)) return;
    const clean = proxyList.filter(n => !n.match(/剩余|套餐|倍率|官网/));
    this.customRules.forEach(rule => {
      this.config['proxy-groups'].push({
        type: 'select',
        name: t(`outboundNames.${rule.name}`),
        proxies: [t('outboundNames.Node Select'), ...clean]
      });
    });
  }

  /** 漏网之鱼 fallback */
  addFallBackGroup(proxyList) {
    const name = t('outboundNames.Fall Back');
    if (this.config['proxy-groups'].some(g => g.name === name)) return;

    const clean = proxyList.filter(n => !n.match(/剩余|套餐|倍率|官网/));
    this.config['proxy-groups'].push({
      name,
      type: 'fallback',
      proxies: [t('outboundNames.Node Select'), ...clean]
    });
  }

  /** 生成规则 */
  generateRules() {
    return generateRules(this.selectedRules, this.customRules);
  }

  /** 输出最终配置 */
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
