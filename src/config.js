// config.ts
// ================================
// 完整配置文件（TypeScript）：Singbox / Clash / Surge
// ================================

export const SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geosite/';
export const IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geoip/';
export const CLASH_SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/';
export const CLASH_IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/';
export const SURGE_SITE_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geosite/';
export const SURGE_IP_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geoip/';

export interface CustomRule {
  name: string;
  site?: string;
  ip?: string;
  domain_suffix?: string;
  domain_keyword?: string;
  ip_cidr?: string;
  protocol?: string;
}

export const CUSTOM_RULES: CustomRule[] = [];

// ===== Unified Rules =====
export interface UnifiedRule {
  name: string;
  site_rules: string[];
  ip_rules: string[];
}

export const UNIFIED_RULES: UnifiedRule[] = [
  { name: 'Ad Block', site_rules: ['category-ads-all'], ip_rules: [] },
  { name: 'AI Services', site_rules: ['category-ai-!cn'], ip_rules: [] },
  { name: 'Bilibili', site_rules: ['bilibili'], ip_rules: [] },
  { name: 'Youtube', site_rules: ['youtube'], ip_rules: [] },
  { name: 'Google', site_rules: ['google'], ip_rules: ['google'] },
  { name: 'Private', site_rules: [], ip_rules: ['private'] },
  { name: 'Location:CN', site_rules: ['geolocation-cn','cn'], ip_rules: ['cn'] },
  { name: 'Telegram', site_rules: [], ip_rules: ['telegram'] },
  { name: 'Github', site_rules: ['github','gitlab'], ip_rules: [] },
  { name: 'Microsoft', site_rules: ['microsoft'], ip_rules: [] },
  { name: 'Apple', site_rules: ['apple'], ip_rules: [] },
  { name: 'Social Media', site_rules: ['facebook','instagram','twitter','tiktok','linkedin'], ip_rules: [] },
  { name: 'Streaming', site_rules: ['netflix','hulu','disney','hbo','amazon','bahamut'], ip_rules: [] },
  { name: 'Gaming', site_rules: ['steam','epicgames','ea','ubisoft','blizzard'], ip_rules: [] },
  { name: 'Education', site_rules: ['coursera','edx','udemy','khanacademy','category-scholar-!cn'], ip_rules: [] },
  { name: 'Financial', site_rules: ['paypal','visa','mastercard','stripe','wise'], ip_rules: [] },
  { name: 'Cloud Services', site_rules: ['aws','azure','digitalocean','heroku','dropbox'], ip_rules: [] },
  { name: 'Non-China', site_rules: ['geolocation-!cn'], ip_rules: [] }
];

// ===== Predefined Rule Sets =====
export const PREDEFINED_RULE_SETS: Record<string, string[]> = {
  minimal: ['Location:CN','Private','Non-China'],
  balanced: ['Location:CN','Private','Non-China','Github','Google','Youtube','AI Services','Telegram'],
  comprehensive: UNIFIED_RULES.map(rule => rule.name)
};

// ===== Rule Generators =====
export interface RuleItem {
  site_rules: string[];
  ip_rules: string[];
  domain_suffix?: string[];
  domain_keyword?: string[];
  ip_cidr?: string[];
  protocol?: string[];
  outbound: string;
}

export function generateRules(selectedRules: string[] = [], customRules: CustomRule[] = []): RuleItem[] {
  if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) selectedRules = PREDEFINED_RULE_SETS[selectedRules];
  if (!selectedRules || selectedRules.length === 0) selectedRules = PREDEFINED_RULE_SETS.minimal;

  const rules: RuleItem[] = [];
  UNIFIED_RULES.forEach(rule => {
    if (selectedRules.includes(rule.name)) {
      rules.push({ site_rules: rule.site_rules, ip_rules: rule.ip_rules, outbound: rule.name });
    }
  });

  customRules.reverse().forEach(rule => {
    rules.unshift({
      site_rules: rule.site?.split(',') || [],
      ip_rules: rule.ip?.split(',') || [],
      domain_suffix: rule.domain_suffix?.split(',') || [],
      domain_keyword: rule.domain_keyword?.split(',') || [],
      ip_cidr: rule.ip_cidr?.split(',') || [],
      protocol: rule.protocol?.split(',') || [],
      outbound: rule.name
    });
  });

  return rules;
}

// 获取所有可用的 outbound 节点
export function getOutbounds(): string[] {
  return UNIFIED_RULES.map(rule => rule.name);
}

export interface RuleSetItem {
  tag: string;
  type: 'remote' | 'local';
  format: 'binary' | 'mrs';
  url?: string;
  path?: string;
}

export function generateRuleSets(selectedRules: string[] = [], customRules: CustomRule[] = []): { site_rule_sets: RuleSetItem[], ip_rule_sets: RuleSetItem[] } {
  const selectedRulesSet = new Set(selectedRules || PREDEFINED_RULE_SETS.minimal);
  const siteRuleSets = new Set<string>();
  const ipRuleSets = new Set<string>();

  UNIFIED_RULES.forEach(rule => {
    if (selectedRulesSet.has(rule.name)) {
      rule.site_rules.forEach(siteRule => siteRuleSets.add(siteRule));
      rule.ip_rules.forEach(ipRule => ipRuleSets.add(ipRule));
    }
  });

  const site_rule_sets: RuleSetItem[] = Array.from(siteRuleSets).map(rule => ({
    tag: rule,
    type: 'remote',
    format: 'binary',
    url: `${SITE_RULE_SET_BASE_URL}geosite-${rule}.srs`
  }));

  const ip_rule_sets: RuleSetItem[] = Array.from(ipRuleSets).map(rule => ({
    tag: `${rule}-ip`,
    type: 'remote',
    format: 'binary',
    url: `${IP_RULE_SET_BASE_URL}geoip-${rule}.srs`
  }));

  return { site_rule_sets, ip_rule_sets };
}

export function generateClashRuleSets(selectedRules: string[] = [], customRules: CustomRule[] = []) {
  const selectedRulesSet = new Set(selectedRules || PREDEFINED_RULE_SETS.minimal);
  const siteRuleSets = new Set<string>();
  const ipRuleSets = new Set<string>();

  UNIFIED_RULES.forEach(rule => {
    if (selectedRulesSet.has(rule.name)) {
      rule.site_rules.forEach(siteRule => siteRuleSets.add(siteRule));
      rule.ip_rules.forEach(ipRule => ipRuleSets.add(ipRule));
    }
  });

  const site_rule_providers: Record<string, any> = {};
  const ip_rule_providers: Record<string, any> = {};

  Array.from(siteRuleSets).forEach(rule => {
    site_rule_providers[rule] = {
      type: 'http',
      format: 'mrs',
      behavior: 'domain',
      url: `${CLASH_SITE_RULE_SET_BASE_URL}${rule}.mrs`,
      path: `./ruleset/${rule}.mrs`,
      interval: 86400
    };
  });

  Array.from(ipRuleSets).forEach(rule => {
    ip_rule_providers[rule] = {
      type: 'http',
      format: 'mrs',
      behavior: 'ipcidr',
      url: `${CLASH_IP_RULE_SET_BASE_URL}${rule}.mrs`,
      path: `./ruleset/${rule}.mrs`,
      interval: 86400
    };
  });

  return { site_rule_providers, ip_rule_providers };
}

// ===== Singbox Configuration =====
export const SING_BOX_CONFIG = {
  rules: generateRules(),
  rule_sets: generateRuleSets(),
  dns: {
    enable: true,
    listen: ':53',
    enhanced_mode: 'redir-host',
    default_nameserver: ['223.5.5.5','114.114.114.114']
  }
};

// ===== Clash Configuration =====
export const CLASH_CONFIG = {
  rules: generateRules(),
  rule_sets: generateClashRuleSets(),
  dns: {
    enable: true,
    listen: ':53',
    enhanced_mode: 'redir-host',
    default_nameserver: ['223.5.5.5','114.114.114.114']
  }
};

// ===== Surge Configuration =====
export const SURGE_CONFIG = {
  rules: generateRules(),
  site_rule_set_baseurl: SURGE_SITE_RULE_SET_BASEURL,
  ip_rule_set_baseurl: SURGE_IP_RULE_SET_BASEURL
};
