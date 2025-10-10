import { t } from './i18n';

/** 规则基础 URL */
export const SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geosite/';
export const IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geoip/';
export const CLASH_SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/';
export const CLASH_IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/';
export const SURGE_SITE_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geosite/';
export const SURGE_IP_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geoip/';

/** 自定义规则 */
export const CUSTOM_RULES: any[] = [];

/** 统一规则列表 */
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
export const PREDEFINED_RULE_SETS: Record<string,string[]> = {
    minimal: ['Location:CN','Private','Non-China'],
    balanced: ['Location:CN','Private','Non-China','Github','Google','Youtube','AI Services','Telegram'],
    comprehensive: UNIFIED_RULES.map(r => r.name)
};

/** 生成 Singbox 风格规则 */
export function generateRules(selectedRules: string[] = [], customRules: any[] = []) {
    if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) selectedRules = PREDEFINED_RULE_SETS[selectedRules];
    if (!selectedRules || selectedRules.length === 0) selectedRules = PREDEFINED_RULE_SETS.minimal;

    const rules: any[] = [];
    UNIFIED_RULES.forEach(rule => {
        if (selectedRules.includes(rule.name)) {
            rules.push({ site_rules: rule.site_rules, ip_rules: rule.ip_rules, outbound: rule.outbound });
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
export function generateRuleSets(selectedRules: string[] = [], customRules: any[] = []) {
    if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) selectedRules = PREDEFINED_RULE_SETS[selectedRules];
    if (!selectedRules || selectedRules.length === 0) selectedRules = PREDEFINED_RULE_SETS.minimal;

    const selectedRulesSet = new Set(selectedRules);
    const siteRuleSets = new Set<string>();
    const ipRuleSets = new Set<string>();

    UNIFIED_RULES.forEach(rule => {
        if (selectedRulesSet.has(rule.name)) {
            rule.site_rules.forEach(siteRule => siteRuleSets.add(siteRule));
            rule.ip_rules.forEach(ipRule => ipRuleSets.add(ipRule));
        }
    });

    if (!selectedRulesSet.has('Non-China')) siteRuleSets.add('geolocation-!cn');

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

    if (customRules) {
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

/** 生成 Clash 风格规则集 */
export function generateClashRuleSets(selectedRules: string[] = [], customRules: any[] = []) {
    const { site_rule_sets, ip_rule_sets } = generateRuleSets(selectedRules, customRules);

    const site_rule_providers: any = {};
    const ip_rule_providers: any = {};

    site_rule_sets.forEach(rule => {
        site_rule_providers[rule.tag] = {
            type: 'http',
            format: 'mrs',
            behavior: 'domain',
            url: `${CLASH_SITE_RULE_SET_BASE_URL}${rule.tag}.mrs`,
            path: `./ruleset/${rule.tag}.mrs`,
            interval: 86400
        };
    });

    ip_rule_sets.forEach(rule => {
        const tag = rule.tag.replace('-ip', '');
        ip_rule_providers[tag] = {
            type: 'http',
            format: 'mrs',
            behavior: 'ipcidr',
            url: `${CLASH_IP_RULE_SET_BASE_URL}${tag}.mrs`,
            path: `./ruleset/${tag}.mrs`,
            interval: 86400
        };
    });

    return { site_rule_providers, ip_rule_providers };
}

/** Singbox 配置 */
export const SING_BOX_CONFIG = {
    rules: generateRules(),
    rule_sets: generateRuleSets(),
    dns: {
        servers: [
            { type: 'udp', tag: 'dns_resolver', server: '223.5.5.5' },
            { type: 'tcp', tag: 'dns_proxy', server: '1.1.1.1', detour: '🚀 节点选择', domain_resolver: 'dns_resolver' }
        ],
        final: 'dns_proxy'
    }
};

/** Clash 配置 */
export const CLASH_CONFIG = {
    port: 7890,
    'socks-port': 7891,
    mode: 'rule',
    'rule-providers': generateClashRuleSets(),
    proxies: [],
    'proxy-groups': [],
    dns: {
        enable: true,
        enhanced_mode: 'fake-ip',
        nameserver: ['223.5.5.5','114.114.114.114']
    }
};

/** Surge 配置 */
export const SURGE_CONFIG = {
    rules: generateRules(),
    site_rule_set_baseurl: SURGE_SITE_RULE_SET_BASEURL,
    ip_rule_set_baseurl: SURGE_IP_RULE_SET_BASEURL
};
