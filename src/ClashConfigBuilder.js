import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

// 出站策略优化配置：关键词与优先代理组的映射关系（可扩展）
const OUTBOUND_OPTIMIZATIONS = {
  media: {
    regex: /media|stream|video|youtube|netflix/i,
    proxies: ['🇭🇰 香港自动', '🇸🇬 新加坡自动']
  },
  ai: {
    regex: /openai|chatgpt|ai/i,
    proxies: ['🇸🇬 新加坡自动', '🇺🇸 美国自动']
  }
};

export class ClashConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
    if (!baseConfig) baseConfig = CLASH_CONFIG;
    super(inputString, baseConfig, lang, userAgent);
    this.selectedRules = selectedRules;
    this.customRules = customRules;
    // 初始化代理组容器
    this.config['proxy-groups'] = this.config['proxy-groups'] || [];
  }

  getProxies() {
    return this.config.proxies || [];
  }

  getProxyName(proxy) {
    return proxy.name;
  }

  convertProxy(proxy) {
    switch (proxy.type) {
      case 'shadowsocks':
        return {
          name: proxy.tag,
          type: 'ss',
          server: proxy.server,
          port: proxy.server_port,
          cipher: proxy.method,
          password: proxy.password,
          udp: true // 补充UDP支持，提升兼容性
        };
      case 'vmess':
        return {
          name: proxy.tag,
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          uuid: proxy.uuid,
          alterId: proxy.alter_id,
          cipher: proxy.security || 'auto', // 补充默认值
          tls: proxy.tls?.enabled || false,
          servername: proxy.tls?.server_name || proxy.server, // 默认为服务器地址
          'skip-cert-verify': proxy.tls?.insecure || false,
          network: proxy.transport?.type || 'tcp',
          'ws-opts': proxy.transport?.type === 'ws' ? {
            path: proxy.transport.path || '/', // 补充默认路径
            headers: proxy.transport.headers || {}
          } : undefined,
          udp: true
        };
      case 'vless':
        return {
          name: proxy.tag,
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          uuid: proxy.uuid,
          cipher: proxy.security || 'none',
          tls: proxy.tls?.enabled || false,
          'client-fingerprint': proxy.tls.utls?.fingerprint,
          servername: proxy.tls?.server_name || proxy.server,
          network: proxy.transport?.type || 'tcp',
          'ws-opts': proxy.transport?.type === 'ws' ? {
            path: proxy.transport.path || '/',
            headers: proxy.transport.headers || {}
          } : undefined,
          'reality-opts': proxy.tls.reality?.enabled ? {
            'public-key': proxy.tls.reality.public_key,
            'short-id': proxy.tls.reality.short_id || '',
          } : undefined,
          'grpc-opts': proxy.transport?.type === 'grpc' ? {
            'grpc-service-name': proxy.transport.service_name || '',
          } : undefined,
          tfo: proxy.tcp_fast_open || false,
          'skip-cert-verify': proxy.tls?.insecure || false,
          'flow': proxy.flow,
          udp: true
        };
      case 'hysteria2':
        return {
          name: proxy.tag,
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          obfs: proxy.obfs?.type || '',
          'obfs-password': proxy.obfs?.password || '',
          password: proxy.password,
          auth: proxy.auth || '',
          up: proxy.up_mbps,
          down: proxy.down_mbps,
          'recv-window-conn': proxy.recv_window_conn || 65536, // 补充默认值
          sni: proxy.tls?.server_name || proxy.server,
          'skip-cert-verify': proxy.tls?.insecure || true,
          udp: true
        };
      case 'trojan':
        return {
          name: proxy.tag,
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          password: proxy.password,
          cipher: proxy.security || 'auto',
          tls: proxy.tls?.enabled || false,
          'client-fingerprint': proxy.tls.utls?.fingerprint,
          sni: proxy.tls?.server_name || proxy.server,
          network: proxy.transport?.type || 'tcp',
          'ws-opts': proxy.transport?.type === 'ws' ? {
            path: proxy.transport.path || '/',
            headers: proxy.transport.headers || {}
          } : undefined,
          'reality-opts': proxy.tls.reality?.enabled ? {
            'public-key': proxy.tls.reality.public_key,
            'short-id': proxy.tls.reality.short_id || '',
          } : undefined,
          'grpc-opts': proxy.transport?.type === 'grpc' ? {
            'grpc-service-name': proxy.transport.service_name || '',
          } : undefined,
          tfo: proxy.tcp_fast_open || false,
          'skip-cert-verify': proxy.tls?.insecure || false,
          'flow': proxy.flow,
          udp: true
        };
      case 'tuic':
        return {
          name: proxy.tag,
          type: proxy.type,
          server: proxy.server,
          port: proxy.server_port,
          uuid: proxy.uuid,
          password: proxy.password,
          'congestion-controller': proxy.congestion || 'bbr', // 补充默认拥塞控制
          'skip-cert-verify': proxy.tls?.insecure || false,
          'disable-sni': true,
          'alpn': proxy.tls?.alpn || ['h2', 'http/1.1'], // 补充默认ALPN
          'sni': proxy.tls?.server_name || proxy.server,
          'udp-relay-mode': 'native',
          udp: true
        };
      default:
        return { ...proxy, udp: proxy.udp ?? true }; // 默认开启UDP
    }
  }

  addProxyToConfig(proxy) {
    this.config.proxies = this.config.proxies || [];
    // 先通过关键字段快速过滤非重复项
    const similarProxies = this.config.proxies.filter(p => 
      p.type === proxy.type && 
      p.server === proxy.server && 
      p.port === proxy.port
    );

    // 精确比较其余字段
    const isIdentical = similarProxies.some(p => {
      const { name: _, type, server, port, ...rest1 } = proxy;
      const { name: __, type: t, server: s, port: po, ...rest2 } = p;
      return JSON.stringify(rest1) === JSON.stringify(rest2);
    });

    if (isIdentical) return;

    // 重命名重复名称（仅关键信息重复时）
    if (similarProxies.length > 0) {
      proxy.name = `${proxy.name} ${similarProxies.length + 1}`;
    }

    this.config.proxies.push(proxy);
  }

  addAutoSelectGroup(proxyList) {
    const autoName = t('outboundNames.Auto Select');
    if (this.config['proxy-groups'].some(g => g.name === autoName)) return;

    this.config['proxy-groups'].push({
      name: autoName,
      type: 'url-test',
      proxies: DeepCopy(proxyList),
      url: this.baseConfig?.autoSelectUrl || 'https://www.gstatic.com/generate_204', // 可配置测试地址
      interval: 300,
      lazy: false,
      'tolerance': 50 // 增加容差值，减少频繁切换
    });
  }

  addNodeSelectGroup(proxyList) {
    const autoSelect = t('outboundNames.Auto Select');
    const nodeSelect = t('outboundNames.Node Select');

    // 去重并保持顺序：nodeSelect 优先包含自动选择、直连、拒绝
    const merged = [...new Set([autoSelect, 'DIRECT', 'REJECT', ...proxyList])];
    if (this.config['proxy-groups'].some(g => g.name === nodeSelect)) return;

    // 放在最前，方便用户优先选择
    this.config['proxy-groups'].unshift({
      type: "select",
      name: nodeSelect,
      proxies: DeepCopy(merged),
      'default': autoSelect // 设置默认值为自动选择
    });
  }

  addOutboundGroups(outbounds, proxyList) {
    const autoSelect = t('outboundNames.Auto Select');
    const nodeSelect = t('outboundNames.Node Select');

    outbounds.forEach(outbound => {
      const outboundName = t(`outboundNames.${outbound}`);
      // 避免重复添加同名组
      if (this.config['proxy-groups'].some(g => g.name === outboundName)) return;

      let proxies;

      // 国内服务仅保留直连（精简策略）
      if ([t('outboundNames.国内服务'), '🔒 国内服务'].includes(outboundName)) {
        proxies = ['DIRECT'];
      } else {
        // 基础代理集：节点选择（已包含自动选择、直连等）+ 原始代理
        proxies = [...new Set([nodeSelect, ...proxyList])];

        // 根据出站类型添加优化代理组
        Object.values(OUTBOUND_OPTIMIZATIONS).forEach(({ regex, proxies: optProxies }) => {
          if (regex.test(outbound)) {
            // 优先添加优化代理
            proxies = [...new Set([...optProxies, ...proxies])];
          }
        });
      }

      this.config['proxy-groups'].push({
        type: "select",
        name: outboundName,
        proxies: DeepCopy(proxies),
        'default': nodeSelect // 默认使用节点选择
      });
    });
  }

  addCustomRuleGroups(proxyList) {
    if (!Array.isArray(this.customRules)) return;

    this.customRules.forEach(rule => {
      const groupName = t(`outboundNames.${rule.name}`);
      if (this.config['proxy-groups'].some(g => g.name === groupName)) return;

      this.config['proxy-groups'].push({
        type: "select",
        name: groupName,
        proxies: DeepCopy([t('outboundNames.Node Select'), 'DIRECT', 'REJECT', ...proxyList]),
        'default': t('outboundNames.Node Select')
      });
    });
  }

  addFallBackGroup(proxyList) {
    const fallBackName = t('outboundNames.Fall Back');
    if (this.config['proxy-groups'].some(g => g.name === fallBackName)) return;

    this.config['proxy-groups'].push({
      type: "select",
      name: fallBackName,
      proxies: DeepCopy([t('outboundNames.Node Select'), ...proxyList]),
      'default': t('outboundNames.Node Select')
    });
  }

  generateRules() {
    return generateRules(this.selectedRules, this.customRules);
  }

  formatConfig() {
    const rules = this.generateRules();
    const ruleResults = [];

    const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
    this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

    // 规则优先级优化：更具体的规则在前（关键词 > 后缀 > 规则集 > IP）
    // 1. 域名关键词规则（匹配更精准）
    rules.filter(r => !!r.domain_keyword).forEach(rule => {
      const target = t('outboundNames.' + rule.outbound);
      rule.domain_keyword.forEach(k => ruleResults.push(`DOMAIN-KEYWORD,${k},${target}`));
    });

    // 2. 域名后缀规则
    rules.filter(r => !!r.domain_suffix).forEach(rule => {
      const target = t('outboundNames.' + rule.outbound);
      rule.domain_suffix.forEach(s => ruleResults.push(`DOMAIN-SUFFIX,${s},${target}`));
    });

    // 3. 站点规则集（批量规则）
    rules.filter(r => !!r.site_rules?.length).forEach(rule => {
      const target = t('outboundNames.' + rule.outbound);
      rule.site_rules.forEach(s => ruleResults.push(`RULE-SET,${s},${target}`));
    });

    // 4. IP规则集（带no-resolve避免DNS污染）
    rules.filter(r => !!r.ip_rules?.length).forEach(rule => {
      const target = t('outboundNames.' + rule.outbound);
      rule.ip_rules.forEach(ip => ruleResults.push(`RULE-SET,${ip},${target},no-resolve`));
    });

    // 5. IP-CIDR规则
    rules.filter(r => !!r.ip_cidr).forEach(rule => {
      const target = t('outboundNames.' + rule.outbound);
      rule.ip_cidr.forEach(cidr => ruleResults.push(`IP-CIDR,${cidr},${target},no-resolve`));
    });

    // 最终匹配规则
    this.config.rules = [...ruleResults, `MATCH,${t('outboundNames.Fall Back')}`];

    return yaml.dump(this.config, { skipInvalid: true }); // 忽略无效值，避免YAML序列化错误
  }
}
