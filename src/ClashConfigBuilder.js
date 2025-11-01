import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
    if (!baseConfig) baseConfig = CLASH_CONFIG;
    super(inputString, DeepCopy(baseConfig), lang, userAgent);

    this.selectedRules = selectedRules;
    this.customRules = customRules;

    this.runtimeCustomRules = [];
    this.extraRuleStrings = { before: [], after: [] };

    this.config.proxies = this.config.proxies || [];
    this.config['proxy-groups'] = this.config['proxy-groups'] || [];
    this.config.rules = this.config.rules || [];
    this.config['rule-providers'] = this.config['rule-providers'] || {};

    this.NODE_SELECT = '节点选择';
    this.AUTO_SELECT = '自动选择';
    this.FALL_BACK = '故障转移';

    this.LEGACY_FALLBACK_REGEXES = [
      /漏网之鱼/i,
      /🐟/i,
      /漏网/i,
      /fish/i
    ];
  }

  stableStringify(obj) {
    try {
      const seen = new WeakSet();
      const replacer = (key, value) => {
        if (value && typeof value === 'object') {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
          if (!Array.isArray(value)) {
            const sorted = {};
            Object.keys(value).sort().forEach(k => { sorted[k] = value[k]; });
            return sorted;
          }
        }
        return value;
      };
      return JSON.stringify(obj, replacer);
    } catch (e) {
      return String(obj);
    }
  }

  sanitizeProxyName(name) {
    if (typeof name !== 'string') return name;
    return name.replace(/[,\\\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  buildProxyNamesList() {
    const names = (this.config.proxies || [])
      .map(p => typeof p === 'string' ? p : (p && p.name ? p.name : undefined))
      .filter(Boolean);
    const seen = new Set();
    const deduped = [];
    for (const n of names) {
      if (!seen.has(n)) {
        seen.add(n);
        deduped.push(n);
      }
    }
    return deduped.sort((a, b) => String(a).localeCompare(String(b)));
  }

  mapOutboundToCanonical(label) {
    if (!label) return this.FALL_BACK;
    const l = String(label).trim();
    if (l === 'DIRECT' || l === 'REJECT') return l;
    if (l === this.NODE_SELECT || l === this.AUTO_SELECT || l === this.FALL_BACK) return l;
    try {
      const translated = t && typeof t === 'function' ? t('outboundNames.' + l) : undefined;
      if (translated === this.NODE_SELECT || translated === this.AUTO_SELECT || translated === this.FALL_BACK) return translated;
    } catch (e) {}
    if (/国内|国内服务|🔒/i.test(l)) return 'DIRECT';
    if (this.LEGACY_FALLBACK_REGEXES.some(re => re.test(l))) return this.FALL_BACK;
    return this.FALL_BACK;
  }

  getProxies() { return this.config.proxies || []; }
  getProxyName(proxy) { return proxy.name; }

  convertProxy(proxy) {
    const sanitize = (n) => this.sanitizeProxyName(n ?? proxy.tag ?? proxy.name);
    switch (proxy.type) {
      case 'shadowsocks':
        return {
          name: sanitize(proxy.tag),
          type: 'ss',
          server: proxy.server,
          port: proxy.server_port,
          cipher: proxy.method,
          password: proxy.password
        };
      case 'vmess':
        return {
          name: sanitize(proxy.tag),
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          uuid: proxy.uuid,
          alterId: proxy.alter_id,
          cipher: proxy.security,
          tls: proxy.tls?.enabled || false,
          servername: proxy.tls?.server_name || '',
          'skip-cert-verify': proxy.tls?.insecure || false,
          network: proxy.transport?.type || proxy.network || 'tcp',
          'ws-opts': proxy.transport?.type === 'ws' ? { path: proxy.transport.path, headers: proxy.transport.headers } : undefined,
          'http-opts': proxy.transport?.type === 'http' ? (() => {
            const opts = { method: proxy.transport.method || 'GET', path: Array.isArray(proxy.transport.path) ? proxy.transport.path : [proxy.transport.path || '/'] };
            if (proxy.transport.headers && Object.keys(proxy.transport.headers).length > 0) opts.headers = proxy.transport.headers;
            return opts;
          })() : undefined,
          'grpc-opts': proxy.transport?.type === 'grpc' ? { 'grpc-service-name': proxy.transport.service_name } : undefined,
          'h2-opts': proxy.transport?.type === 'h2' ? { path: proxy.transport.path, host: proxy.transport.host } : undefined
        };
      case 'vless':
        return {
          name: sanitize(proxy.tag),
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          uuid: proxy.uuid,
          cipher: proxy.security,
          tls: proxy.tls?.enabled || false,
          'client-fingerprint': proxy.tls?.utls?.fingerprint,
          servername: proxy.tls?.server_name || '',
          network: proxy.transport?.type || 'tcp',
          'ws-opts': proxy.transport?.type === 'ws' ? { path: proxy.transport.path, headers: proxy.transport.headers } : undefined,
          'reality-opts': proxy.tls?.reality?.enabled ? { 'public-key': proxy.tls.reality.public_key, 'short-id': proxy.tls.reality.short_id } : undefined,
          'grpc-opts': proxy.transport?.type === 'grpc' ? { 'grpc-service-name': proxy.transport.service_name } : undefined,
          tfo: proxy.tcp_fast_open,
          'skip-cert-verify': proxy.tls?.insecure,
          flow: proxy.flow ?? undefined
        };
      case 'hysteria2':
        return {
          name: sanitize(proxy.tag),
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
          name: sanitize(proxy.tag),
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          password: proxy.password,
          cipher: proxy.security,
          tls: proxy.tls?.enabled || false,
          'client-fingerprint': proxy.tls?.utls?.fingerprint,
          sni: proxy.tls?.server_name || '',
          network: proxy.transport?.type || 'tcp',
          'ws-opts': proxy.transport?.type === 'ws' ? { path: proxy.transport.path, headers: proxy.transport.headers } : undefined,
          'reality-opts': proxy.tls.reality?.enabled ? { 'public-key': proxy.tls.reality.public_key, 'short-id': proxy.tls.reality.short_id } : undefined,
          'grpc-opts': proxy.transport?.type === 'grpc' ? { 'grpc-service-name': proxy.transport.service_name } : undefined,
          tfo: proxy.tcp_fast_open,
          'skip-cert-verify': proxy.tls?.insecure,
          flow: proxy.flow ?? undefined
        };
      case 'tuic':
        return {
          name: sanitize(proxy.tag),
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
        return { ...proxy, name: sanitize(proxy.name ?? proxy.tag) };
    }
  }

  addProxyToConfig(proxy) {
    this.config.proxies = this.config.proxies || [];
    proxy.name = this.sanitizeProxyName(proxy.name);

    const similarProxies = this.config.proxies.filter(p => p && typeof p.name === 'string' && p.name.includes(proxy.name));
    const { name: _, ...restNew } = proxy;
    const isIdentical = similarProxies.some(p => {
      const { name: __, ...restExisting } = p;
      return this.stableStringify(restNew) === this.stableStringify(restExisting);
    });
    if (isIdentical) return;
    if (similarProxies.length > 0) {
      const indices = similarProxies.map(p => {
        const m = p.name.match(/ (\d+)$/);
        return m ? Number(m[1]) : 1;
      });
      const nextIdx = Math.max(...indices) + 1;
      proxy.name = `${proxy.name} ${nextIdx}`;
    }
    this.config.proxies.push(proxy);
  }

  addAutoSelectGroup(proxyList) {
    this.config['proxy-groups'] = this.config['proxy-groups'] || [];
    this.config['proxy-groups'].push({
      name: this.AUTO_SELECT,
      type: 'url-test',
      proxies: DeepCopy(proxyList),
      url: 'https://www.gstatic.com/generate_204 ',
      interval: 300,
      lazy: false
    });
  }

  addNodeSelectGroup(proxyList) {
    this.config['proxy-groups'] = this.config['proxy-groups'] || [];
    const merged = [this.AUTO_SELECT, this.FALL_BACK, ...proxyList];
    const seen = new Set();
    const proxies = [];
    for (const p of merged) {
      if (p && !seen.has(p)) { seen.add(p); proxies.push(p); }
    }
    this.config['proxy-groups'].unshift({ type: 'select', name: this.NODE_SELECT, proxies: DeepCopy(proxies) });
  }

  addFallBackGroup(proxyList) {
    this.config['proxy-groups'] = this.config['proxy-groups'] || [];
    this.config['proxy-groups'].push({ type: 'fallback', name: this.FALL_BACK, proxies: DeepCopy(proxyList) });
  }

  addOutboundGroups(outbounds, proxyList) {
    outbounds.forEach(outbound => {
      if (outbound !== this.NODE_SELECT) {
        this.config['proxy-groups'].push({ type: 'select', name: String(outbound), proxies: [this.NODE_SELECT, ...proxyList] });
      }
    });
  }

  addCustomRuleGroups(proxyList) {
    if (Array.isArray(this.customRules)) {
      this.customRules.forEach(rule => {
        if (!rule || !rule.name) return;
        this.config['proxy-groups'].push({ type: 'select', name: String(rule.name), proxies: [this.NODE_SELECT, ...proxyList] });
      });
    }
    if (Array.isArray(this.runtimeCustomRules)) {
      this.runtimeCustomRules.forEach(rule => {
        if (!rule || !rule.name) return;
        this.config['proxy-groups'].push({ type: 'select', name: String(rule.name), proxies: [this.NODE_SELECT, ...proxyList] });
      });
    }
  }

  generateRules() {
    const mergedCustomRules = Array.isArray(this.customRules) ? [...this.customRules] : [];
    if (Array.isArray(this.runtimeCustomRules) && this.runtimeCustomRules.length) mergedCustomRules.push(...this.runtimeCustomRules);
    return generateRules(this.selectedRules, mergedCustomRules);
  }

  safeDump(obj, options = {}) {
    const seen = new WeakSet();
    const clean = (value) => {
      if (value === null) return null;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
      if (typeof value === 'function' || typeof value === 'undefined') return undefined;
      if (typeof value === 'symbol') return String(value);
      if (value instanceof Date) return value.toISOString();
      if (Array.isArray(value)) {
        const out = [];
        for (const el of value) { const c = clean(el); if (typeof c !== 'undefined') out.push(c); }
        return out;
      }
      if (typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
        const out = {};
        try {
          for (const k of Object.keys(value)) {
            if (k === '__proto__' || k === 'constructor') continue;
            const v = clean(value[k]);
            if (typeof v !== 'undefined') out[String(k)] = v;
          }
        } catch (e) { return String(value); }
        return out;
      }
      return String(value);
    };

    try {
      const cleaned = clean(obj);
      const opts = { noRefs: true, sortKeys: true, ...options };
      return yaml.dump(cleaned, opts);
    } catch (err) {
      console.error('safeDump failed:', err && err.stack ? err.stack : err);
      const fallback = [
        'proxies: []',
        'proxy-groups:',
        `  - name: ${this.NODE_SELECT}`,
        "    type: select",
        `    proxies: [${this.AUTO_SELECT}, ${this.FALL_BACK}]`,
        '  - name: 自动选择',
        "    type: url-test",
        "    proxies: []",
        "    url: 'https://www.gstatic.com/generate_204 '",
        '    interval: 300',
        '    lazy: false',
        `  - name: ${this.FALL_BACK}`,
        "    type: fallback",
        "    proxies: []",
        'rules:',
        '  - MATCH,DIRECT'
      ].join('\n');
      return fallback;
    }
  }

  formatConfig() {
    const mergedCustomRules = Array.isArray(this.customRules) ? [...this.customRules] : [];
    if (Array.isArray(this.runtimeCustomRules) && this.runtimeCustomRules.length) mergedCustomRules.push(...this.runtimeCustomRules);

    const rules = this.generateRules();
    const ruleResults = [];

    const { site_rule_providers = {}, ip_rule_providers = {} } = generateClashRuleSets(this.selectedRules, mergedCustomRules);
    this.config['rule-providers'] = { ...DeepCopy(this.config['rule-providers'] || {}), ...DeepCopy(site_rule_providers), ...DeepCopy(ip_rule_providers) };

    if (Array.isArray(rules)) {
      rules.forEach(rule => {
        const translated = (t && typeof t === 'function') ? (() => {
          try { return t('outboundNames.' + rule.outbound); } catch (e) { return undefined; }
        })() : undefined;
        const rawLabel = (translated && translated !== `outboundNames.${rule.outbound}`) ? translated : (rule.outbound ? String(rule.outbound) : undefined);
        const mapped = this.mapOutboundToCanonical(rawLabel);

        if (Array.isArray(rule.domain_suffix)) rule.domain_suffix.forEach(s => ruleResults.push(`DOMAIN-SUFFIX,${s},${mapped}`));
        if (Array.isArray(rule.domain_keyword)) rule.domain_keyword.forEach(k => ruleResults.push(`DOMAIN-KEYWORD,${k},${mapped}`));
      });

      rules.forEach(rule => {
        const translated = (t && typeof t === 'function') ? (() => {
          try { return t('outboundNames.' + rule.outbound); } catch (e) { return undefined; }
        })() : undefined;
        const rawLabel = (translated && translated !== `outboundNames.${rule.outbound}`) ? translated : (rule.outbound ? String(rule.outbound) : undefined);
        const mapped = this.mapOutboundToCanonical(rawLabel);

        if (Array.isArray(rule.site_rules)) rule.site_rules.forEach(s => ruleResults.push(`RULE-SET,${s},${mapped}`));
        if (Array.isArray(rule.ip_rules)) rule.ip_rules.forEach(ip => ruleResults.push(`RULE-SET,${ip},${mapped},no-resolve`));
        if (Array.isArray(rule.ip_cidr)) rule.ip_cidr.forEach(cidr => ruleResults.push(`IP-CIDR,${cidr},${mapped},no-resolve`));
      });
    }

    const proxyNames = this.buildProxyNamesList();

    this.config['proxy-groups'] = [];
    this.addNodeSelectGroup(proxyNames);
    this.addAutoSelectGroup(proxyNames);
    this.addFallBackGroup(proxyNames);

    const allowedGroupNames = new Set([this.NODE_SELECT, this.AUTO_SELECT, this.FALL_BACK]);
    const legacyPatterns = this.LEGACY_FALLBACK_REGEXES;

    this.config['proxy-groups'] = (this.config['proxy-groups'] || []).map(g => {
      if (!g || !g.name) return null;
      if (allowedGroupNames.has(g.name)) return g;
      if (g.type === 'fallback' || legacyPatterns.some(re => re.test(g.name))) {
        return { type: 'fallback', name: this.FALL_BACK, proxies: DeepCopy(proxyNames) };
      }
      return null;
    }).filter(Boolean);

    const allowedProxyTargets = new Set([...proxyNames, this.AUTO_SELECT, this.FALL_BACK, 'DIRECT', 'REJECT']);
    this.config['proxy-groups'].forEach(g => {
      if (Array.isArray(g.proxies)) g.proxies = g.proxies.filter(p => typeof p === 'string' && allowedProxyTargets.has(p));
      else g.proxies = [];
    });

    const before = Array.isArray(this.extraRuleStrings?.before) ? this.extraRuleStrings.before : [];
    const after = Array.isArray(this.extraRuleStrings?.after) ? this.extraRuleStrings.after : [];

    const allowedTargets = new Set([this.NODE_SELECT, this.AUTO_SELECT, this.FALL_BACK, 'DIRECT', 'REJECT']);
    const normalizeTarget = (label) => {
      if (!label || typeof label !== 'string') return this.FALL_BACK;
      const l = label.trim();
      if (l === 'DIRECT' || l === 'REJECT') return l;
      if (allowedTargets.has(l)) return l;
      if (/国内|国内服务|🔒/i.test(l)) return 'DIRECT';
      if (legacyPatterns.some(re => re.test(l))) return this.FALL_BACK;
      return this.FALL_BACK;
    };
    const normalizeRuleLine = (line) => {
      if (typeof line !== 'string') return line;
      const parts = line.split(',');
      if (parts.length < 2) return line;
      const last = parts[parts.length - 1].trim();
      let targetIdx = (last.toLowerCase() === 'no-resolve') ? parts.length - 2 : parts.length - 1;
      if (targetIdx < 1) return line;
      parts[targetIdx] = normalizeTarget(parts[targetIdx]?.trim());
      return parts.join(',');
    };

    const rawRules = [...before, ...ruleResults];
    rawRules.push(`MATCH,${this.FALL_BACK}`);
    const normalizedRules = rawRules.map(normalizeRuleLine);
    const finalRules = normalizedRules.length > 0
      ? [...normalizedRules.slice(0, -1), ...after.map(normalizeRuleLine), normalizedRules[normalizedRules.length - 1]]
      : [...after.map(normalizeRuleLine), `MATCH,${this.FALL_BACK}`];

    this.config.rules = finalRules;

    return this.safeDump(this.config, { noRefs: true });
  }
}
