import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
    // 保持原有逻辑（但确保 baseConfig 有值）
    if (!baseConfig) baseConfig = CLASH_CONFIG;
    super(inputString, baseConfig, lang, userAgent);

    this.selectedRules = selectedRules;
    this.customRules = customRules;

    // 防守性初始化，避免后续 this.config 未定义导致 push 报错
    this.config = this.config || {};
    this.config['proxy-groups'] = this.config['proxy-groups'] || [];
    this.config.proxies = this.config.proxies || [];
  }

  getProxies() {
    return this.config.proxies || [];
  }

  addProxyToConfig(proxy) {
    try {
      this.config.proxies = this.config.proxies || [];
      const similar = this.config.proxies.filter(p => p.name && proxy.name && p.name.includes(proxy.name));
      const isSame = similar.some(p => {
        const { name: _, ...a } = proxy;
        const { name: __, ...b } = p;
        return JSON.stringify(a) === JSON.stringify(b);
      });
      if (isSame) return;
      if (similar.length > 0) proxy.name += ` ${similar.length + 1}`;
      this.config.proxies.push(proxy);
    } catch (e) {
      console.error('[ClashConfigBuilder.addProxyToConfig] failed:', e);
      throw e;
    }
  }

  addAutoSelectGroup(proxyList = []) {
    try {
      const name = safeT('outboundNames.Auto Select');
      if (this.config['proxy-groups'].some(g => g.name === name)) return;

      const clean = (Array.isArray(proxyList) ? proxyList : []).filter(n => !/剩余|套餐|倍率|官网/i.test(n));
      this.config['proxy-groups'].push({
        name,
        type: 'url-test',
        proxies: DeepCopy(clean),
        url: 'https://www.gstatic.com/generate_204',
        interval: 300,
        tolerance: 50,
        lazy: true
      });
    } catch (e) {
      console.error('[ClashConfigBuilder.addAutoSelectGroup] failed:', e);
      throw e;
    }
  }

  addNodeSelectGroup(proxyList = []) {
    try {
      const auto = safeT('outboundNames.Auto Select');
      const node = safeT('outboundNames.Node Select');
      if (this.config['proxy-groups'].some(g => g.name === node)) return;

      const clean = (Array.isArray(proxyList) ? proxyList : []).filter(n => !/剩余|套餐|倍率|官网/i.test(n));
      const merged = [auto, 'DIRECT', 'REJECT', ...clean.slice(0, 20)];

      this.config['proxy-groups'].unshift({
        type: 'select',
        name: node,
        proxies: DeepCopy(merged)
      });
    } catch (e) {
      console.error('[ClashConfigBuilder.addNodeSelectGroup] failed:', e);
      throw e;
    }
  }

  addOutboundGroups(outbounds = [], proxyList = []) {
    try {
      const auto = safeT('outboundNames.Auto Select');
      const node = safeT('outboundNames.Node Select');

      const clean = (Array.isArray(proxyList) ? proxyList : []).filter(n => !/剩余|套餐|倍率|官网/i.test(n));
      (Array.isArray(outbounds) ? outbounds : []).forEach(outbound => {
        const name = safeT(`outboundNames.${outbound}`);
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
    } catch (e) {
      console.error('[ClashConfigBuilder.addOutboundGroups] failed:', e);
      throw e;
    }
  }

  addCustomRuleGroups(proxyList = []) {
    try {
      if (!Array.isArray(this.customRules)) return;
      const clean = (Array.isArray(proxyList) ? proxyList : []).filter(n => !/剩余|套餐|倍率|官网/i.test(n));
      this.customRules.forEach(rule => {
        this.config['proxy-groups'].push({
          type: 'select',
          name: safeT(`outboundNames.${rule.name}`),
          proxies: [safeT('outboundNames.Node Select'), ...clean]
        });
      });
    } catch (e) {
      console.error('[ClashConfigBuilder.addCustomRuleGroups] failed:', e);
      throw e;
    }
  }

  addFallBackGroup(proxyList = []) {
    try {
      const name = safeT('outboundNames.Fall Back');
      if (this.config['proxy-groups'].some(g => g.name === name)) return;
      const clean = (Array.isArray(proxyList) ? proxyList : []).filter(n => !/剩余|套餐|倍率|官网/i.test(n));
      this.config['proxy-groups'].push({
        name,
        type: 'fallback',
        proxies: [safeT('outboundNames.Node Select'), ...clean],
        url: 'https://www.gstatic.com/generate_204',
        interval: 300,
        tolerance: 50,
        lazy: true
      });
    } catch (e) {
      console.error('[ClashConfigBuilder.addFallBackGroup] failed:', e);
      throw e;
    }
  }

  generateRules() {
    try {
      if (typeof generateRules !== 'function') {
        console.warn('[ClashConfigBuilder.generateRules] generateRules is not a function');
        return [];
      }
      return generateRules(this.selectedRules, this.customRules) || [];
    } catch (e) {
      console.error('[ClashConfigBuilder.generateRules] failed:', e);
      return [];
    }
  }

  formatConfig() {
    try {
      const rules = this.generateRules();
      const results = [];

      const providers = (typeof generateClashRuleSets === 'function') ? generateClashRuleSets(this.selectedRules, this.customRules) : {};
      const { site_rule_providers, ip_rule_providers } = providers || {};
      this.config['rule-providers'] = { ...(site_rule_providers || {}), ...(ip_rule_providers || {}) };

      (Array.isArray(rules) ? rules : []).forEach(rule => {
        rule.domain_suffix?.forEach(s => results.push(`DOMAIN-SUFFIX,${s},${safeT('outboundNames.' + rule.outbound)}`));
        rule.domain_keyword?.forEach(k => results.push(`DOMAIN-KEYWORD,${k},${safeT('outboundNames.' + rule.outbound)}`));
        rule.site_rules?.forEach(s => results.push(`RULE-SET,${s},${safeT('outboundNames.' + rule.outbound)}`));
        rule.ip_rules?.forEach(ip => results.push(`RULE-SET,${ip},${safeT('outboundNames.' + rule.outbound)},no-resolve`));
        rule.ip_cidr?.forEach(cidr => results.push(`IP-CIDR,${cidr},${safeT('outboundNames.' + rule.outbound)},no-resolve`));
      });

      results.push(`MATCH,${safeT('outboundNames.Fall Back')}`);
      this.config.rules = results;

      return yaml.dump(this.config);
    } catch (e) {
      console.error('[ClashConfigBuilder.formatConfig] failed to build YAML:', e);
      // 抛出带上下文信息的错误，便于面板定位
      throw new Error('[ClashConfigBuilder.formatConfig] ' + (e && e.message ? e.message : String(e)));
    }
  }
}

/** 辅助：当 t() 报错或返回 undefined 时提供备选字符串，避免 Undefined 名称导致组名为 undefined */
function safeT(key) {
  try {
    const v = (typeof t === 'function') ? t(key) : undefined;
    if (!v || typeof v !== 'string') return key.replace(/^outboundNames\./, '') || key;
    return v;
  } catch (e) {
    console.warn('[safeT] i18n t() failed for key:', key, e);
    return key.replace(/^outboundNames\./, '') || key;
  }
}
