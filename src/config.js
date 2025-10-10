import { t } from './i18n';

export const SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geosite/';
export const IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geoip/';
export const CLASH_SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/';
export const CLASH_IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/';
export const SURGE_SITE_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geosite/';
export const SURGE_IP_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geoip/';

export const CUSTOM_RULES = [];

// Unified rules
export const UNIFIED_RULES = [
  { name: 'Ad Block', outbound: t('outboundNames.Ad Block'), site_rules: ['category-ads-all'], ip_rules: [] },
  { name: 'AI Services', outbound: t('outboundNames.AI Services'), site_rules: ['category-ai-!cn'], ip_rules: [] },
  { name: 'Bilibili', outbound: t('outboundNames.Bilibili'), site_rules: ['bilibili'], ip_rules: [] },
  { name: 'Youtube', outbound: t('outboundNames.Youtube'), site_rules: ['youtube'], ip_rules: [] },
  { name: 'Google', outbound: t('outboundNames.Google'), site_rules: ['google'], ip_rules: ['google'] },
  { name: 'Private', outbound: t('outboundNames.Private'), site_rules: [], ip_rules: ['private'] },
  { name: 'Location:CN', outbound: t('outboundNames.Location:CN'), site_rules: ['geolocation-cn','cn'], ip_rules: ['cn'] },
  { name: 'Telegram', outbound: t('outboundNames.Telegram'), site_rules: [], ip_rules: ['telegram'] },
  { name: 'Github', outbound: t('outboundNames.Github'), site_rules: ['github', 'gitlab'], ip_rules: [] },
  { name: 'Microsoft', outbound: t('outboundNames.Microsoft'), site_rules: ['microsoft'], ip_rules: [] },
  { name: 'Apple', outbound: t('outboundNames.Apple'), site_rules: ['apple'], ip_rules: [] },
  { name: 'Social Media', outbound: t('outboundNames.Social Media'), site_rules: ['facebook', 'instagram', 'twitter', 'tiktok', 'linkedin'], ip_rules: [] },
  { name: 'Streaming', outbound: t('outboundNames.Streaming'), site_rules: ['netflix','hulu','disney','hbo','amazon','bahamut'], ip_rules: [] },
  { name: 'Gaming', outbound: t('outboundNames.Gaming'), site_rules: ['steam','epicgames','ea','ubisoft','blizzard'], ip_rules: [] },
  { name: 'Education', outbound: t('outboundNames.Education'), site_rules: ['coursera','edx','udemy','khanacademy','category-scholar-!cn'], ip_rules: [] },
  { name: 'Financial', outbound: t('outboundNames.Financial'), site_rules: ['paypal','visa','mastercard','stripe','wise'], ip_rules: [] },
  { name: 'Cloud Services', outbound: t('outboundNames.Cloud Services'), site_rules: ['aws','azure','digitalocean','heroku','dropbox'], ip_rules: [] },
  { name: 'Non-China', outbound: t('outboundNames.Non-China'), site_rules: ['geolocation-!cn'], ip_rules: [] }
];

export const PREDEFINED_RULE_SETS = {
  minimal: ['Location:CN','Private','Non-China'],
  balanced: ['Location:CN','Private','Non-China','Github','Google','Youtube','AI Services','Telegram'],
  comprehensive: UNIFIED_RULES.map(rule => rule.name)
};

// ===== Helper: 自动添加 Non-China 规则 =====
function addNonChinaRuleIfMissing(site_rule_sets, selectedRules) {
  const nonChinaTag = 'geolocation-!cn';
  if (!selectedRules.includes('Non-China') && !site_rule_sets.some(r => r.tag === nonChinaTag)) {
    site_rule_sets.push({
      tag: nonChinaTag,
      type: 'remote',
      format: 'binary',
      url: `${SITE_RULE_SET_BASE_URL}geosite-${nonChinaTag}.srs`
    });
  }
}

// ===== SITE / IP Rule Sets =====
export const SITE_RULE_SETS = UNIFIED_RULES.reduce((acc, rule) => {
  rule.site_rules.forEach(site => acc[site] = `geosite-${site}.srs`);
  return acc;
}, {});

export const IP_RULE_SETS = UNIFIED_RULES.reduce((acc, rule) => {
  rule.ip_rules.forEach(ip => acc[ip] = `geoip-${ip}.srs`);
  return acc;
}, {});

export const CLASH_SITE_RULE_SETS = UNIFIED_RULES.reduce((acc, rule) => {
  rule.site_rules.forEach(site => acc[site] = `${site}.mrs`);
  return acc;
}, {});

export const CLASH_IP_RULE_SETS = UNIFIED_RULES.reduce((acc, rule) => {
  rule.ip_rules.forEach(ip => acc[ip] = `${ip}.mrs`);
  return acc;
}, {});

// ===== Generate Rules =====
export function generateRules(selectedRules = [], customRules = []) {
  if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) selectedRules = PREDEFINED_RULE_SETS[selectedRules];
  selectedRules = selectedRules.length ? selectedRules : PREDEFINED_RULE_SETS.minimal;

  const rules = UNIFIED_RULES
    .filter(rule => selectedRules.includes(rule.name))
    .map(rule => ({
      site_rules: rule.site_rules,
      ip_rules: rule.ip_rules,
      domain_suffix: rule?.domain_suffix,
      ip_cidr: rule?.ip_cidr,
      outbound: rule.name
    }));

  if (customRules) {
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
  }

  return rules;
}

// ===== Generate Singbox / Surge Rule Sets =====
export function generateRuleSets(selectedRules = [], customRules = []) {
  if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) selectedRules = PREDEFINED_RULE_SETS[selectedRules];
  selectedRules = selectedRules.length ? selectedRules : PREDEFINED_RULE_SETS.minimal;

  const selectedSet = new Set(selectedRules);
  const siteRuleSets = new Set();
  const ipRuleSets = new Set();

  UNIFIED_RULES.forEach(rule => {
    if (selectedSet.has(rule.name)) {
      rule.site_rules.forEach(site => siteRuleSets.add(site));
      rule.ip_rules.forEach(ip => ipRuleSets.add(ip));
    }
  });

  const site_rule_sets = Array.from(siteRuleSets).map(tag => ({
    tag,
    type: 'remote',
    format: 'binary',
    url: `${SITE_RULE_SET_BASE_URL}${SITE_RULE_SETS[tag]}`
  }));

  const ip_rule_sets = Array.from(ipRuleSets).map(tag => ({
    tag: `${tag}-ip`,
    type: 'remote',
    format: 'binary',
    url: `${IP_RULE_SET_BASE_URL}${IP_RULE_SETS[tag]}`
  }));

  // 自动添加 Non-China
  addNonChinaRuleIfMissing(site_rule_sets, selectedRules);

  // 添加自定义规则
  if(customRules) {
    customRules.forEach(rule => {
      rule.site?.split(',').forEach(site => site_rule_sets.push({
        tag: site.trim(),
        type: 'remote',
        format: 'binary',
        url: `${SITE_RULE_SET_BASE_URL}geosite-${site.trim()}.srs`
      }));
      rule.ip?.split(',').forEach(ip => ip_rule_sets.push({
        tag: `${ip.trim()}-ip`,
        type: 'remote',
        format: 'binary',
        url: `${IP_RULE_SET_BASE_URL}geoip-${ip.trim()}.srs`
      }));
    });
  }

  return { site_rule_sets, ip_rule_sets };
}

// ===== Generate Clash Rule Sets (.mrs) =====
export function generateClashRuleSets(selectedRules = [], customRules = []) {
  if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) selectedRules = PREDEFINED_RULE_SETS[selectedRules];
  selectedRules = selectedRules.length ? selectedRules : PREDEFINED_RULE_SETS.minimal;

  const selectedSet = new Set(selectedRules);
  const siteRuleSets = new Set();
  const ipRuleSets = new Set();

  UNIFIED_RULES.forEach(rule => {
    if (selectedSet.has(rule.name)) {
      rule.site_rules.forEach(site => siteRuleSets.add(site));
      rule.ip_rules.forEach(ip => ipRuleSets.add(ip));
    }
  });

  const site_rule_providers = {};
  const ip_rule_providers = {};

  Array.from(siteRuleSets).forEach(tag => {
    site_rule_providers[tag] = {
      type: 'http',
      format: 'mrs',
      behavior: 'domain',
      url: `${CLASH_SITE_RULE_SET_BASE_URL}${CLASH_SITE_RULE_SETS[tag]}`,
      path: `./ruleset/${CLASH_SITE_RULE_SETS[tag]}`,
      interval: 86400
    };
  });

  Array.from(ipRuleSets).forEach(tag => {
    ip_rule_providers[tag] = {
      type: 'http',
      format: 'mrs',
      behavior: 'ipcidr',
      url: `${CLASH_IP_RULE_SET_BASE_URL}${CLASH_IP_RULE_SETS[tag]}`,
      path: `./ruleset/${CLASH_IP_RULE_SETS[tag]}`,
      interval: 86400
    };
  });

  // 自动添加 Non-China
  if (!selectedRules.includes('Non-China')) {
    site_rule_providers['geolocation-!cn'] = {
      type: 'http',
      format: 'mrs',
      behavior: 'domain',
      url: `${CLASH_SITE_RULE_SET_BASE_URL}geolocation-!cn.mrs`,
      path: './ruleset/geolocation-!cn.mrs',
      interval: 86400
    };
  }

  // 添加自定义规则
  if(customRules) {
    customRules.forEach(rule => {
      rule.site?.split(',').forEach(site => {
        const s = site.trim();
        site_rule_providers[s] = {
          type: 'http',
          format: 'mrs',
          behavior: 'domain',
          url: `${CLASH_SITE_RULE_SET_BASE_URL}${s}.mrs`,
          path: `./ruleset/${s}.mrs`,
          interval: 86400
        };
      });
      rule.ip?.split(',').forEach(ip => {
        const i = ip.trim();
        ip_rule_providers[i] = {
          type: 'http',
          format: 'mrs',
          behavior: 'ipcidr',
          url: `${CLASH_IP_RULE_SET_BASE_URL}${i}.mrs`,
          path: `./ruleset/${i}.mrs`,
          interval: 86400
        };
      });
    });
  }

  return { site_rule_providers, ip_rule_providers };
}

// ===== Singbox / Clash / Surge Configs 可以保持原有不动 =====
export const SING_BOX_CONFIG = { /* ... */ };
export const CLASH_CONFIG = { /* ... */ };
export const SURGE_CONFIG = { /* ... */ };
