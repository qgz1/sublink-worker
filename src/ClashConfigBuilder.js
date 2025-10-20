import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

// 1. 基础配置：优化策略映射+私有网络CIDR（解决UDP拨号失败）
const OUTBOUND_OPTIMIZATIONS = {
  media: { regex: /media|stream|video|youtube|netflix/i, proxies: ['🇭🇰 香港自动', '🇸🇬 新加坡自动'] },
  ai: { regex: /openai|chatgpt|ai/i, proxies: ['🇸🇬 新加坡自动', '🇺🇸 美国自动'] },
  common: { regex: /api\.ttt\.sh|skk\.moe|ip\.sb|ipify\.org/i, proxies: ['🌐 非中国'] } // 补充漏网域名
};
// 私有网络CIDR（RFC定义，强制直连）
const PRIVATE_NETWORK_CIDRS = [
  '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10', // IPv4
  'fe80::/10', 'fc00::/7' // IPv6（链路本地/私有地址）
];

export class ClashConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
    if (!baseConfig) baseConfig = CLASH_CONFIG;
    super(inputString, baseConfig, lang, userAgent);
    this.selectedRules = selectedRules;
    this.customRules = customRules;
    this.config['proxy-groups'] = this.config['proxy-groups'] || [];
    this.config.proxies = this.config.proxies || []; // 初始化代理列表，避免后续判断空值
  }

  // ... 保留getProxies、getProxyName方法（无修改） ...

  convertProxy(proxy) {
    // 2. 增强代理配置容错：补充WebSocket路径默认值（解决530错误）
    const getDefaultWsOpts = () => ({ path: '/ws', headers: { Host: proxy.server } });
    const getDefaultGrpcOpts = () => ({ 'grpc-service-name': 'grpc.service' });

    switch (proxy.type) {
      case 'shadowsocks':
        return {
          name: this.formatProxyName(proxy), // 3. 统一代理名称格式（避免重复）
          type: 'ss', server: proxy.server, port: proxy.server_port,
          cipher: proxy.method || 'aes-256-gcm', password: proxy.password, udp: true
        };
      case 'vmess':
        return {
          name: this.formatProxyName(proxy),
          type: proxy.type, server: proxy.server, port: proxy.server_port,
          uuid: proxy.uuid, alterId: proxy.alter_id || 0, cipher: proxy.security || 'auto',
          tls: proxy.tls?.enabled || false, servername: proxy.tls?.server_name || proxy.server,
          'skip-cert-verify': proxy.tls?.insecure || false, network: proxy.transport?.type || 'tcp',
          'ws-opts': proxy.transport?.type === 'ws' ? (proxy.transport.ws_opts || getDefaultWsOpts()) : undefined,
          udp: true
        };
      case 'vless':
      case 'trojan':
        return {
          name: this.formatProxyName(proxy),
          type: proxy.type, server: proxy.server, port: proxy.server_port,
          uuid: proxy.uuid, password: proxy.password, cipher: proxy.security || (proxy.type === 'vless' ? 'none' : 'auto'),
          tls: proxy.tls?.enabled || false, 'client-fingerprint': proxy.tls.utls?.fingerprint || 'chrome',
          servername: proxy.tls?.server_name || proxy.server, network: proxy.transport?.type || 'tcp',
          'ws-opts': proxy.transport?.type === 'ws' ? (proxy.transport.ws_opts || getDefaultWsOpts()) : undefined,
          'grpc-opts': proxy.transport?.type === 'grpc' ? (proxy.transport.grpc_opts || getDefaultGrpcOpts()) : undefined,
          'reality-opts': proxy.tls.reality?.enabled ? {
            'public-key': proxy.tls.reality.public_key,
            'short-id': proxy.tls.reality.short_id || ''
          } : undefined,
          tfo: proxy.tcp_fast_open || false, 'skip-cert-verify': proxy.tls?.insecure || false,
          'flow': proxy.flow, udp: true
        };
      case 'hysteria2':
      case 'tuic':
        return {
          name: this.formatProxyName(proxy),
          type: proxy.type, server: proxy.server, port: proxy.server_port,
          uuid: proxy.uuid, password: proxy.password,
          'skip-cert-verify': proxy.tls?.insecure || false, sni: proxy.tls?.server_name || proxy.server,
          udp: true, ...(proxy.type === 'tuic' ? { 'congestion-controller': proxy.congestion || 'bbr' } : {
            obfs: proxy.obfs?.type || '', 'obfs-password': proxy.obfs?.password || '',
            up: proxy.up_mbps, down: proxy.down_mbps
          })
        };
      default:
        return { ...proxy, name: this.formatProxyName(proxy), udp: proxy.udp ?? true };
    }
  }

  // 3. 新增：格式化代理名称（地区+服务商+端口+唯一标识，彻底解决重复）
  formatProxyName(proxy) {
    const region = proxy.tag.match(/\[([^)]+)\]/)?.[1] || '未知地区'; // 从tag提取地区（如[data-US-...]中的US）
    const provider = proxy.tag.split('-')[1] || '未知服务商'; // 提取服务商（如Amazon_Technologies_Inc.）
    const uniqueId = proxy.server.split('.').slice(-2).join('.') + ':' + proxy.server_port; // 用"域名后缀:端口"作为唯一标识
    return `${region}-${provider}-${uniqueId}`; // 示例：US-Amazon-technologies.com:443
  }

  // 4. 修复：增强代理去重逻辑（覆盖所有关键字段，避免重复添加）
  addProxyToConfig(proxy) {
    // 关键去重字段：类型+服务器+端口+核心认证信息（UUID/密码/加密方式）
    const getProxyKey = (p) => {
      const authKey = p.type === 'ss' ? p.password + p.cipher : p.uuid || p.password;
      return `${p.type}-${p.server}-${p.port}-${authKey}`;
    };

    const newProxyKey = getProxyKey(proxy);
    // 检查是否已存在完全相同的代理
    const isDuplicate = this.config.proxies.some(p => getProxyKey(p) === newProxyKey);
    if (isDuplicate) return;

    this.config.proxies.push(proxy);
  }

  // 5. 优化：自动选择组容错（解决连接失败无备用问题）
  addAutoSelectGroup(proxyList) {
    const autoName = t('outboundNames.Auto Select');
    if (this.config['proxy-groups'].some(g => g.name === autoName)) return;

    this.config['proxy-groups'].push({
      name: autoName,
      type: 'url-test',
      proxies: DeepCopy(proxyList),
      url: this.baseConfig?.autoSelectUrl || 'https://www.gstatic.com/generate_204',
      backupUrl: 'https://connectivitycheck.gstatic.com/generate_204', // 备用测试地址
      interval: 600, // 测试间隔从300s改为600s，减少资源占用
      lazy: true, // 闲置时不测试，降低CPU消耗
      tolerance: 100, // 容差值扩大，避免频繁切换
      'max-failed-times': 3, // 最大失败3次后切换节点
      'retry-interval': 30 // 失败后30s重试
    });
  }

  // ... 保留addNodeSelectGroup、addOutboundGroups、addCustomRuleGroups、addFallBackGroup方法（无修改） ...

  // 6. 修复：补充私有网络直连规则+完善漏网域名覆盖（解决UDP拨号失败和漏网之鱼问题）
  formatConfig() {
    const rules = this.generateRules();
    const ruleResults = [];

    // 步骤1：优先添加私有网络直连规则（解决100.64.0.1/fe80::拨号失败）
    PRIVATE_NETWORK_CIDRS.forEach(cidr => {
      ruleResults.push(`IP-CIDR,${cidr},🏠 私有网络[DIRECT],no-resolve`);
    });

    // 步骤2：补充常见漏网域名规则（如api.ttt.sh、skk.moe）
    Object.values(OUTBOUND_OPTIMIZATIONS).forEach(({ regex, proxies }) => {
      if (proxies.includes('🌐 非中国')) {
        ruleResults.push(`DOMAIN-KEYWORD,${regex.source.replace(/\|/g, ',').replace(/\//g, '')},🌐 非中国`);
      }
    });

    // 步骤3：原有规则生成（保持优先级：关键词>后缀>规则集>IP）
    rules.filter(r => !!r.domain_keyword).forEach(rule => {
      const target = t('outboundNames.' + rule.outbound);
      rule.domain_keyword.forEach(k => ruleResults.push(`DOMAIN-KEYWORD,${k},${target}`));
    });
    rules.filter(r => !!r.domain_suffix).forEach(rule => {
      const target = t('outboundNames.' + rule.outbound);
      rule.domain_suffix.forEach(s => ruleResults.push(`DOMAIN-SUFFIX,${s},${target}`));
    });
    rules.filter(r => !!r.site_rules?.length).forEach(rule => {
      const target = t('outboundNames.' + rule.outbound);
      rule.site_rules.forEach(s => ruleResults.push(`RULE-SET,${s},${target}`));
    });
    rules.filter(r => !!r.ip_rules?.length).forEach(rule => {
      const target = t('outboundNames.' + rule.outbound);
      rule.ip_rules.forEach(ip => ruleResults.push(`RULE-SET,${ip},${target},no-resolve`));
    });
    rules.filter(r => !!r.ip_cidr).forEach(rule => {
      const target = t('outboundNames.' + rule.outbound);
      rule.ip_cidr.forEach(cidr => ruleResults.push(`IP-CIDR,${cidr},${target},no-resolve`));
    });

    // 步骤4：规则集配置+最终MATCH规则
    const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
    this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };
    this.config.rules = [...ruleResults, `MATCH,${t('outboundNames.Fall Back')}`];

    // 步骤5：给漏网之鱼组添加备用代理（避免单一代理失败）
    const fallBackGroup = this.config['proxy-groups'].find(g => g.name === t('outboundNames.Fall Back'));
    if (fallBackGroup) {
      const autoSelect = t('outboundNames.Auto Select');
      if (!fallBackGroup.proxies.includes(autoSelect)) {
        fallBackGroup.proxies.unshift(autoSelect); // 漏网之鱼优先用自动选择作为备用
      }
    }

    return yaml.dump(this.config, { skipInvalid: true });
  }
}
