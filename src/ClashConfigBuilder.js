// ==========================
// ClashConfigBuilder.js
// ==========================
import yaml from 'js-yaml';
import {
  CLASH_CONFIG,
  generateRules,
  generateClashRuleSets,
  getOutbounds,
  PREDEFINED_RULE_SETS
} from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

/* ---------- 策略配置 ---------- */
const OUTBOUND_POLICIES = {
  media: ['🇭🇰 香港自动', '🇸🇬 新加坡自动'],
  ai:    ['🇸🇬 新加坡自动', '🇺🇸 美国自动'],
  domestic: ['DIRECT']
};

const REGION_FLAGS = ['🇭🇰', '🇺🇸', '🇸🇬', '🇯🇵', '🇬🇧'];

export class ClashConfigBuilder extends BaseConfigBuilder {
  constructor(
    inputString,
    selectedRules,
    customRules,
    baseConfig,
    lang,
    userAgent,
    preferredRegions = [] // 新增：用户偏好地区
  ) {
    if (!baseConfig) baseConfig = CLASH_CONFIG;
    super(inputString, baseConfig, lang, userAgent);
    this.selectedRules   = selectedRules;
    this.customRules     = customRules;
    this.preferredRegions = preferredRegions; // 如 ['🇸🇬','🇺🇸']
  }

  /* ---------- 节点相关 ---------- */
  getProxies() {
    return this.config.proxies || [];
  }

  getProxyName(proxy) {
    return proxy.name;
  }

  convertProxy(proxy) {
    /* 与原逻辑完全一致，省略节省篇幅 */
    switch (proxy.type) {
      case 'shadowsocks': /* ... */ return { name: proxy.tag, type: 'ss', server: proxy.server, port: proxy.server_port, cipher: proxy.method, password: proxy.password };
      case 'vmess':       /* ... */ return { name: proxy.tag, type: 'vmess', server: proxy.server, port: proxy.server_port, uuid: proxy.uuid, alterId: proxy.alter_id, cipher: proxy.security, tls: proxy.tls?.enabled || false, servername: proxy.tls?.server_name || '', 'skip-cert-verify': proxy.tls?.insecure || false, network: proxy.transport?.type || 'tcp', 'ws-opts': proxy.transport?.type === 'ws' ? { path: proxy.transport.path, headers: proxy.transport.headers } : undefined };
      case 'vless':       /* ... */ return { name: proxy.tag, type: 'vless', server: proxy.server, port: proxy.server_port, uuid: proxy.uuid, cipher: proxy.security, tls: proxy.tls?.enabled || false, 'client-fingerprint': proxy.tls.utls?.fingerprint, servername: proxy.tls?.server_name || '', network: proxy.transport?.type || 'tcp', 'ws-opts': proxy.transport?.type === 'ws' ? { path: proxy.transport.path, headers: proxy.transport.headers } : undefined, 'reality-opts': proxy.tls.reality?.enabled ? { 'public-key': proxy.tls.reality.public_key, 'short-id': proxy.tls.reality.short_id } : undefined, 'grpc-opts': proxy.transport?.type === 'grpc' ? { 'grpc-service-name': proxy.transport.service_name } : undefined, tfo: proxy.tcp_fast_open, 'skip-cert-verify': proxy.tls.insecure, flow: proxy.flow ?? undefined };
      case 'hysteria2':   /* ... */ return { name: proxy.tag, type: 'hysteria2', server: proxy.server, port: proxy.server_port, obfs: proxy.obfs.type, 'obfs-password': proxy.obfs.password, password: proxy.password, auth: proxy.auth, up: proxy.up_mbps, down: proxy.down_mbps, 'recv-window-conn': proxy.recv_window_conn, sni: proxy.tls?.server_name || '', 'skip-cert-verify': proxy.tls?.insecure ?? true };
      case 'trojan':      /* ... */ return { name: proxy.tag, type: 'trojan', server: proxy.server, port: proxy.server_port, password: proxy.password, cipher: proxy.security, tls: proxy.tls?.enabled || false, 'client-fingerprint': proxy.tls.utls?.fingerprint, sni: proxy.tls?.server_name || '', network: proxy.transport?.type || 'tcp', 'ws-opts': proxy.transport?.type === 'ws' ? { path: proxy.transport.path, headers: proxy.transport.headers } : undefined, 'reality-opts': proxy.tls.reality?.enabled ? { 'public-key': proxy.tls.reality.public_key, 'short-id': proxy.tls.reality.short_id } : undefined, 'grpc-opts': proxy.transport?.type === 'grpc' ? { 'grpc-service-name': proxy.transport.service_name } : undefined, tfo: proxy.tcp_fast_open, 'skip-cert-verify': proxy.tls.insecure, flow: proxy.flow ?? undefined };
      case 'tuic':        /* ... */ return { name: proxy.tag, type: 'tuic', server: proxy.server, port: proxy.server_port, uuid: proxy.uuid, password: proxy.password, 'congestion-controller': proxy.congestion, 'skip-cert-verify': proxy.tls.insecure, 'disable-sni': true, alpn: proxy.tls.alpn, sni: proxy.tls.server_name, 'udp-relay-mode': 'native' };
      default:            return proxy;
    }
  }

  addProxyToConfig(proxy) {
    this.config.proxies = this.config.proxies || [];

    const isDuplicate = this.config.proxies.some(p =>
      p.server === proxy.server &&
      p.port === proxy.port &&
      p.uuid === proxy.uuid &&
      p.password === proxy.password
    );
    if (isDuplicate) return;

    const similar = this.config.proxies.filter(p => p.name.includes(proxy.name));
    if (similar.length) proxy.name = `${proxy.name} ${similar.length + 1}`;
    this.config.proxies.push(proxy);
  }

  /* ---------- 分组策略 ---------- */
  addAutoSelectGroup(proxyList) {
    const name = t('outboundNames.Auto Select');
    if (this.config['proxy-groups']?.some(g => g.name === name)) return;
    this.config['proxy-groups'] = this.config['proxy-groups'] || [];
    this.config['proxy-groups'].push({
      name,
      type: 'url-test',
      proxies: DeepCopy(proxyList),
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      lazy: false
    });
  }

  addAutoSelectByRegion(proxyList) {
    REGION_FLAGS.forEach(flag => {
      const nodes = proxyList.filter(n => n.includes(flag));
      if (!nodes.length) return;
      const name = `${flag} 自动`;
      if (this.config['proxy-groups']?.some(g => g.name === name)) return;
      this.config['proxy-groups'].push({
        name,
        type: 'url-test',
        proxies: DeepCopy(nodes),
        url: 'https://www.gstatic.com/generate_204',
        interval: 300,
        lazy: false
      });
    });
  }

  addNodeSelectGroup(proxyList) {
    const auto = t('outboundNames.Auto Select');
    const node = t('outboundNames.Node Select');
    const merged = Array.from(new Set([auto, 'DIRECT', 'REJECT', ...proxyList]));
    if (this.config['proxy-groups']?.some(g => g.name === node)) return;
    this.config['proxy-groups'].unshift({ type: 'select', name: node, proxies: DeepCopy(merged) });
  }

  addOutboundGroups(outbounds, proxyList) {
    const auto = t('outboundNames.Auto Select');
    const node = t('outboundNames.Node Select');

    outbounds.forEach(outbound => {
      const outName = t(`outboundNames.${outbound}`);
      if (outName === node) return;

      let optimized;
      if (OUTBOUND_POLICIES.domestic.includes(outName)) {
        optimized = ['DIRECT'];
      } else {
        optimized = new Set([node, auto, 'DIRECT', 'REJECT', ...proxyList]);
        if (/media|stream|video|youtube|netflix/i.test(outbound)) {
          OUTBOUND_POLICIES.media.forEach(r => optimized.add(r));
        }
        if (/openai|chatgpt|ai/i.test(outbound)) {
          OUTBOUND_POLICIES.ai.forEach(r => optimized.add(r));
        }
      }

      this.config['proxy-groups'].push({
        type: 'select',
        name: outName,
        proxies: DeepCopy([...optimized])
      });
    });
  }

  addCustomRuleGroups(proxyList) {
    if (!Array.isArray(this.customRules)) return;
    this.customRules.forEach(rule => {
      this.config['proxy-groups'].push({
        type: 'select',
        name: t(`outboundNames.${rule.name}`),
        proxies: [t('outboundNames.Node Select'), ...proxyList]
      });
    });
  }

  addFallBackGroup(proxyList) {
    const topNodes = proxyList.slice(0, 5); // 仅保留头部
    this.config['proxy-groups'].push({
      type: 'select',
      name: t('outboundNames.Fall Back'),
      proxies: [t('outboundNames.Node Select'), ...topNodes]
    });
  }

  /* ---------- 工具 ---------- */
  sortProxiesByPreference(proxyList) {
    if (!this.preferredRegions.length) return proxyList;
    return proxyList.sort((a, b) => {
      const ai = this.preferredRegions.findIndex(r => a.includes(r));
      const bi = this.preferredRegions.findIndex(r => b.includes(r));
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });
  }

  /* ---------- 主入口 ---------- */
  formatConfig() {
    const proxyList = this.sortProxiesByPreference(
      this.getProxies().map(p => p.name)
    );

    this.addAutoSelectByRegion(proxyList);
    this.addAutoSelectGroup(proxyList);
    this.addNodeSelectGroup(proxyList);
    this.addOutboundGroups(getOutbounds(), proxyList);
    this.addCustomRuleGroups(proxyList);
    this.addFallBackGroup(proxyList);

    /* 规则部分保持与原逻辑一致 */
    const rules = this.generateRules();
    const ruleResults = [];

    const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(
      this.selectedRules,
      this.customRules
    );
    this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

    rules.filter(r => !!r.domain_suffix || !!r.domain_keyword).forEach(rule => {
      rule.domain_suffix?.forEach(s => ruleResults.push(`DOMAIN-SUFFIX,${s},${t('outboundNames.' + rule.outbound)}`));
      rule.domain_keyword?.forEach(k => ruleResults.push(`DOMAIN-KEYWORD,${k},${t('outboundNames.' + rule.outbound)}`));
    });
    rules.filter(r => !!r.site_rules?.[0]).forEach(rule => {
      rule.site_rules.forEach(s => ruleResults.push(`RULE-SET,${s},${t('outboundNames.' + rule.outbound)}`));
    });
    rules.filter(r => !!r.ip_rules?.[0]).forEach(rule => {
      rule.ip_rules.forEach(ip => ruleResults.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`));
    });
    rules.filter(r => !!r.ip_cidr).forEach(rule => {
      rule.ip_cidr.forEach(c => ruleResults.push(`IP-CIDR,${c},${t('outboundNames.' + rule.outbound)},no-resolve`));
    });

    this.config.rules = [...ruleResults, `MATCH,${t('outboundNames.Fall Back')}`];
    return yaml.dump(this.config);
  }
}
