import { t } from './i18n';

export const SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geosite/';
export const IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geoip/';
export const CLASH_SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/';
export const CLASH_IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/';
export const SURGE_SITE_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geosite/'
export const SURGE_IP_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geoip/'

// Custom rules
export const CUSTOM_RULES = [];

// 先定义基础结构，不立即使用 t() 函数
export const UNIFIED_RULES_BASE = [
  {
    name: 'Ad Block',
    site_rules: ['category-ads-all'],
    ip_rules: []
  },
  {
    name: 'AI Services',
    site_rules: ['category-ai-!cn'],
    ip_rules: []
  },
  {
    name: 'Bilibili',
    site_rules: ['bilibili'],
    ip_rules: []
  },
  {
    name: 'Youtube',
    site_rules: ['youtube'],
    ip_rules: []
  },
  {
    name: 'Google',
    site_rules: ['google'],
    ip_rules: ['google']
  },
  {
    name: 'Private',
    site_rules: [],
    ip_rules: ['private']
  },
  {
    name: 'Location:CN',
    site_rules: ['geolocation-cn','cn'],
    ip_rules: ['cn']
  },
  {
    name: 'Telegram',
    site_rules: [],
    ip_rules: ['telegram']
  },
  {
    name: 'Github',
    site_rules: ['github', 'gitlab'],
    ip_rules: []
  },
  {
    name: 'Microsoft',
    site_rules: ['microsoft'],
    ip_rules: []
  },
  {
    name: 'Apple',
    site_rules: ['apple'],
    ip_rules: []
  },
  {
    name: 'Social Media',
    site_rules: ['facebook', 'instagram', 'twitter', 'tiktok', 'linkedin'],
    ip_rules: []
  },
  {
    name: 'Streaming',
    site_rules: ['netflix', 'hulu', 'disney', 'hbo', 'amazon','bahamut'],
    ip_rules: []
  },
  {
    name: 'Gaming',
    site_rules: ['steam', 'epicgames', 'ea', 'ubisoft', 'blizzard'],
    ip_rules: []
  },
  {
    name: 'Education',
    site_rules: ['coursera', 'edx', 'udemy', 'khanacademy', 'category-scholar-!cn'],
    ip_rules: []
  },
  {
    name: 'Financial',
    site_rules: ['paypal', 'visa', 'mastercard','stripe','wise'],
    ip_rules: []
  },
  {
    name: 'Cloud Services',
    site_rules: ['aws', 'azure', 'digitalocean', 'heroku', 'dropbox'],
    ip_rules: []
  },
  {
    name: 'Non-China',
    site_rules: ['geolocation-!cn'],
    ip_rules: []
  }
];

// 代理组映射常量 - 使用固定的代理组名称
export const PROXY_GROUP_MAPPING = {
  // 直连类规则
  'Bilibili': '🎯 全球直连',
  'Location:CN': '🎯 全球直连',
  'Private': '🎯 全球直连',
  
  // 拦截类规则
  'Ad Block': '🛑 全球拦截',
  
  // 代理类规则（所有其他规则）
  'AI Services': '🚀 节点选择',
  'Youtube': '🚀 节点选择',
  'Google': '🚀 节点选择',
  'Telegram': '🚀 节点选择',
  'Github': '🚀 节点选择',
  'Microsoft': '🚀 节点选择',
  'Apple': '🚀 节点选择',
  'Social Media': '🚀 节点选择',
  'Streaming': '🚀 节点选择',
  'Gaming': '🚀 节点选择',
  'Education': '🚀 节点选择',
  'Financial': '🚀 节点选择',
  'Cloud Services': '🚀 节点选择',
  'Non-China': '🚀 节点选择',
  
  // 默认值
  'DIRECT': 'DIRECT',
  'REJECT': 'REJECT',
  'Fall Back': '🐟 漏网之鱼'
};

// 延迟初始化 UNIFIED_RULES
export function getUnifiedRules() {
  return UNIFIED_RULES_BASE.map(rule => ({
    ...rule,
    outbound: PROXY_GROUP_MAPPING[rule.name] || '🚀 节点选择'
  }));
}

// 预定义规则集使用基础名称
export const PREDEFINED_RULE_SETS = {
  minimal: ['Location:CN', 'Private', 'Non-China'],
  balanced: ['Location:CN', 'Private', 'Non-China','Github', 'Google', 'Youtube', 'AI Services', 'Telegram'],
  comprehensive: UNIFIED_RULES_BASE.map(rule => rule.name)
};

// 其他函数保持不变...
export const SITE_RULE_SETS = UNIFIED_RULES_BASE.reduce((acc, rule) => {
  rule.site_rules.forEach(site_rule => {
    acc[site_rule] = `geosite-${site_rule}.srs`;
  });
  return acc;
}, {});

export const IP_RULE_SETS = UNIFIED_RULES_BASE.reduce((acc, rule) => {
  rule.ip_rules.forEach(ip_rule => {
    acc[ip_rule] = `geoip-${ip_rule}.srs`;
  });
  return acc;
}, {});

// 修改 generateRules 函数使用 getUnifiedRules()
export function generateRules(selectedRules = [], customRules = []) {
  if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) {
    selectedRules = PREDEFINED_RULE_SETS[selectedRules];
  }

  if (!selectedRules || selectedRules.length === 0) {
    selectedRules = PREDEFINED_RULE_SETS.minimal;
  }

  const rules = [];
  const unifiedRules = getUnifiedRules(); // 使用延迟初始化的规则

  unifiedRules.forEach(rule => {
    if (selectedRules.includes(rule.name)) {
      rules.push({
        site_rules: rule.site_rules,
        ip_rules: rule.ip_rules,
        domain_suffix: rule?.domain_suffix,
        ip_cidr: rule?.ip_cidr,
        outbound: rule.outbound
      });
    }
  });

  // 自定义规则处理保持不变...
  customRules.reverse();
  customRules.forEach((rule) => {
    const mappedOutbound = PROXY_GROUP_MAPPING[rule.name] || '🚀 节点选择';
    
    rules.unshift({
      site_rules: rule.site.split(','),
      ip_rules: rule.ip.split(','),
      domain_suffix: rule.domain_suffix ? rule.domain_suffix.split(',') : [],
      domain_keyword: rule.domain_keyword ? rule.domain_keyword.split(',') : [],
      ip_cidr: rule.ip_cidr ? rule.ip_cidr.split(',') : [],
      protocol: rule.protocol ? rule.protocol.split(',') : [],
      outbound: mappedOutbound
    });
  });

  return rules;
}

// 其他函数也需要相应修改，使用 getUnifiedRules() 或 UNIFIED_RULES_BASE
// ... 其他函数保持不变
