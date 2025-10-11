import { t } from './i18n';

// 规则集远程地址（按工具分类）
export const RULE_SET_BASE_URLS = {
  singBox: {
    site: 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geosite/',
    ip: 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geoip/',
    suffix: 'srs',
  },
  clash: {
    site: 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/',
    ip: 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/',
    suffix: 'mrs',
  },
  surge: {
    site: 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geosite/',
    ip: 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geoip/',
    suffix: 'dat',
  },
};

// 预设规则组合
export const PREDEFINED_RULE_SETS = {
  minimal: {
    name: '轻量模式',
    desc: '仅覆盖基础代理需求',
    rules: ['Location:CN', 'Private', 'Non-China'],
  },
  balanced: {
    name: '平衡模式',
    desc: '覆盖常用海外服务',
    rules: ['Location:CN', 'Private', 'Non-China', 'Github', 'Google', 'Youtube', 'AI Services', 'Telegram'],
  },
  comprehensive: {
    name: '完整模式',
    desc: '覆盖所有场景',
    rules: [],
  },
};

// 自定义规则默认字段
export const DEFAULT_CUSTOM_RULE = {
  site: '',
  ip: '',
  domain_suffix: '',
  domain_keyword: '',
  ip_cidr: '',
  protocol: '',
  name: '自定义规则',
};

// 工具配置常量
export const TOOL_CONSTANTS = {
  clash: {
    ruleUpdateInterval: 86400,
    ruleCachePath: './ruleset/',
  },
  surge: {
    ruleCachePath: './Surge/Rules/',
  },
};

// 统一规则列表（带优先级）
export const UNIFIED_RULES = [
  {
    name: 'Ad Block',
    priority: 1,
    outbound: t('outboundNames.Ad Block'),
    site_rules: ['category-ads-all'],
    ip_rules: [],
  },
  {
    name: 'Private',
    priority: 2,
    outbound: t('outboundNames.Private'),
    site_rules: [],
    ip_rules: ['private'],
  },
  {
    name: 'Location:CN',
    priority: 3,
    outbound: t('outboundNames.Location:CN'),
    site_rules: ['geolocation-cn', 'cn'],
    ip_rules: ['cn'],
  },
  {
    name: 'AI Services',
    priority: 4,
    outbound: t('outboundNames.AI Services'),
    site_rules: ['category-ai-!cn'],
    ip_rules: [],
  },
  {
    name: 'Telegram',
    priority: 5,
    outbound: t('outboundNames.Telegram'),
    site_rules: [],
    ip_rules: ['telegram'],
  },
  {
    name: 'Google',
    priority: 6,
    outbound: t('outboundNames.Google'),
    site_rules: ['google'],
    ip_rules: ['google'],
  },
  {
    name: 'Youtube',
    priority: 7,
    outbound: t('outboundNames.Youtube'),
    site_rules: ['youtube'],
    ip_rules: [],
  },
  {
    name: 'Github',
    priority: 8,
    outbound: t('outboundNames.Github'),
    site_rules: ['github', 'gitlab'],
    ip_rules: [],
  },
  {
    name: 'Microsoft',
    priority: 9,
    outbound: t('outboundNames.Microsoft'),
    site_rules: ['microsoft'],
    ip_rules: [],
  },
  {
    name: 'Apple',
    priority: 10,
    outbound: t('outboundNames.Apple'),
    site_rules: ['apple'],
    ip_rules: [],
  },
  {
    name: 'Social Media',
    priority: 11,
    outbound: t('outboundNames.Social Media'),
    site_rules: ['facebook', 'instagram', 'twitter', 'tiktok', 'linkedin'],
    ip_rules: [],
  },
  {
    name: 'Streaming',
    priority: 12,
    outbound: t('outboundNames.Streaming'),
    site_rules: ['netflix', 'hulu', 'disney', 'hbo', 'amazon', 'bahamut'],
    ip_rules: [],
  },
  {
    name: 'Gaming',
    priority: 13,
    outbound: t('outboundNames.Gaming'),
    site_rules: ['steam', 'epicgames', 'ea', 'ubisoft', 'blizzard'],
    ip_rules: [],
  },
  {
    name: 'Education',
    priority: 14,
    outbound: t('outboundNames.Education'),
    site_rules: ['coursera', 'edx', 'udemy', 'khanacademy', 'category-scholar-!cn'],
    ip_rules: [],
  },
  {
    name: 'Financial',
    priority: 15,
    outbound: t('outboundNames.Financial'),
    site_rules: ['paypal', 'visa', 'mastercard', 'stripe', 'wise'],
    ip_rules: [],
  },
  {
    name: 'Cloud Services',
    priority: 16,
    outbound: t('outboundNames.Cloud Services'),
    site_rules: ['aws', 'azure', 'digitalocean', 'heroku', 'dropbox'],
    ip_rules: [],
  },
  {
    name: 'Non-China',
    priority: 100,
    outbound: t('outboundNames.Non-China'),
    site_rules: ['geolocation-!cn'],
    ip_rules: [],
  },
];

// 填充完整模式规则
PREDEFINED_RULE_SETS.comprehensive.rules = UNIFIED_RULES.map(rule => rule.name);

// 公共函数：处理选中的规则
const processSelectedRules = (selectedRules) => {
  if (typeof selectedRules === 'string') {
    return PREDEFINED_RULE_SETS[selectedRules]?.rules || PREDEFINED_RULE_SETS.minimal.rules;
  }
  return Array.isArray(selectedRules) 
    ? [...new Set(selectedRules.filter(Boolean))] 
    : PREDEFINED_RULE_SETS.minimal.rules;
};

// 公共函数：标准化自定义规则
const normalizeCustomRules = (customRules = []) => {
  return customRules
    .map(rule => ({ ...DEFAULT_CUSTOM_RULE, ...rule }))
    .filter(rule => Object.values(rule).some(val => 
      typeof val === 'string' ? val.trim() !== '' : Array.isArray(val) ? val.length > 0 : false
    ))
    .map(rule => {
      const normalizeField = (field) => 
        field.split(',').map(item => item.trim()).filter(Boolean);
      return {
        ...rule,
        site: normalizeField(rule.site),
        ip: normalizeField(rule.ip),
        domain_suffix: normalizeField(rule.domain_suffix),
        domain_keyword: normalizeField(rule.domain_keyword),
        ip_cidr: normalizeField(rule.ip_cidr),
        protocol: normalizeField(rule.protocol),
      };
    });
};

// 获取出口列表
export function getOutbounds(selectedRules) {
  const processedRules = processSelectedRules(selectedRules);
  return UNIFIED_RULES
    .filter(rule => processedRules.includes(rule.name))
    .sort((a, b) => a.priority - b.priority)
    .map(rule => rule.outbound);
}

// 生成最终规则列表
export function generateRules(selectedRules, customRules = []) {
  const processedRules = processSelectedRules(selectedRules);
  const normalizedCustomRules = normalizeCustomRules(customRules);

  const defaultRules = UNIFIED_RULES
    .filter(rule => processedRules.includes(rule.name))
    .sort((a, b) => a.priority - b.priority)
    .map(rule => ({
      site_rules: rule.site_rules,
      ip_rules: rule.ip_rules,
      domain_suffix: rule?.domain_suffix || [],
      ip_cidr: rule?.ip_cidr || [],
      outbound: rule.outbound,
      priority: rule.priority,
    }));

  const finalCustomRules = normalizedCustomRules
    .reverse()
    .map((rule, index) => ({
      site_rules: rule.site,
      ip_rules: rule.ip,
      domain_suffix: rule.domain_suffix,
      domain_keyword: rule.domain_keyword,
      ip_cidr: rule.ip_cidr,
      protocol: rule.protocol,
      outbound: rule.name,
      priority: 0 - index,
    }));

  return [...finalCustomRules, ...defaultRules].sort((a, b) => a.priority - b.priority);
}

// 生成Sing-Box规则集
export function generateSingBoxRuleSets(selectedRules, customRules = []) {
  const processedRules = processSelectedRules(selectedRules);
  const normalizedCustomRules = normalizeCustomRules(customRules);
  const { site: siteBaseUrl, ip: ipBaseUrl, suffix } = RULE_SET_BASE_URLS.singBox;

  const selectedRuleSet = new Set(processedRules);
  const siteTags = new Set();
  const ipTags = new Set();

  UNIFIED_RULES.forEach(rule => {
    if (selectedRuleSet.has(rule.name)) {
      rule.site_rules.forEach(tag => siteTags.add(tag));
      rule.ip_rules.forEach(tag => ipTags.add(tag));
    }
  });

  if (!selectedRuleSet.has('Non-China')) {
    siteTags.add('geolocation-!cn');
  }

  const generateRuleSet = (tags, baseUrl, isIp = false) => {
    return Array.from(tags).map(tag => ({
      tag: isIp ? `${tag}-ip` : tag,
      type: 'remote',
      format: 'binary',
      url: `${baseUrl}${isIp ? 'geoip-' : 'geosite-'}${tag}.${suffix}`,
    }));
  };

  let siteRuleSets = generateRuleSet(siteTags, siteBaseUrl);
  let ipRuleSets = generateRuleSet(ipTags, ipBaseUrl, true);

  normalizedCustomRules.forEach(rule => {
    rule.site.forEach(tag => {
      siteRuleSets.push({
        tag,
        type: 'remote',
        format: 'binary',
        url: `${siteBaseUrl}geosite-${tag}.${suffix}`,
      });
    });
    rule.ip.forEach(tag => {
      ipRuleSets.push({
        tag: `${tag}-ip`,
        type: 'remote',
        format: 'binary',
        url: `${ipBaseUrl}geoip-${tag}.${suffix}`,
      });
    });
  });

  siteRuleSets = [...new Map(siteRuleSets.map(item => [item.tag, item])).values()];
  ipRuleSets = [...new Map(ipRuleSets.map(item => [item.tag, item])).values()];

  return { site_rule_sets: siteRuleSets, ip_rule_sets: ipRuleSets };
}

// 生成Clash规则集
export function generateClashRuleSets(selectedRules, customRules = []) {
  const processedRules = processSelectedRules(selectedRules);
  const normalizedCustomRules = normalizeCustomRules(customRules);
  const { site: siteBaseUrl, ip: ipBaseUrl, suffix } = RULE_SET_BASE_URLS.clash;
  const { ruleUpdateInterval, ruleCachePath } = TOOL_CONSTANTS.clash;

  const selectedRuleSet = new Set(processedRules);
  const siteTags = new Set();
  const ipTags = new Set();

  UNIFIED_RULES.forEach(rule => {
    if (selectedRuleSet.has(rule.name)) {
      rule.site_rules.forEach(tag => siteTags.add(tag));
      rule.ip_rules.forEach(tag => ipTags.add(tag));
    }
  });

  if (!selectedRuleSet.has('Non-China')) {
    siteTags.add('geolocation-!cn');
  }

  const siteProviders = {};
  const ipProviders = {};

  Array.from(siteTags).forEach(tag => {
    siteProviders[tag] = {
      type: 'http',
      format: suffix,
      behavior: 'domain',
      url: `${siteBaseUrl}${tag}.${suffix}`,
      path: `${ruleCachePath}${tag}.${suffix}`,
      interval: ruleUpdateInterval,
    };
  });

  Array.from(ipTags).forEach(tag => {
    ipProviders[tag] = {
      type: 'http',
      format: suffix,
      behavior: 'ipcidr',
      url: `${ipBaseUrl}${tag}.${suffix}`,
      path: `${ruleCachePath}${tag}.${suffix}`,
      interval: ruleUpdateInterval,
    };
  });

  normalizedCustomRules.forEach(rule => {
    rule.site.forEach(tag => {
      if (!siteProviders[tag]) {
        siteProviders[tag] = {
          type: 'http',
          format: suffix,
          behavior: 'domain',
          url: `${siteBaseUrl}${tag}.${suffix}`,
          path: `${ruleCachePath}${tag}.${suffix}`,
          interval: ruleUpdateInterval,
        };
      }
    });
    rule.ip.forEach(tag => {
      if (!ipProviders[tag]) {
        ipProviders[tag] = {
          type: 'http',
          format: suffix,
          behavior: 'ipcidr',
          url: `${ipBaseUrl}${tag}.${suffix}`,
          path: `${ruleCachePath}${tag}.${suffix}`,
          interval: ruleUpdateInterval,
        };
      }
    });
  });

  return { site_rule_providers: siteProviders, ip_rule_providers: ipProviders };
}

// 生成Surge规则集
export function generateSurgeRuleSets(selectedRules, customRules = []) {
  const processedRules = processSelectedRules(selectedRules);
  const normalizedCustomRules = normalizeCustomRules(customRules);
  const { site: siteBaseUrl, ip: ipBaseUrl, suffix } = RULE_SET_BASE_URLS.surge;
  const { ruleCachePath } = TOOL_CONSTANTS.surge;

  const selectedRuleSet = new Set(processedRules);
  const siteTags = new Set();
  const ipTags = new Set();

  UNIFIED_RULES.forEach(rule => {
    if (selectedRuleSet.has(rule.name)) {
      rule.site_rules.forEach(tag => siteTags.add(tag));
      rule.ip_rules.forEach(tag => ipTags.add(tag));
    }
  });

  if (!selectedRuleSet.has('Non-China')) {
    siteTags.add('geolocation-!cn');
  }

  const generateSurgeRule = (tags, baseUrl, type) => {
    return Array.from(tags).map(tag => ({
      tag: `${type}-${tag}`,
      type: 'remote-rule',
      url: `${baseUrl}${tag}.${suffix}`,
      path: `${ruleCachePath}${type}-${tag}.${suffix}`,
      update_interval: 86400,
    }));
  };

  let siteRules = generateSurgeRule(siteTags, siteBaseUrl, 'geosite');
  let ipRules = generateSurgeRule(ipTags, ipBaseUrl, 'geoip');

  normalizedCustomRules.forEach(rule => {
    rule.site.forEach(tag => {
      const ruleTag = `geosite-${tag}`;
      if (!siteRules.some(item => item.tag === ruleTag)) {
        siteRules.push({
          tag: ruleTag,
          type: 'remote-rule',
          url: `${siteBaseUrl}${tag}.${suffix}`,
          path: `${ruleCachePath}${ruleTag}.${suffix}`,
          update_interval: 86400,
        });
      }
    });
    rule.ip.forEach(tag => {
      const ruleTag = `geoip-${tag}`;
      if (!ipRules.some(item => item.tag === ruleTag)) {
        ipRules.push({
          tag: ruleTag,
          type: 'remote-rule',
          url: `${ipBaseUrl}${tag}.${suffix}`,
          path: `${ruleCachePath}${ruleTag}.${suffix}`,
          update_interval: 86400,
        });
      }
    });
  });

  return { site_rules: siteRules, ip_rules: ipRules };
}

// Sing-Box基础配置
export const SING_BOX_CONFIG = {
  dns: {
    servers: [
      { type: 'tcp', tag: 'dns_proxy', server: '1.1.1.1', detour: '🚀 节点选择', domain_resolver: 'dns_resolver' },
      { type: 'https', tag: 'dns_direct', server: 'dns.alidns.com', domain_resolver: 'dns_resolver' },
      { type: 'udp', tag: 'dns_resolver', server: '223.5.5.5' },
      { type: 'fakeip', tag: 'dns_fakeip', inet4_range: '198.18.0.0/15', inet6_range: 'fc00::/18' },
    ],
    rules: [
      { rule_set: 'geolocation-!cn', query_type: ['A', 'AAAA'], server: 'dns_fakeip' },
      { rule_set: 'geolocation-!cn', query_type: 'CNAME', server: 'dns_proxy' },
      { query_type: ['A', 'AAAA', 'CNAME'], invert: true, action: 'predefined', rcode: 'REFUSED' },
    ],
    final: 'dns_direct',
    independent_cache: true,
  },
  ntp: { enabled: true, server: 'time.apple.com', server_port: 123, interval: '30m' },
  inbounds: [
    { type: 'mixed', tag: 'mixed-in', listen: '0.0.0.0', listen_port: 2080 },
    { type: 'tun', tag: 'tun-in', address: '172.19.0.1/30', auto_route: true, strict_route: true, stack: 'mixed', sniff: true },
  ],
  outbounds: [{ type: 'block', tag: 'REJECT' }, { type: 'direct', tag: 'DIRECT' }],
  route: {
    default_domain_resolver: 'dns_resolver',
    rule_set: [{ tag: 'geosite-geolocation-!cn', type: 'local', format: 'binary', path: 'geosite-geolocation-!cn.srs' }],
    rules: [],
  },
  experimental: { cache_file: { enabled: true, store_fakeip: true } },
};

// Clash基础配置
export const CLASH_CONFIG = {
  port: 7890,
  'socks-port': 7891,
  'allow-lan': false,
  mode: 'rule',
  'log-level': 'info',
  'geodata-mode': true,
  'geo-auto-update': true,
  'geodata-loader': 'standard',
  'geo-update-interval': 24,
  'geox-url': {
    geoip: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat',
    geosite: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat',
    mmdb: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb',
    asn: 'https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb',
  },
  'rule-providers': {},
  dns: {
    enable: true,
    ipv6: true,
    'respect-rules': true,
    'enhanced-mode': 'fake-ip',
    nameserver: ['https://120.53.53.53/dns-query', 'https://223.5.5.5/dns-query'],
    'proxy-server-nameserver': ['https://120.53.53.53/dns-query', 'https://223.5.5.5/dns-query'],
    'nameserver-policy': {
      'geosite:cn,private': ['https://120.53.53.53/dns-query', 'https://223.5.5.5/dns-query'],
      'geosite:geolocation-!cn': ['https://dns.cloudflare.com/dns-query', 'https://dns.google/dns-query'],
    },
  },
  proxies: [],
  'proxy-groups': [],
};

// Surge基础配置
export const SURGE_CONFIG = {
  general: {
    'allow-wifi-access': false,
    'wifi-access-http-port': 6152,
    'wifi-access-socks5-port': 6153,
    'http-listen': '127.0.0.1:6152',
    'socks5-listen': '127.0.0.1:6153',
    'allow-hotspot-access': false,
    'skip-proxy': '127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,100.64.0.0/10,17.0.0.0/8,localhost,*.local,*.crashlytics.com,seed-sequoia.siri.apple.com,sequoia.apple.com',
    'test-timeout': 5,
    'proxy-test-url': 'http://cp.cloudflare.com/generate_204',
    'internet-test-url': 'http://www.apple.com/library/test/success.html',
    'geoip-maxmind-url': 'https://raw.githubusercontent.com/Loyalsoldier/geoip/release/Country.mmdb',
    'ipv6': false,
    'show-error-page-for-reject': true,
    'dns-server': '119.29.29.29, 180.184.1.1, 223.5.5.5, system',
    'encrypted-dns-server': 'https://223.5.5.5/dns-query',
    'exclude-simple-hostnames': true,
    'read-etc-hosts': true,
    'always-real-ip': '*.msftconnecttest.com, *.msftncsi.com, *.srv.nintendo.net, *.stun.playstation.net, xbox.*.microsoft.com, *.xboxlive.com, *.logon.battlenet.com.cn, *.logon.battle.net, stun.l.google.com, easy-login.10099.com.cn,*-update.xoyocdn.com, *.prod.cloud.netflix.com, appboot.netflix.com, *-appboot.netflix.com',
    'hijack-dns': '*:53',
    'udp-policy-not-supported-behaviour': 'REJECT',
    'hide-vpn-icon': false,
  },
  replica: {
    'hide-apple-request': true,
    'hide-crashlytics-request': true,
    'use-keyword-filter': false,
    'hide-udp': false,
  },
  rules: [],
};
