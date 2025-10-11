import { t } from './i18n';

// Constants
export const RULE_TYPES = {
  SITE: 'site',
  IP: 'ip'
};

export const CONFIG_TYPES = {
  SING_BOX: 'sing-box',
  CLASH: 'clash',
  SURGE: 'surge'
};

// Base URLs for different rule sources
export const RULE_SET_BASE_URLS = {
  [CONFIG_TYPES.SING_BOX]: {
    [RULE_TYPES.SITE]: 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geosite/',
    [RULE_TYPES.IP]: 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geoip/'
  },
  [CONFIG_TYPES.CLASH]: {
    [RULE_TYPES.SITE]: 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/',
    [RULE_TYPES.IP]: 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/'
  },
  [CONFIG_TYPES.SURGE]: {
    [RULE_TYPES.SITE]: 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geosite/',
    [RULE_TYPES.IP]: 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geoip/'
  }
};

// 添加缺失的导出 - 保持与之前代码的兼容性
export const SITE_RULE_SET_BASE_URL = RULE_SET_BASE_URLS[CONFIG_TYPES.SING_BOX][RULE_TYPES.SITE];
export const IP_RULE_SET_BASE_URL = RULE_SET_BASE_URLS[CONFIG_TYPES.SING_BOX][RULE_TYPES.IP];
export const CLASH_SITE_RULE_SET_BASE_URL = RULE_SET_BASE_URLS[CONFIG_TYPES.CLASH][RULE_TYPES.SITE];
export const CLASH_IP_RULE_SET_BASE_URL = RULE_SET_BASE_URLS[CONFIG_TYPES.CLASH][RULE_TYPES.IP];
export const SURGE_SITE_RULE_SET_BASEURL = RULE_SET_BASE_URLS[CONFIG_TYPES.SURGE][RULE_TYPES.SITE];
export const SURGE_IP_RULE_SET_BASEURL = RULE_SET_BASE_URLS[CONFIG_TYPES.SURGE][RULE_TYPES.IP];

// File extensions for different config types
export const FILE_EXTENSIONS = {
  [CONFIG_TYPES.SING_BOX]: 'srs',
  [CONFIG_TYPES.CLASH]: 'mrs'
};

// Custom rules
export const CUSTOM_RULES = [];

// Unified rule structure
export const UNIFIED_RULES = Object.freeze([
  {
    name: 'Ad Block',
    outbound: t('outboundNames.Ad Block'),
    site_rules: ['category-ads-all'],
    ip_rules: [],
    priority: 100
  },
  {
    name: 'AI Services',
    outbound: t('outboundNames.AI Services'),
    site_rules: ['category-ai-!cn'],
    ip_rules: [],
    priority: 90
  },
  {
    name: 'Bilibili',
    outbound: t('outboundNames.Bilibili'),
    site_rules: ['bilibili'],
    ip_rules: [],
    priority: 80
  },
  {
    name: 'Youtube',
    outbound: t('outboundNames.Youtube'),
    site_rules: ['youtube'],
    ip_rules: [],
    priority: 80
  },
  {
    name: 'Google',
    outbound: t('outboundNames.Google'),
    site_rules: ['google'],
    ip_rules: ['google'],
    priority: 80
  },
  {
    name: 'Private',
    outbound: t('outboundNames.Private'),
    site_rules: [],
    ip_rules: ['private'],
    priority: 1000
  },
  {
    name: 'Location:CN',
    outbound: t('outboundNames.Location:CN'),
    site_rules: ['geolocation-cn', 'cn'],
    ip_rules: ['cn'],
    priority: 50
  },
  {
    name: 'Telegram',
    outbound: t('outboundNames.Telegram'),
    site_rules: [],
    ip_rules: ['telegram'],
    priority: 70
  },
  {
    name: 'Github',
    outbound: t('outboundNames.Github'),
    site_rules: ['github', 'gitlab'],
    ip_rules: [],
    priority: 70
  },
  {
    name: 'Microsoft',
    outbound: t('outboundNames.Microsoft'),
    site_rules: ['microsoft'],
    ip_rules: [],
    priority: 70
  },
  {
    name: 'Apple',
    outbound: t('outboundNames.Apple'),
    site_rules: ['apple'],
    ip_rules: [],
    priority: 70
  },
  {
    name: 'Social Media',
    outbound: t('outboundNames.Social Media'),
    site_rules: ['facebook', 'instagram', 'twitter', 'tiktok', 'linkedin'],
    ip_rules: [],
    priority: 60
  },
  {
    name: 'Streaming',
    outbound: t('outboundNames.Streaming'),
    site_rules: ['netflix', 'hulu', 'disney', 'hbo', 'amazon', 'bahamut'],
    ip_rules: [],
    priority: 60
  },
  {
    name: 'Gaming',
    outbound: t('outboundNames.Gaming'),
    site_rules: ['steam', 'epicgames', 'ea', 'ubisoft', 'blizzard'],
    ip_rules: [],
    priority: 60
  },
  {
    name: 'Education',
    outbound: t('outboundNames.Education'),
    site_rules: ['coursera', 'edx', 'udemy', 'khanacademy', 'category-scholar-!cn'],
    ip_rules: [],
    priority: 60
  },
  {
    name: 'Financial',
    outbound: t('outboundNames.Financial'),
    site_rules: ['paypal', 'visa', 'mastercard', 'stripe', 'wise'],
    ip_rules: [],
    priority: 60
  },
  {
    name: 'Cloud Services',
    outbound: t('outboundNames.Cloud Services'),
    site_rules: ['aws', 'azure', 'digitalocean', 'heroku', 'dropbox'],
    ip_rules: [],
    priority: 60
  },
  {
    name: 'Non-China',
    outbound: t('outboundNames.Non-China'),
    site_rules: ['geolocation-!cn'],
    ip_rules: [],
    priority: 10
  }
]);

// Predefined rule sets
export const PREDEFINED_RULE_SETS = Object.freeze({
  minimal: ['Location:CN', 'Private', 'Non-China'],
  balanced: ['Location:CN', 'Private', 'Non-China', 'Github', 'Google', 'Youtube', 'AI Services', 'Telegram'],
  comprehensive: UNIFIED_RULES.map(rule => rule.name)
});

// Helper functions
export const RuleUtils = {
  /**
   * Normalize selected rules array
   */
  normalizeSelectedRules(selectedRules) {
    if (typeof selectedRules === 'string') {
      return PREDEFINED_RULE_SETS[selectedRules] || PREDEFINED_RULE_SETS.minimal;
    }
    
    if (!Array.isArray(selectedRules) || selectedRules.length === 0) {
      return PREDEFINED_RULE_SETS.minimal;
    }
    
    return selectedRules;
  },

  /**
   * Parse comma-separated string to array
   */
  parseCommaSeparated(str, fallback = []) {
    if (!str || typeof str !== 'string') return fallback;
    return str.split(',').map(s => s.trim()).filter(Boolean);
  },

  /**
   * Validate custom rule object
   */
  validateCustomRule(rule) {
    if (!rule || typeof rule !== 'object') return false;
    if (!rule.name || typeof rule.name !== 'string') return false;
    return true;
  }
};

// Generate rule set mappings
export const generateRuleSetMappings = (configType) => {
  const extension = FILE_EXTENSIONS[configType];
  
  const siteRuleSets = {};
  const ipRuleSets = {};

  UNIFIED_RULES.forEach(rule => {
    rule.site_rules.forEach(siteRule => {
      const fileName = configType === CONFIG_TYPES.SING_BOX ? `geosite-${siteRule}.${extension}` : `${siteRule}.${extension}`;
      siteRuleSets[siteRule] = fileName;
    });

    rule.ip_rules.forEach(ipRule => {
      const fileName = configType === CONFIG_TYPES.SING_BOX ? `geoip-${ipRule}.${extension}` : `${ipRule}.${extension}`;
      ipRuleSets[ipRule] = fileName;
    });
  });

  return { siteRuleSets, ipRuleSets };
};

// Get rule set mappings for different config types
export const SING_BOX_RULE_SETS = generateRuleSetMappings(CONFIG_TYPES.SING_BOX);
export const CLASH_RULE_SETS = generateRuleSetMappings(CONFIG_TYPES.CLASH);

// 保持向后兼容的导出
export const SITE_RULE_SETS = SING_BOX_RULE_SETS.siteRuleSets;
export const IP_RULE_SETS = SING_BOX_RULE_SETS.ipRuleSets;
export const CLASH_SITE_RULE_SETS = CLASH_RULE_SETS.siteRuleSets;
export const CLASH_IP_RULE_SETS = CLASH_RULE_SETS.ipRuleSets;

/**
 * Get outbounds based on selected rule names
 */
export function getOutbounds(selectedRuleNames) {
  const normalizedRules = RuleUtils.normalizeSelectedRules(selectedRuleNames);
  
  return UNIFIED_RULES
    .filter(rule => normalizedRules.includes(rule.name))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .map(rule => rule.name);
}

/**
 * Generate routing rules based on selected rules
 */
export function generateRules(selectedRules = [], customRules = []) {
  const normalizedRules = RuleUtils.normalizeSelectedRules(selectedRules);
  const rules = [];

  // Add unified rules (sorted by priority)
  UNIFIED_RULES
    .filter(rule => normalizedRules.includes(rule.name))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .forEach(rule => {
      rules.push({
        name: rule.name,
        site_rules: rule.site_rules,
        ip_rules: rule.ip_rules,
        domain_suffix: rule.domain_suffix,
        ip_cidr: rule.ip_cidr,
        outbound: rule.name,
        priority: rule.priority
      });
    });

  // Add custom rules (highest priority)
  customRules
    .filter(RuleUtils.validateCustomRule)
    .reverse()
    .forEach(rule => {
      rules.unshift({
        name: rule.name,
        site_rules: RuleUtils.parseCommaSeparated(rule.site),
        ip_rules: RuleUtils.parseCommaSeparated(rule.ip),
        domain_suffix: RuleUtils.parseCommaSeparated(rule.domain_suffix),
        domain_keyword: RuleUtils.parseCommaSeparated(rule.domain_keyword),
        ip_cidr: RuleUtils.parseCommaSeparated(rule.ip_cidr),
        protocol: RuleUtils.parseCommaSeparated(rule.protocol),
        outbound: rule.name,
        priority: 10000 // Highest priority for custom rules
      });
    });

  return rules;
}

/**
 * Generate rule sets for Sing-box configuration
 */
export function generateRuleSets(selectedRules = [], customRules = []) {
  const normalizedRules = RuleUtils.normalizeSelectedRules(selectedRules);
  const selectedRulesSet = new Set(normalizedRules);

  const siteRuleSets = new Map();
  const ipRuleSets = new Map();

  // Add unified rules
  UNIFIED_RULES.forEach(rule => {
    if (selectedRulesSet.has(rule.name)) {
      rule.site_rules.forEach(siteRule => {
        if (!siteRuleSets.has(siteRule)) {
          siteRuleSets.set(siteRule, {
            tag: siteRule,
            type: 'remote',
            format: 'binary',
            url: `${RULE_SET_BASE_URLS[CONFIG_TYPES.SING_BOX][RULE_TYPES.SITE]}${SING_BOX_RULE_SETS.siteRuleSets[siteRule]}`
          });
        }
      });

      rule.ip_rules.forEach(ipRule => {
        const tag = `${ipRule}-ip`;
        if (!ipRuleSets.has(tag)) {
          ipRuleSets.set(tag, {
            tag,
            type: 'remote',
            format: 'binary',
            url: `${RULE_SET_BASE_URLS[CONFIG_TYPES.SING_BOX][RULE_TYPES.IP]}${SING_BOX_RULE_SETS.ipRuleSets[ipRule]}`
          });
        }
      });
    }
  });

  // Add Non-China rule set if not included
  if (!selectedRulesSet.has('Non-China')) {
    const nonChinaTag = 'geolocation-!cn';
    if (!siteRuleSets.has(nonChinaTag)) {
      siteRuleSets.set(nonChinaTag, {
        tag: nonChinaTag,
        type: 'remote',
        format: 'binary',
        url: `${RULE_SET_BASE_URLS[CONFIG_TYPES.SING_BOX][RULE_TYPES.SITE]}geosite-geolocation-!cn.srs`
      });
    }
  }

  // Add custom rules
  customRules
    .filter(RuleUtils.validateCustomRule)
    .forEach(rule => {
      RuleUtils.parseCommaSeparated(rule.site).forEach(site => {
        const tag = site.trim();
        if (!siteRuleSets.has(tag)) {
          siteRuleSets.set(tag, {
            tag,
            type: 'remote',
            format: 'binary',
            url: `${RULE_SET_BASE_URLS[CONFIG_TYPES.SING_BOX][RULE_TYPES.SITE]}geosite-${tag}.srs`
          });
        }
      });

      RuleUtils.parseCommaSeparated(rule.ip).forEach(ip => {
        const tag = `${ip.trim()}-ip`;
        if (!ipRuleSets.has(tag)) {
          ipRuleSets.set(tag, {
            tag,
            type: 'remote',
            format: 'binary',
            url: `${RULE_SET_BASE_URLS[CONFIG_TYPES.SING_BOX][RULE_TYPES.IP]}geoip-${ip.trim()}.srs`
          });
        }
      });
    });

  return {
    site_rule_sets: Array.from(siteRuleSets.values()),
    ip_rule_sets: Array.from(ipRuleSets.values())
  };
}

/**
 * Generate rule sets for Clash configuration
 */
export function generateClashRuleSets(selectedRules = [], customRules = []) {
  const normalizedRules = RuleUtils.normalizeSelectedRules(selectedRules);
  const selectedRulesSet = new Set(normalizedRules);

  const siteRuleProviders = {};
  const ipRuleProviders = {};

  // Add unified rules
  UNIFIED_RULES.forEach(rule => {
    if (selectedRulesSet.has(rule.name)) {
      rule.site_rules.forEach(siteRule => {
        if (!siteRuleProviders[siteRule]) {
          siteRuleProviders[siteRule] = {
            type: 'http',
            format: 'mrs',
            behavior: 'domain',
            url: `${RULE_SET_BASE_URLS[CONFIG_TYPES.CLASH][RULE_TYPES.SITE]}${CLASH_RULE_SETS.siteRuleSets[siteRule]}`,
            path: `./ruleset/${CLASH_RULE_SETS.siteRuleSets[siteRule]}`,
            interval: 86400
          };
        }
      });

      rule.ip_rules.forEach(ipRule => {
        if (!ipRuleProviders[ipRule]) {
          ipRuleProviders[ipRule] = {
            type: 'http',
            format: 'mrs',
            behavior: 'ipcidr',
            url: `${RULE_SET_BASE_URLS[CONFIG_TYPES.CLASH][RULE_TYPES.IP]}${CLASH_RULE_SETS.ipRuleSets[ipRule]}`,
            path: `./ruleset/${CLASH_RULE_SETS.ipRuleSets[ipRule]}`,
            interval: 86400
          };
        }
      });
    }
  });

  // Add Non-China rule set if not included
  if (!selectedRulesSet.has('Non-China')) {
    if (!siteRuleProviders['geolocation-!cn']) {
      siteRuleProviders['geolocation-!cn'] = {
        type: 'http',
        format: 'mrs',
        behavior: 'domain',
        url: `${RULE_SET_BASE_URLS[CONFIG_TYPES.CLASH][RULE_TYPES.SITE]}geolocation-!cn.mrs`,
        path: './ruleset/geolocation-!cn.mrs',
        interval: 86400
      };
    }
  }

  // Add custom rules
  customRules
    .filter(RuleUtils.validateCustomRule)
    .forEach(rule => {
      RuleUtils.parseCommaSeparated(rule.site).forEach(site => {
        const siteTrimmed = site.trim();
        if (!siteRuleProviders[siteTrimmed]) {
          siteRuleProviders[siteTrimmed] = {
            type: 'http',
            format: 'mrs',
            behavior: 'domain',
            url: `${RULE_SET_BASE_URLS[CONFIG_TYPES.CLASH][RULE_TYPES.SITE]}${siteTrimmed}.mrs`,
            path: `./ruleset/${siteTrimmed}.mrs`,
            interval: 86400
          };
        }
      });

      RuleUtils.parseCommaSeparated(rule.ip).forEach(ip => {
        const ipTrimmed = ip.trim();
        if (!ipRuleProviders[ipTrimmed]) {
          ipRuleProviders[ipTrimmed] = {
            type: 'http',
            format: 'mrs',
            behavior: 'ipcidr',
            url: `${RULE_SET_BASE_URLS[CONFIG_TYPES.CLASH][RULE_TYPES.IP]}${ipTrimmed}.mrs`,
            path: `./ruleset/${ipTrimmed}.mrs`,
            interval: 86400
          };
        }
      });
    });

  return {
    site_rule_providers: siteRuleProviders,
    ip_rule_providers: ipRuleProviders
  };
}

// 节点配置 - 保持你要求的显示顺序
export const PROXY_NODES = [
  {
    name: '🚀 节点选择',
    type: 'select',
    tag: 'node-selector'
  },
  {
    name: 'Selector',
    type: 'select', 
    tag: 'selector'
  },
  {
    name: 'DIRECT',
    type: 'direct',
    tag: 'DIRECT'
  },
  {
    name: 'REJECT',
    type: 'block',
    tag: 'REJECT'
  },
  {
    name: '⚡ 自动选择',
    type: 'url-test',
    tag: 'auto-select'
  }
];

// 自定义域名列表
export const CUSTOM_DOMAINS = [
  'visa.com.hk',
  'ip.sb',
  'icook.tw',
  'cf.877771.xyz',
  'skk.moe',
  'cdn.tzpro.xyz',
  'bestcf.top',
  'cf.090227.xyz',
  'cf.zhetengsha.eu.org'
];

/**
 * 生成完整的 Clash 配置 - 自动选择节点
 */
export function generateClashConfig(selectedRules = [], customRules = [], proxies = []) {
  const ruleProviders = generateClashRuleSets(selectedRules, customRules);
  
  // 创建代理组配置
  const proxyGroups = [
    // 主选择组 - 默认使用自动选择
    {
      name: '🚀 节点选择',
      type: 'select',
      // 将"⚡ 自动选择"放在第一位，作为默认选项
      proxies: [
        '⚡ 自动选择',  // 默认自动选择
        'Selector',
        'DIRECT',
        'REJECT',
        ...proxies.map(p => p.name)
      ]
    },
    // 自动选择组 - 自动测试并选择最快的节点
    {
      name: '⚡ 自动选择',
      type: 'url-test',
      proxies: proxies.map(p => p.name),
      url: 'http://www.gstatic.com/generate_204',
      interval: 300
    },
    // 选择器组 - 提供手动选择选项
    {
      name: 'Selector',
      type: 'select',
      proxies: [
        '⚡ 自动选择',
        'DIRECT',
        'REJECT',
        ...proxies.map(p => p.name)
      ]
    }
  ];

  const config = {
    ...CLASH_CONFIG,
    proxies: [...proxies],
    'proxy-groups': proxyGroups,
    'rule-providers': ruleProviders.site_rule_providers
  };

  // 添加 IP 规则提供商
  if (Object.keys(ruleProviders.ip_rule_providers).length > 0) {
    config['rule-providers'] = {
      ...config['rule-providers'],
      ...ruleProviders.ip_rule_providers
    };
  }

  // 生成规则 - 默认路由到自动选择
  const rules = [
    // 自定义域名规则 - 自动使用最快的节点
    ...CUSTOM_DOMAINS.map(domain => `DOMAIN,${domain},🚀 节点选择`),
    // 国内流量直连
    'GEOIP,CN,DIRECT',
    // 最终规则 - 自动选择节点
    'MATCH,🚀 节点选择'
  ];

  config.rules = rules;

  return config;
}

/**
 * 生成完整的 Sing-box 配置 - 自动选择节点
 */
export function generateSingBoxConfig(selectedRules = [], customRules = [], nodes = []) {
  const ruleSets = generateRuleSets(selectedRules, customRules);
  
  const config = {
    ...SING_BOX_CONFIG,
    outbounds: [
      ...SING_BOX_CONFIG.outbounds,
      ...PROXY_NODES,
      ...nodes
    ],
    route: {
      ...SING_BOX_CONFIG.route,
      rule_set: [
        ...SING_BOX_CONFIG.route.rule_set,
        ...ruleSets.site_rule_sets,
        ...ruleSets.ip_rule_sets
      ],
      rules: [
        // 自定义域名规则
        ...CUSTOM_DOMAINS.map(domain => ({
          domain: [domain],
          outbound: '🚀 节点选择'
        })),
        // 其他规则
        ...generateRules(selectedRules, customRules),
        // 最终规则 - 自动选择节点
        {
          outbound: '🚀 节点选择'
        }
      ]
    }
  };

  return config;
}

// 为 Sing-box 添加自动选择负载均衡
export function generateAutoSelectOutbound(proxies) {
  return {
    type: 'urltest',
    tag: '⚡ 自动选择',
    outbounds: proxies.map(p => p.tag),
    url: 'https://www.gstatic.com/generate_204',
    interval: '5m'
  };
}

// Configuration templates
export const SING_BOX_CONFIG = Object.freeze({
  dns: {
    servers: [
      {
        type: "tcp",
        tag: "dns_proxy",
        server: "1.1.1.1",
        detour: "🚀 节点选择",
        domain_resolver: "dns_resolver"
      },
      {
        type: "https",
        tag: "dns_direct",
        server: "dns.alidns.com",
        domain_resolver: "dns_resolver"
      },
      {
        type: "udp",
        tag: "dns_resolver",
        server: "223.5.5.5"
      },
      {
        type: "fakeip",
        tag: "dns_fakeip",
        inet4_range: "198.18.0.0/15",
        inet6_range: "fc00::/18"
      }
    ],
    rules: [
      {
        rule_set: "geolocation-!cn",
        query_type: ["A", "AAAA"],
        server: "dns_fakeip"
      },
      {
        rule_set: "geolocation-!cn",
        query_type: "CNAME",
        server: "dns_proxy"
      },
      {
        query_type: ["A", "AAAA", "CNAME"],
        invert: true,
        action: "predefined",
        rcode: "REFUSED"
      }
    ],
    final: "dns_direct",
    independent_cache: true
  },
  ntp: {
    enabled: true,
    server: 'time.apple.com',
    server_port: 123,
    interval: '30m'
  },
  inbounds: [
    { type: 'mixed', tag: 'mixed-in', listen: '0.0.0.0', listen_port: 2080 },
    { type: 'tun', tag: 'tun-in', address: '172.19.0.1/30', auto_route: true, strict_route: true, stack: 'mixed', sniff: true }
  ],
  outbounds: [
    { type: 'block', tag: 'REJECT' },
    { type: "direct", tag: 'DIRECT' }
  ],
  route: {
    default_domain_resolver: "dns_resolver",
    rule_set: [
      {
        tag: "geosite-geolocation-!cn",
        type: "local",
        format: "binary",
        path: "geosite-geolocation-!cn.srs"
      }
    ],
    rules: []
  },
  experimental: {
    cache_file: {
      enabled: true,
      store_fakeip: true
    }
  }
});

export const CLASH_CONFIG = Object.freeze({
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
    geoip: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat",
    geosite: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
    mmdb: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb",
    asn: "https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb"
  },
  'rule-providers': {},
  dns: {
    enable: true,
    ipv6: true,
    respect_rules: true,
    'enhanced-mode': 'fake-ip',
    nameserver: [
      'https://120.53.53.53/dns-query',
      'https://223.5.5.5/dns-query'
    ],
    'proxy-server-nameserver': [
      'https://120.53.53.53/dns-query',
      'https://223.5.5.5/dns-query'
    ],
    'nameserver-policy': {
      'geosite:cn,private': [
        'https://120.53.53.53/dns-query',
        'https://223.5.5.5/dns-query'
      ],
      'geosite:geolocation-!cn': [
        'https://dns.cloudflare.com/dns-query',
        'https://dns.google/dns-query'
      ]
    }
  },
  proxies: [],
  'proxy-groups': []
});

export const SURGE_CONFIG = Object.freeze({
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
    ipv6: false,
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
    'hide-udp': false
  }
});

// Export default configurations
export default {
  RULE_TYPES,
  CONFIG_TYPES,
  UNIFIED_RULES,
  PREDEFINED_RULE_SETS,
  RuleUtils,
  generateRules,
  generateRuleSets,
  generateClashRuleSets,
  getOutbounds,
  SING_BOX_CONFIG,
  CLASH_CONFIG,
  SURGE_CONFIG,
  // 新增导出
  PROXY_NODES,
  CUSTOM_DOMAINS,
  generateClashConfig,
  generateSingBoxConfig,
  generateAutoSelectOutbound
};
