import { t } from './i18n';

// ========================== 1. 常量抽取：统一维护可配置项 ==========================
// 规则集远程地址（按工具分类，结构更清晰）
export const RULE_SET_BASE_URLS = {
  singBox: {
    site: 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geosite/',
    ip: 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geoip/',
    suffix: 'srs', // 规则文件后缀
  },
  clash: {
    site: 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/',
    ip: 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/',
    suffix: 'mrs', // 规则文件后缀
  },
  surge: {
    site: 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geosite/',
    ip: 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geoip/',
    suffix: 'dat', // Surge规则文件后缀
  },
};

// 预设规则组合（增加描述，提升可读性）
export const PREDEFINED_RULE_SETS = {
  minimal: {
    name: '轻量模式',
    desc: '仅覆盖基础代理需求（中国站点、私有IP、非中国站点）',
    rules: ['Location:CN', 'Private', 'Non-China'],
  },
  balanced: {
    name: '平衡模式',
    desc: '覆盖常用海外服务（含Github、Google、Youtube等）',
    rules: ['Location:CN', 'Private', 'Non-China', 'Github', 'Google', 'Youtube', 'AI Services', 'Telegram'],
  },
  comprehensive: {
    name: '完整模式',
    desc: '覆盖所有场景（广告、流媒体、游戏、金融等）',
    rules: [], // 动态关联UNIFIED_RULES所有规则
  },
};

// 自定义规则默认字段（避免解构时undefined）
export const DEFAULT_CUSTOM_RULE = {
  site: '',
  ip: '',
  domain_suffix: '',
  domain_keyword: '',
  ip_cidr: '',
  protocol: '',
  name: '自定义规则',
};

// 工具配置常量（缓存路径、更新间隔等）
export const TOOL_CONSTANTS = {
  clash: {
    ruleUpdateInterval: 86400, // 规则更新间隔（秒）= 1天
    ruleCachePath: './ruleset/', // 规则本地缓存路径
  },
  surge: {
    ruleCachePath: './Surge/Rules/', // Surge规则缓存路径
  },
};

// ========================== 2. 核心规则定义：增加优先级，支持动态排序 ==========================
/**
 * 统一规则列表
 * @property {string} name - 规则唯一标识
 * @property {number} priority - 规则优先级（数字越小，匹配优先级越高）
 * @property {string} outbound - 规则对应出口（多语言）
 * @property {string[]} site_rules - 关联站点规则标签
 * @property {string[]} ip_rules - 关联IP规则标签
 */
export const UNIFIED_RULES = [
  {
    name: 'Ad Block',
    priority: 1, // 广告拦截优先级最高
    outbound: t('outboundNames.Ad Block'),
    site_rules: ['category-ads-all'],
    ip_rules: [],
  },
  {
    name: 'Private',
    priority: 2, // 私有IP优先匹配直连
    outbound: t('outboundNames.Private'),
    site_rules: [],
    ip_rules: ['private'],
  },
  {
    name: 'Location:CN',
    priority: 3, // 中国站点优先直连
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
    priority: 5, // 即时通讯优先代理
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
    priority: 100, // 非中国站点作为兜底规则，优先级最低
    outbound: t('outboundNames.Non-China'),
    site_rules: ['geolocation-!cn'],
    ip_rules: [],
  },
];

// 动态填充完整模式的规则（避免硬编码重复）
PREDEFINED_RULE_SETS.comprehensive.rules = UNIFIED_RULES.map(rule => rule.name);

// ========================== 3. 公共工具函数：提取重复逻辑，减少冗余 ==========================
/**
 * 公共函数：处理选中的规则（兼容预设名称/数组，默认返回轻量模式）
 * @param {string|string[]} selectedRules - 选中的规则（预设名称或规则名数组）
 * @returns {string[]} 处理后的规则名数组
 */
const processSelectedRules = (selectedRules) => {
  // 1. 类型守卫：避免非预期类型
  if (typeof selectedRules === 'string') {
    // 若为预设名称，返回对应规则数组
    return PREDEFINED_RULE_SETS[selectedRules]?.rules || PREDEFINED_RULE_SETS.minimal.rules;
  }
  // 若为数组，过滤空值并去重；否则返回默认轻量模式
  return Array.isArray(selectedRules) 
    ? [...new Set(selectedRules.filter(Boolean))] 
    : PREDEFINED_RULE_SETS.minimal.rules;
};

/**
 * 公共函数：解析自定义规则（处理空值、去重、格式统一）
 * @param {Partial<typeof DEFAULT_CUSTOM_RULE>[]} customRules - 原始自定义规则
 * @returns {typeof DEFAULT_CUSTOM_RULE[]} 标准化后的自定义规则
 */
const normalizeCustomRules = (customRules = []) => {
  return customRules
    .map(rule => ({ ...DEFAULT_CUSTOM_RULE, ...rule })) // 补全默认字段
    .filter(rule => {
      // 过滤无实际规则的条目（所有字段都为空）
      const hasRule = Object.values(rule).some(val => 
        typeof val === 'string' ? val.trim() !== '' : Array.isArray(val) ? val.length > 0 : false
      );
      return hasRule;
    })
    .map(rule => {
      // 统一处理：字符串转数组（去空、去重）
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

// ========================== 4. 核心功能函数：修复bug，优化逻辑 ==========================
/**
 * 获取选中规则对应的出口（修复原bug：返回outbound而非name）
 * @param {string|string[]} selectedRules - 选中的规则
 * @returns {string[]} 出口名称数组（多语言）
 */
export function getOutbounds(selectedRules) {
  const processedRules = processSelectedRules(selectedRules);
  return UNIFIED_RULES
    .filter(rule => processedRules.includes(rule.name))
    .sort((a, b) => a.priority - b.priority) // 按优先级排序
    .map(rule => rule.outbound);
}

/**
 * 生成最终规则列表（支持优先级排序、自定义规则标准化）
 * @param {string|string[]} selectedRules - 选中的规则
 * @param {Partial<typeof DEFAULT_CUSTOM_RULE>[]} customRules - 自定义规则
 * @returns {object[]} 最终规则数组
 */
export function generateRules(selectedRules, customRules = []) {
  const processedRules = processSelectedRules(selectedRules);
  const normalizedCustomRules = normalizeCustomRules(customRules);

  // 1. 筛选并排序默认规则（按优先级）
  const defaultRules = UNIFIED_RULES
    .filter(rule => processedRules.includes(rule.name))
    .sort((a, b) => a.priority - b.priority)
    .map(rule => ({
      site_rules: rule.site_rules,
      ip_rules: rule.ip_rules,
      domain_suffix: rule?.domain_suffix || [],
      ip_cidr: rule?.ip_cidr || [],
      outbound: rule.outbound, // 修复原bug：使用outbound而非name
      priority: rule.priority,
    }));

  // 2. 处理自定义规则（优先级高于默认规则，按输入顺序倒序）
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
      priority: 0 - index, // 自定义规则优先级：越后添加的优先级越高
    }));

  // 3. 合并规则（自定义在前，默认在后，按优先级排序）
  return [...finalCustomRules, ...defaultRules].sort((a, b) => a.priority - b.priority);
}

// ========================== 5. 工具专属规则生成：补充Surge，统一逻辑 ==========================
/**
 * 生成Sing-Box规则集配置
 * @param {string|string[]} selectedRules - 选中的规则
 * @param {Partial<typeof DEFAULT_CUSTOM_RULE>[]} customRules - 自定义规则
 * @returns {{ site_rule_sets: object[], ip_rule_sets: object[] }} Sing-Box规则集
 */
export function generateSingBoxRuleSets(selectedRules, customRules = []) {
  const processedRules = processSelectedRules(selectedRules);
  const normalizedCustomRules = normalizeCustomRules(customRules);
  const { site: siteBaseUrl, ip: ipBaseUrl, suffix } = RULE_SET_BASE_URLS.singBox;

  // 1. 收集默认规则的标签（去重）
  const selectedRuleSet = new Set(processedRules);
  const siteTags = new Set();
  const ipTags = new Set();

  UNIFIED_RULES.forEach(rule => {
    if (selectedRuleSet.has(rule.name)) {
      rule.site_rules.forEach(tag => siteTags.add(tag));
      rule.ip_rules.forEach(tag => ipTags.add(tag));
    }
  });

  // 2. 强制添加Non-China规则（若未选中）
  if (!selectedRuleSet.has('Non-China')) {
    siteTags.add('geolocation-!cn');
  }

  // 3. 生成默认规则集
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

  // 4. 追加自定义规则集
  normalizedCustomRules.forEach(rule => {
    // 自定义站点规则
    rule.site.forEach(tag => {
      siteRuleSets.push({
        tag,
        type: 'remote',
        format: 'binary',
        url: `${siteBaseUrl}geosite-${tag}.${suffix}`,
      });
    });
    // 自定义IP规则
    rule.ip.forEach(tag => {
      ipRuleSets.push({
        tag: `${tag}-ip`,
        type: 'remote',
        format: 'binary',
        url: `${ipBaseUrl}geoip-${tag}.${suffix}`,
      });
    });
  });

  // 去重（避免自定义规则与默认规则重复）
  siteRuleSets = [...new Map(siteRuleSets.map(item => [item.tag, item])).values()];
  ipRuleSets = [...new Map(ipRuleSets.map(item => [item.tag, item])).values()];

  return { site_rule_sets: siteRuleSets, ip_rule_sets: ipRuleSets };
}

/**
 * 生成Clash规则集配置（Rule Providers）
 * @param {string|string[]} selectedRules - 选中的规则
 * @param {Partial<typeof DEFAULT_CUSTOM_RULE>[]} customRules - 自定义规则
 * @returns {{ site_rule_providers: object, ip_rule_providers: object }} Clash规则集
 */
export function generateClashRuleSets(selectedRules, customRules = []) {
  const processedRules = processSelectedRules(selectedRules);
  const normalizedCustomRules = normalizeCustomRules(customRules);
  const { site: siteBaseUrl, ip: ipBaseUrl, suffix } = RULE_SET_BASE_URLS.clash;
  const { ruleUpdateInterval, ruleCachePath } = TOOL_CONSTANTS.clash;

  // 1. 收集默认规则的标签（去重）
  const selectedRuleSet = new Set(processedRules);
  const siteTags = new Set();
  const ipTags = new Set();

  UNIFIED_RULES.forEach(rule => {
    if (selectedRuleSet.has(rule.name)) {
      rule.site_rules.forEach(tag => siteTags.add(tag));
      rule.ip_rules.forEach(tag => ipTags.add(tag));
    }
  });

  // 2. 强制添加Non-China规则（若未选中）
  if (!selectedRuleSet.has('Non-China')) {
    siteTags.add('geolocation-!cn');
  }

  // 3. 生成默认规则提供者
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

  // 4. 追加自定义规则提供者（去重）
  normalizedCustomRules.forEach(rule => {
    // 自定义站点规则
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
    // 自定义IP规则
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

/**
 * 新增：生成Surge规则集配置（补充原代码缺失功能）
 * @param {string|string[]} selectedRules - 选中的规则
 * @param {Partial<typeof DEFAULT_CUSTOM_RULE>[]} customRules - 自定义规则
 * @returns {{ site_rules: object[], ip_rules: object[] }} Surge规则集
 */
export function generateSurgeRuleSets(selectedRules, customRules = []) {
  const processedRules = processSelectedRules(selectedRules);
  const normalizedCustomRules = normalizeCustomRules(customRules);
  const { site: siteBaseUrl, ip: ipBaseUrl, suffix } = RULE_SET_BASE_URLS.surge;
  const { ruleCachePath } = TOOL_CONSTANTS.surge;

  // 1. 收集默认规则的标签（去重）
  const selectedRuleSet = new Set(processedRules);
  const siteTags = new Set();
  const ipTags = new Set();

  UNIFIED_RULES.forEach(rule => {
    if (selectedRuleSet.has(rule.name)) {
      rule.site_rules.forEach(tag => siteTags.add(tag));
      rule.ip_rules.forEach(tag => ipTags.add(tag));
    }
  });

  // 2. 强制添加Non-China规则（若未选中）
  if (!selectedRuleSet.has('Non-China')) {
    siteTags.add('geolocation-!cn');
  }

  // 3. 生成默认规则集（Surge规则格式：remote-rule）
  const generateSurgeRule = (tags, baseUrl, type) => {
    return Array.from(tags).map(tag => ({
      tag: `${type}-${tag}`,
      type: 'remote-rule',
      url: `${baseUrl}${tag}.${suffix}`,
      path: `${ruleCachePath}${type}-${tag}.${suffix}`,
      update_interval: 86400, // 1天更新一次
    }));
  };

  let siteRules = generateSurgeRule(siteTags, siteBaseUrl, 'geosite');
  let ipRules = generateSurgeRule(ipTags, ipBaseUrl, 'geoip');

  // 4. 追加自定义规则集（去重）
  normalizedCustomRules.forEach(rule => {
    // 自定义站点规则
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
    // 自定义IP规则
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

// ========================== 6. 工具基础配置：优化结构，补充注释 ==========================
/**
 * Sing-Box基础配置模板
 * 动态规则将注入 route.rule_set 和 route.rules
 */
export const SING_BOX_CONFIG = {
  dns: {
    servers: [
      {
        type: 'tcp',
        tag: 'dns_proxy',
        server: '1.1.1.1', // Cloudflare DNS（代理后使用）
        detour: '🚀 节点选择', // 代理出口标签（需用户配置）
        domain_resolver: 'dns_resolver',
      },
      {
        type: 'https',
        tag: 'dns_direct',
        server: 'dns.alidns.com', // 阿里DNS（直连使用）
        domain_resolver: 'dns_resolver',
      },
      {
        type: 'udp',
        tag: 'dns_resolver',
        server: '223.5.5.5', // 阿里云公共DNS（基础解析）
      },
      {
        type: 'fakeip',
        tag: 'dns_fakeip',
        inet4_range: '198.18.0.0/15',
        inet6_range: 'fc00::/18',
      },
    ],
    rules: [
      {
        rule_set: 'geolocation-!cn',
        query_type: ['A', 'AAAA'],
        server: 'dns_fakeip', // 非中国站点用fakeip解析
      },
      {
        rule_set: 'geolocation-!cn',
        query_type: 'CNAME',
        server: 'dns_proxy', // 非中国站点CNAME查询走代理
      },
      {
        query_type: ['A', 'AAAA', 'CNAME'],
        invert: true,
        action: 'predefined',
        rcode: 'REFUSED', // 拒绝非必要DNS查询
      },
    ],
    final: 'dns_direct', // 默认直连DNS
    independent_cache: true, // 开启DNS独立缓存
  },
  ntp: {
    enabled: true,
    server: 'time.apple.com', // NTP服务器（同步时间）
    server_port: 123,
    interval: '30m', // 每30分钟同步一次
  },
  inbounds: [
    { type: 'mixed', tag: 'mixed-in', listen: '0.0.0.0', listen_port: 2080 }, // 混合协议入站
    { 
      type: 'tun', 
      tag: 'tun-in', 
      address: '172.19.0.1/30', 
      auto_route: true, 
      strict_route: true, 
      stack: 'mixed', 
      sniff: true // TUN模式（全局代理）
    },
  ],
  outbounds: [
    { type: 'block', tag: 'REJECT' }, // 拦截出口
    { type: 'direct', tag: 'DIRECT' }, // 直连出口
    // 代理出口（需用户动态添加，如V2Ray、Trojan等）
  ],
  route: {
    default_domain_resolver: 'dns_resolver',
    rule_set: [
      {
        tag: 'geosite-geolocation-!cn',
        type: 'local',
        format: 'binary',
        path: 'geosite-geolocation-!cn.srs', // 本地 fallback 规则
      },
    ],
    rules: [], // 动态注入生成的规则
  },
  experimental: {
    cache_file: {
      enabled: true,
      store_fakeip: true, // 存储fakeip映射（提升性能）
    },
  },
};

/**
 * Clash基础配置模板
 * 动态规则将注入 rule-providers、proxies、proxy-groups
 */
export const CLASH_CONFIG = {
  port: 7890, // HTTP代理端口
  'socks-port': 7891, // SOCKS5代理端口
  'allow-lan': false, // 默认不允许局域网访问
  mode: 'rule', // 规则模式
  'log-level': 'info', // 日志级别
  'geodata-mode': true, // 开启Geo数据支持
  'geo-auto-update': true, // 自动更新Geo数据
  'geodata-loader': 'standard', // Geo数据加载方式
  'geo-update-interval': 24, // Geo数据更新间隔（小时）
  'geox-url': {
    geoip: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat',
    geosite: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat',
    mmdb: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb',
    asn: 'https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb',
  },
  'rule-providers': {}, // 动态注入生成的规则提供者
  dns: {
    enable: true,
    ipv6: true,
    'respect-rules': true, // 尊重路由规则选择DNS
    'enhanced-mode': 'fake-ip', // 开启fake-ip模式
    nameserver: [
      'https://120.53.53.53/dns-query', // 腾讯DNS（直连）
      'https://223.5.5.5/dns-query', // 阿里DNS（直连）
    ],
    'proxy-server-nameserver': [
      'https://120.53.53.53/dns-query',
      'https://223.5.5.5/dns-query',
    ],
    'nameserver-policy': {
      'geosite:cn,private': [
        'https://120.53.53.53/dns-query',
        'https://223.5.5.5/dns-query',
      ],
      'geosite:geolocation-!cn': [
        'https://dns.cloudflare.com/dns-query', // Cloudflare DNS（代理）
        'https://dns.google/dns-query', // Google DNS（代理）
      ],
    },
  },
  proxies: [], // 动态注入代理节点
  'proxy-groups': [], // 动态注入代理节点组
};

/**
 * Surge基础配置模板
 * 动态规则将注入 rules 字段
 */
export const SURGE_CONFIG = {
  general: {
    'allow-wifi-access': false,
    'wifi-access-http-port': 6152,
    'wifi-access-socks5-port': 6153,
    'http-listen': '127.0.0.1:6152', // HTTP代理端口
    'socks5-listen': '127.0.0.1:6153', // SOCKS5代理端口
    'allow-hotspot-access': false,
    'skip-proxy': '127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,100.64.0.0/10,17.0.0.0/8,localhost,*.local,*.crashlytics.com,seed-sequoia.siri.apple.com,sequoia.apple.com', // 跳过代理的地址
    'test-timeout': 5, // 测试超时时间（秒）
    'proxy-test-url': 'http://cp.cloudflare.com/generate_204', // 代理测试地址
    'internet-test-url': 'http://www.apple.com/library/test/success.html', // 网络测试地址
    'geoip-maxmind-url': 'https://raw.githubusercontent.com/Loyalsoldier/geoip/release/Country.mmdb', // GeoIP数据库地址
    'ipv6': false, // 默认关闭IPv6
    'show-error-page-for-reject': true, // 拦截时显示错误页
    'dns-server': '119.29.29.29, 180.184.1.1, 223.5.5.5, system', // 直连DNS
    'encrypted-dns-server': 'https://223.5.5.5/dns-query', // 加密DNS
    'exclude-simple-hostnames': true, // 排除简单主机名（如localhost）
    'read-etc-hosts': true, // 读取系统hosts文件
    'always-real-ip': '*.msftconnecttest.com, *.msftncsi.com, *.srv.nintendo.net, *.stun.playstation.net, xbox.*.microsoft.com, *.xboxlive.com, *.logon.battlenet.com.cn, *.logon.battle.net, stun.l.google.com, easy-login.10099.com.cn,*-update.xoyocdn.com, *.prod.cloud.netflix.com, appboot.netflix.com, *-appboot.netflix.com', // 强制真实IP的域名
    'hijack-dns': '*:53', // 劫持系统53端口DNS
    'udp-policy-not-supported-behaviour': 'REJECT', // 不支持UDP策略时拦截
    'hide-vpn-icon': false, // 不隐藏VPN图标
  },
  replica: {
    'hide-apple-request': true, // 隐藏Apple相关请求日志
    'hide-crashlytics-request': true, // 隐藏Crashlytics请求日志
    'use-keyword-filter': false, // 关闭关键词过滤
    'hide-udp': false, // 不隐藏UDP日志
  },
  rules: [], // 动态注入生成的规则（新增，原代码缺失）
};
