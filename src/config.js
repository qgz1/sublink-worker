import { t } from './i18n';

// ========================
// 📦 规则集基础地址
// ========================
export const SITE_RULE_SET_BASE_URL =
  'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geosite/';
export const IP_RULE_SET_BASE_URL =
  'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geoip/';
export const CLASH_SITE_RULE_SET_BASE_URL =
  'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/';
export const CLASH_IP_RULE_SET_BASE_URL =
  'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/';
export const SURGE_SITE_RULE_SET_BASEURL =
  'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geosite/';
export const SURGE_IP_RULE_SET_BASEURL =
  'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geoip/';

// ========================
// 🎯 自定义规则（可扩展）
// ========================
export const CUSTOM_RULES = [];

// ========================
// 🌏 核心统一规则结构
// ========================
export const UNIFIED_RULES = [
  { name: 'Ad Block', outbound: t('outboundNames.Ad Block'), site_rules: ['category-ads-all'], ip_rules: [] },
  { name: 'AI Services', outbound: t('outboundNames.AI Services'), site_rules: ['category-ai-!cn'], ip_rules: [] },
  { name: 'Bilibili', outbound: t('outboundNames.Bilibili'), site_rules: ['bilibili'], ip_rules: [] },
  { name: 'Youtube', outbound: t('outboundNames.Youtube'), site_rules: ['youtube'], ip_rules: [] },
  { name: 'Google', outbound: t('outboundNames.Google'), site_rules: ['google'], ip_rules: ['google'] },
  { name: 'Private', outbound: t('outboundNames.Private'), site_rules: [], ip_rules: ['private'] },
  { name: 'Location:CN', outbound: t('outboundNames.Location:CN'), site_rules: ['geolocation-cn', 'cn'], ip_rules: ['cn'] },
  { name: 'Telegram', outbound: t('outboundNames.Telegram'), site_rules: [], ip_rules: ['telegram'] },
  { name: 'Github', outbound: t('outboundNames.Github'), site_rules: ['github', 'gitlab'], ip_rules: [] },
  { name: 'Microsoft', outbound: t('outboundNames.Microsoft'), site_rules: ['microsoft'], ip_rules: [] },
  { name: 'Apple', outbound: t('outboundNames.Apple'), site_rules: ['apple'], ip_rules: [] },
  {
    name: 'Social Media',
    outbound: t('outboundNames.Social Media'),
    site_rules: ['facebook', 'instagram', 'twitter', 'tiktok', 'linkedin'],
    ip_rules: [],
  },
  {
    name: 'Streaming',
    outbound: t('outboundNames.Streaming'),
    site_rules: ['netflix', 'hulu', 'disney', 'hbo', 'amazon', 'bahamut'],
    ip_rules: [],
  },
  {
    name: 'Gaming',
    outbound: t('outboundNames.Gaming'),
    site_rules: ['steam', 'epicgames', 'ea', 'ubisoft', 'blizzard'],
    ip_rules: [],
  },
  {
    name: 'Education',
    outbound: t('outboundNames.Education'),
    site_rules: ['coursera', 'edx', 'udemy', 'khanacademy', 'category-scholar-!cn'],
    ip_rules: [],
  },
  {
    name: 'Financial',
    outbound: t('outboundNames.Financial'),
    site_rules: ['paypal', 'visa', 'mastercard', 'stripe', 'wise'],
    ip_rules: [],
  },
  {
    name: 'Cloud Services',
    outbound: t('outboundNames.Cloud Services'),
    site_rules: ['aws', 'azure', 'digitalocean', 'heroku', 'dropbox'],
    ip_rules: [],
  },
  { name: 'Non-China', outbound: t('outboundNames.Non-China'), site_rules: ['geolocation-!cn'], ip_rules: [] },
];

// ========================
// 🧭 三档预设规则集
// ========================
export const PREDEFINED_RULE_SETS = {
  minimal: ['Location:CN', 'Private', 'Non-China'],
  balanced: ['Location:CN', 'Private', 'Non-China', 'Github', 'Google', 'Youtube', 'AI Services', 'Telegram'],
  comprehensive: UNIFIED_RULES.map((rule) => rule.name),
};

// ========================
// 🔧 自动生成规则文件映射
// ========================
export const SITE_RULE_SETS = Object.fromEntries(
  UNIFIED_RULES.flatMap((r) => r.site_rules.map((s) => [s, `geosite-${s}.srs`]))
);
export const IP_RULE_SETS = Object.fromEntries(
  UNIFIED_RULES.flatMap((r) => r.ip_rules.map((s) => [s, `geoip-${s}.srs`]))
);
export const CLASH_SITE_RULE_SETS = Object.fromEntries(
  UNIFIED_RULES.flatMap((r) => r.site_rules.map((s) => [s, `${s}.mrs`]))
);
export const CLASH_IP_RULE_SETS = Object.fromEntries(
  UNIFIED_RULES.flatMap((r) => r.ip_rules.map((s) => [s, `${s}.mrs`]))
);

// ========================
// ⚙️ 工具函数：生成规则与出站配置
// ========================
export function getOutbounds(selectedRuleNames) {
  if (!Array.isArray(selectedRuleNames)) return [];
  return UNIFIED_RULES.filter((r) => selectedRuleNames.includes(r.name)).map((r) => r.name);
}

export function generateRules(selectedRules = [], customRules = []) {
  if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) {
    selectedRules = PREDEFINED_RULE_SETS[selectedRules];
  }
  if (!selectedRules || selectedRules.length === 0) selectedRules = PREDEFINED_RULE_SETS.minimal;

  const rules = [];
  UNIFIED_RULES.forEach((rule) => {
    if (selectedRules.includes(rule.name)) {
      rules.push({
        site_rules: rule.site_rules,
        ip_rules: rule.ip_rules,
        outbound: rule.name,
      });
    }
  });

  // 插入自定义规则
  customRules.reverse().forEach((rule) => {
    rules.unshift({
      site_rules: rule.site?.split(',') || [],
      ip_rules: rule.ip?.split(',') || [],
      outbound: rule.name,
    });
  });

  return rules;
}

// ========================
// 🧩 Clash / SingBox / Surge 基础配置模板
// ========================
export const CLASH_CONFIG = {
  port: 7890,
  'socks-port': 7891,
  'allow-lan': true,
  mode: 'rule',
  'log-level': 'info',
  'geodata-mode': true,
  'geo-auto-update': true,
  'geo-update-interval': 24,
  'rule-providers': {},
  dns: {
    enable: true,
    'enhanced-mode': 'fake-ip',
    'nameserver': ['https://223.5.5.5/dns-query', 'https://1.1.1.1/dns-query'],
    'nameserver-policy': {
      'geosite:cn,private': ['https://223.5.5.5/dns-query', 'https://120.53.53.53/dns-query'],
      'geosite:geolocation-!cn': ['https://dns.cloudflare.com/dns-query', 'https://dns.google/dns-query'],
    },
  },
  proxies: [],
  'proxy-groups': [],
};

export const SING_BOX_CONFIG = {
  dns: {
    servers: [
      { type: 'https', tag: 'dns_direct', server: 'https://223.5.5.5/dns-query' },
      { type: 'https', tag: 'dns_proxy', server: 'https://1.1.1.1/dns-query' },
      { type: 'fakeip', tag: 'dns_fakeip', inet4_range: '198.18.0.0/15' },
    ],
    rules: [
      { rule_set: 'geolocation-!cn', server: 'dns_proxy' },
      { rule_set: 'geolocation-cn', server: 'dns_direct' },
    ],
    final: 'dns_direct',
  },
  inbounds: [
    { type: 'mixed', tag: 'mixed-in', listen: '0.0.0.0', listen_port: 2080 },
    { type: 'tun', tag: 'tun-in', auto_route: true, strict_route: true, sniff: true },
  ],
  outbounds: [
    { type: 'direct', tag: 'DIRECT' },
    { type: 'block', tag: 'REJECT' },
  ],
  route: { rules: [] },
};

export const SURGE_CONFIG = {
  general: {
    'http-listen': '127.0.0.1:6152',
    'socks5-listen': '127.0.0.1:6153',
    'test-timeout': 5,
    'proxy-test-url': 'http://cp.cloudflare.com/generate_204',
    'geoip-maxmind-url': 'https://raw.githubusercontent.com/Loyalsoldier/geoip/release/Country.mmdb',
    'dns-server': '119.29.29.29, 180.184.1.1, 223.5.5.5, system',
  },
};
