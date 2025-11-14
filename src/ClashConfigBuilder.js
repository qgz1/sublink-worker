import { dump } from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

const hashProxy = p => JSON.stringify(p, (k, v) => k === 'name' ? undefined : v);

const TRANSPORT_MAP = {
  ws: t => ({ 'ws-opts': { path: t.path, headers: t.headers } }),
  grpc: t => ({ 'grpc-opts': { 'grpc-service-name': t.service_name } }),
  http: t => ({
    'http-opts': {
      method: t.method || 'GET',
      path: Array.isArray(t.path) ? t.path : [t.path || '/'],
      headers: t.headers
    }
  }),
  h2: t => ({ 'h2-opts': { path: t.path, host: t.host } })
};

const applyTls = (proxy, out) => {
  const tls = proxy.tls;
  if (!tls) return;
  out.tls = tls.enabled ?? false;
  out.servername = tls.server_name ?? '';
  out['skip-cert-verify'] = tls.insecure ?? false;
  out['client-fingerprint'] = tls.utls?.fingerprint;
  if (tls.reality?.enabled) {
    out['reality-opts'] = {
      'public-key': tls.reality.public_key,
      'short-id': tls.reality.short_id
    };
  }
};

export class ClashConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, baseConfig = CLASH_CONFIG, lang, userAgent) {
    super(inputString, baseConfig, lang, userAgent);
    this.selectedRules = selectedRules;
    this.customRules = customRules;
    this.proxyTypeHandlers = {
      shadowsocks: this.convertShadowsocks,
      vmess: this.convertVmess,
      vless: this.convertVless,
      hysteria2: this.convertHysteria2,
      trojan: this.convertTrojan,
      tuic: this.convertTuic
    };
    this.proxyHash = new Set();
  }

  removeUndefined(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    Object.keys(obj).forEach(k => { if (obj[k] === undefined) delete obj[k]; });
    return obj;
  }

  ensureProxyGroups() {
    if (!this.config['proxy-groups']) this.config['proxy-groups'] = [];
    return this.config['proxy-groups'];
  }

  getProxies() { return this.config.proxies || []; }
  getProxyName(proxy) { return proxy?.name ?? ''; }

  convertProxy(proxy) {
    const handler = this.proxyTypeHandlers[proxy.type];
    return handler ? handler.call(this, proxy) : proxy;
  }

  convertShadowsocks(proxy) {
    return this.removeUndefined({
      name: proxy.tag,
      type: 'ss',
      server: proxy.server,
      port: proxy.server_port,
      cipher: proxy.method,
      password: proxy.password
    });
  }

  convertVmess(proxy) {
    const out = {
      name: proxy.tag,
      type: 'vmess',
      server: proxy.server,
      port: proxy.server_port,
      uuid: proxy.uuid,
      alterId: proxy.alter_id,
      cipher: proxy.security,
      tls: proxy.tls?.enabled ?? false,
      servername: proxy.tls?.server_name ?? '',
      'skip-cert-verify': proxy.tls?.insecure ?? false,
      network: proxy.transport?.type || 'tcp'
    };
    const t = proxy.transport;
    if (t && TRANSPORT_MAP[t.type]) Object.assign(out, TRANSPORT_MAP[t.type](t));
    return this.removeUndefined(out);
  }

  convertVless(proxy) {
    const out = {
      name: proxy.tag,
      type: 'vless',
      server: proxy.server,
      port: proxy.server_port,
      uuid: proxy.uuid,
      cipher: proxy.security,
      network: proxy.transport?.type || 'tcp',
      tfo: proxy.tcp_fast_open,
      flow: proxy.flow
    };
    applyTls(proxy, out);
    const t = proxy.transport;
    if (t && TRANSPORT_MAP[t.type]) Object.assign(out, TRANSPORT_MAP[t.type](t));
    return this.removeUndefined(out);
  }

  convertHysteria2(proxy) {
    return this.removeUndefined({
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
      sni: proxy.tls?.server_name ?? '',
      'skip-cert-verify': proxy.tls?.insecure ?? false
    });
  }

  convertTrojan(proxy) {
    const out = {
      name: proxy.tag,
      type: proxy.type,
      server: proxy.server,
      port: proxy.server_port,
      password: proxy.password,
      cipher: proxy.security,
      network: proxy.transport?.type || 'tcp',
      tfo: proxy.tcp_fast_open,
      flow: proxy.flow
    };
    applyTls(proxy, out);
    const t = proxy.transport;
    if (t && TRANSPORT_MAP[t.type]) Object.assign(out, TRANSPORT_MAP[t.type](t));
    return this.removeUndefined(out);
  }

  convertTuic(proxy) {
    return this.removeUndefined({
      name: proxy.tag,
      type: proxy.type,
      server: proxy.server,
      port: proxy.server_port,
      uuid: proxy.uuid,
      password: proxy.password,
      'congestion-controller': proxy.congestion,
      'skip-cert-verify': proxy.tls?.insecure,
      'disable-sni': proxy.tls?.disable_sni ?? true,
      alpn: proxy.tls?.alpn,
      sni: proxy.tls?.server_name,
      'udp-relay-mode': 'native'
    });
  }

  addProxyToConfig(proxy) {
    this.config.proxies ||= [];
    const h = hashProxy(proxy);
    if (this.proxyHash.has(h)) return;
    this.proxyHash.add(h);

    const baseName = proxy.name;
    const similar = this.config.proxies.filter(p => p.name && (p.name === baseName || p.name.startsWith(baseName + ' ')));
    if (similar.length) proxy.name = `${proxy.name} ${similar.length + 1}`;
    this.config.proxies.push(proxy);
  }

  addAutoSelectGroup(proxyList) {
    this.ensureProxyGroups().push({
      name: t('outboundNames.Auto Select'),
      type: 'url-test',
      proxies: DeepCopy(proxyList),
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      lazy: false
    });
  }

  addNodeSelectGroup(proxyList) {
    const proxies = [t('outboundNames.Auto Select'), 'DIRECT', 'REJECT', ...proxyList];
    this.ensureProxyGroups().unshift({ type: 'select', name: t('outboundNames.Node Select'), proxies });
  }

  addOutboundGroups(outbounds, proxyList) {
    const groups = this.ensureProxyGroups();
    outbounds.forEach(outbound => {
      const name = t(`outboundNames.${outbound}`);
      if (outbound === 'Node Select') return;
      if (name === '🔒 国内服务' || name === '🏠 私有网络') {
        groups.push({ type: 'select', name, proxies: ['DIRECT'] });
        return;
      }
      groups.push({ type: 'select', name, proxies: [t('outboundNames.Node Select'), ...proxyList] });
    });
  }

  addCustomRuleGroups(proxyList) {
    if (!Array.isArray(this.customRules)) return;
    const groups = this.ensureProxyGroups();
    this.customRules.forEach(rule => {
      groups.push({ type: 'select', name: t(`outboundNames.${rule.name}`), proxies: [t('outboundNames.Node Select'), ...proxyList] });
    });
  }

  addFallBackGroup(proxyList) {
    this.ensureProxyGroups().push({ type: 'select', name: t('outboundNames.Fall Back'), proxies: [t('outboundNames.Node Select'), ...proxyList] });
  }

  generateRules() { return generateRules(this.selectedRules, this.customRules); }

  buildRules(rules) {
    const results = [];
    rules.forEach(rule => {
      if (rule.domain_suffix) rule.domain_suffix.forEach(s => results.push(`DOMAIN-SUFFIX,${s},${t('outboundNames.' + rule.outbound)}`));
      if (rule.domain_keyword) rule.domain_keyword.forEach(k => results.push(`DOMAIN-KEYWORD,${k},${t('outboundNames.' + rule.outbound)}`));
      if (rule.site_rules) rule.site_rules.forEach(s => results.push(`RULE-SET,${s},${t('outboundNames.' + rule.outbound)}`));
      if (rule.ip_rules) rule.ip_rules.forEach(i => results.push(`RULE-SET,${i},${t('outboundNames.' + rule.outbound)},no-resolve`));
      if (rule.ip_cidr) rule.ip_cidr.forEach(c => results.push(`IP-CIDR,${c},${t('outboundNames.' + rule.outbound)},no-resolve`));
    });
    return results;
  }

  formatConfig() {
    const rules = this.generateRules();
    const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
    this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };
    this.config.rules = [...this.buildRules(rules), `MATCH,${t('outboundNames.Fall Back')}`];
    return dump(this.config, { noRefs: true });
  }
}
