import { t } from './i18n';

/** 基础规则集 URL */
export const SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geosite/';
export const IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geoip/';
export const CLASH_SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/';
export const CLASH_IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/';
export const SURGE_SITE_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geosite/';
export const SURGE_IP_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geoip/';

/** 自定义规则 */
export const CUSTOM_RULES = [];

/** 统一规则定义 */
export const UNIFIED_RULES = [
    { name: 'Ad Block', outbound: t('outboundNames.Ad Block'), site_rules: ['category-ads-all'], ip_rules: [] },
    { name: 'AI Services', outbound: t('outboundNames.AI Services'), site_rules: ['category-ai-!cn'], ip_rules: [] },
    { name: 'Bilibili', outbound: t('outboundNames.Bilibili'), site_rules: ['bilibili'], ip_rules: [] },
    { name: 'Youtube', outbound: t('outboundNames.Youtube'), site_rules: ['youtube'], ip_rules: [] },
    { name: 'Google', outbound: t('outboundNames.Google'), site_rules: ['google'], ip_rules: ['google'] },
    { name: 'Private', outbound: t('outboundNames.Private'), site_rules: [], ip_rules: ['private'] },
    { name: 'Location:CN', outbound: t('outboundNames.Location:CN'), site_rules: ['geolocation-cn','cn'], ip_rules: ['cn'] },
    { name: 'Telegram', outbound: t('outboundNames.Telegram'), site_rules: [], ip_rules: ['telegram'] },
    { name: 'Github', outbound: t('outboundNames.Github'), site_rules: ['github','gitlab'], ip_rules: [] },
    { name: 'Microsoft', outbound: t('outboundNames.Microsoft'), site_rules: ['microsoft'], ip_rules: [] },
    { name: 'Apple', outbound: t('outboundNames.Apple'), site_rules: ['apple'], ip_rules: [] },
    { name: 'Social Media', outbound: t('outboundNames.Social Media'), site_rules: ['facebook','instagram','twitter','tiktok','linkedin'], ip_rules: [] },
    { name: 'Streaming', outbound: t('outboundNames.Streaming'), site_rules: ['netflix','hulu','disney','hbo','amazon','bahamut'], ip_rules: [] },
    { name: 'Gaming', outbound: t('outboundNames.Gaming'), site_rules: ['steam','epicgames','ea','ubisoft','blizzard'], ip_rules: [] },
    { name: 'Education', outbound: t('outboundNames.Education'), site_rules: ['coursera','edx','udemy','khanacademy','category-scholar-!cn'], ip_rules: [] },
    { name: 'Financial', outbound: t('outboundNames.Financial'), site_rules: ['paypal','visa','mastercard','stripe','wise'], ip_rules: [] },
    { name: 'Cloud Services', outbound: t('outboundNames.Cloud Services'), site_rules: ['aws','azure','digitalocean','heroku','dropbox'], ip_rules: [] },
    { name: 'Non-China', outbound: t('outboundNames.Non-China'), site_rules: ['geolocation-!cn'], ip_rules: [] }
];

/** 预定义规则集 */
export const PREDEFINED_RULE_SETS = {
    minimal: ['Location:CN', 'Private', 'Non-China'],
    balanced: ['Location:CN', 'Private', 'Non-China','Github','Google','Youtube','AI Services','Telegram'],
    comprehensive: UNIFIED_RULES.map(rule => rule.name)
};

/** 获取已选择的 outbound 列表 */
export function getOutbounds(selectedRuleNames) {
    if (!selectedRuleNames || !Array.isArray(selectedRuleNames)) return [];
    return UNIFIED_RULES.filter(rule => selectedRuleNames.includes(rule.name)).map(rule => rule.name);
}

/** 生成 Singbox / Clash 通用规则 */
export function generateRules(selectedRules = [], customRules = []) {
    if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) selectedRules = PREDEFINED_RULE_SETS[selectedRules];
    if (!selectedRules || selectedRules.length === 0) selectedRules = PREDEFINED_RULE_SETS.minimal;

    const rules = [];
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

/** 生成 Singbox 风格规则集 */
export function generateRuleSets(selectedRules = [], customRules = []) {
    if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) selectedRules = PREDEFINED_RULE_SETS[selectedRules];
    if (!selectedRules || selectedRules.length === 0) selectedRules = PREDEFINED_RULE_SETS.minimal;

    const selectedRulesSet = new Set(selectedRules);
    const siteRuleSets = new Set();
    const ipRuleSets = new Set();

    UNIFIED_RULES.forEach(rule => {
        if (selectedRulesSet.has(rule.name)) {
            rule.site_rules.forEach(siteRule => siteRuleSets.add(siteRule));
            rule.ip_rules.forEach(ipRule => ipRuleSets.add(ipRule));
        }
    });

    const site_rule_sets = Array.from(siteRuleSets).map(rule => ({
        tag: rule,
        type: 'remote',
        format: 'binary',
        url: `${SITE_RULE_SET_BASE_URL}geosite-${rule}.srs`
    }));

    const ip_rule_sets = Array.from(ipRuleSets).map(rule => ({
        tag: `${rule}-ip`,
        type: 'remote',
        format: 'binary',
        url: `${IP_RULE_SET_BASE_URL}geoip-${rule}.srs`
    }));

    return { site_rule_sets, ip_rule_sets };
}

/** 生成 Clash 风格规则集 (OpenClash 兼容) */
export function generateClashRuleSets(selectedRules = [], customRules = []) {
    const { site_rule_sets, ip_rule_sets } = generateRuleSets(selectedRules, customRules);

    const site_rule_providers = {};
    const ip_rule_providers = {};

    site_rule_sets.forEach(rule => {
        site_rule_providers[rule.tag] = {
            type: 'http',
            behavior: 'domain',
            url: rule.url,
            path: `./ruleset/${rule.tag}.mrs`,
            interval: 86400
        };
    });

    ip_rule_sets.forEach(rule => {
        ip_rule_providers[rule.tag] = {
            type: 'http',
            behavior: 'ipcidr',
            url: rule.url,
            path: `./ruleset/${rule.tag}.mrs`,
            interval: 86400
        };
    });

    return { site_rule_providers, ip_rule_providers };
}

/** OpenClash 完整配置 */
export const CLASH_CONFIG = {
    proxies: [], // 可以在此直接添加节点列表
    proxy_groups: [
        { name: 'Auto Select', type: 'url-test', proxies: [], url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 },
        { name: 'Manual Select', type: 'select', proxies: [] }
    ],
    rules: generateRules().map(rule => ({
        type: 'field',
        outbound: rule.outbound,
        domain: rule.site_rules,
        ip: rule.ip_rules
    })),
    rule_providers: generateClashRuleSets()
};

/** Singbox 配置 */
export const SING_BOX_CONFIG = {
    rules: generateRules(),
    rule_sets: generateRuleSets()
};

/** Surge 配置 */
export const SURGE_CONFIG = {
    rules: generateRules(),
    site_rule_set_baseurl: SURGE_SITE_RULE_SET_BASEURL,
    ip_rule_set_baseurl: SURGE_IP_RULE_SET_BASEURL
};
