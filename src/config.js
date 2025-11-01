import { t } from './i18n';

function getEnv(env, key, fallback) {
  try {
    if (typeof env !== 'undefined' && env[key]) return env[key];
    if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  } catch {
    // ignore
  }
  return fallback;
}

export let RULE_BASE_OVERRIDE = '';
export function initRuleBase(env) {
  RULE_BASE_OVERRIDE = getEnv(env, 'RULE_SET_BASE', '');
}

export const SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geosite';
export const IP_RULE_SET_BASE_URL   = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geoip';
export const CLASH_SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite';
export const CLASH_IP_RULE_SET_BASE_URL   = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip';
export const SURGE_SITE_RULE_SET_BASEURL  = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geosite';
export const SURGE_IP_RULE_SET_BASEURL    = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geoip';

export const CUSTOM_RULES = [];

export const UNIFIED_RULES = [
  { name: 'Ad Block',      outbound: 'Ad Block',      site_rules: ['category-ads-all'],         ip_rules: [] },
  { name: 'AI Services',   outbound: 'AI Services',   site_rules: ['category-ai-!cn'],          ip_rules: [] },
  { name: 'Bilibili',      outbound: 'Bilibili',      site_rules: ['bilibili'],                 ip_rules: [] },
  { name: 'Youtube',       outbound: 'Youtube',       site_rules: ['youtube'],                  ip_rules: [] },
  { name: 'Google',        outbound: 'Google',        site_rules: ['google'],                   ip_rules: ['google'] },
  { name: 'Private',       outbound: 'Private',       site_rules: [],                           ip_rules: ['private'] },
  { name: 'Location:CN',   outbound: 'Location:CN',   site_rules: ['geolocation-cn','cn'],      ip_rules: ['cn'] },
  { name: 'Telegram',      outbound: 'Telegram',      site_rules: [],                           ip_rules: ['telegram'] },
  { name: 'Github',        outbound: 'Github',        site_rules: ['github', 'gitlab'],         ip_rules: [] },
  { name: 'Microsoft',     outbound: 'Microsoft',     site_rules: ['microsoft'],                ip_rules: [] },
  { name: 'Apple',         outbound: 'Apple',         site_rules: ['apple'],                    ip_rules: [] },
  { name: 'Social Media',  outbound: 'Social Media',  site_rules: ['facebook','instagram','twitter','tiktok','linkedin'], ip_rules: [] },
  { name: 'Streaming',     outbound: 'Streaming',     site_rules: ['netflix','hulu','disney','hbo','amazon','bahamut'], ip_rules: [] },
  { name: 'Gaming',        outbound: 'Gaming',        site_rules: ['steam','epicgames','ea','ubisoft','blizzard'], ip_rules: [] },
  { name: 'Education',     outbound: 'Education',     site_rules: ['coursera','edx','udemy','khanacademy','category-scholar-!cn'], ip_rules: [] },
  { name: 'Financial',     outbound: 'Financial',     site_rules: ['paypal','visa','mastercard','stripe','wise'], ip_rules: [] },
  { name: 'Cloud Services',outbound: 'Cloud Services',site_rules: ['aws','azure','digitalocean','heroku','dropbox'], ip_rules: [] },
  { name: 'Non-China',     outbound: 'Non-China',     site_rules: ['geolocation-!cn'],            ip_rules: [] }
];

export const PREDEFINED_RULE_SETS = {
  minimal: ['Location:CN', 'Private', 'Non-China'],
  balanced: ['Location:CN', 'Private', 'Non-China','Github', 'Google', 'Youtube', 'AI Services', 'Telegram'],
  comprehensive: UNIFIED_RULES.map(r => r.name)
};

export const SITE_RULE_SETS = UNIFIED_RULES.reduce((acc, r) => {
  r.site_rules.forEach(s => { acc[s] = `geosite-${s}.srs`; });
  return acc;
}, {});

export const IP_RULE_SETS = UNIFIED_RULES.reduce((acc, r) => {
  r.ip_rules.forEach(i => { acc[i] = `geoip-${i}.srs`; });
  return acc;
}, {});

export const CLASH_SITE_RULE_SETS = UNIFIED_RULES.reduce((acc, r) => {
  r.site_rules.forEach(s => { acc[s] = `${s}.mrs`; });
  return acc;
}, {});

export const CLASH_IP_RULE_SETS = UNIFIED_RULES.reduce((acc, r) => {
  r.ip_rules.forEach(i => { acc[i] = `${i}.mrs`; });
  return acc;
}, {});

export function getOutbounds(selectedRuleNames) {
  if (!Array.isArray(selectedRuleNames)) return [];
  return UNIFIED_RULES.filter(r => selectedRuleNames.includes(r.name)).map(r => r.name);
}

function getTranslatedOutbound(label) {
  if (!t || typeof t !== 'function') return label;
  try {
    const v = t('outboundNames.' + label);
    return v && v !== `outboundNames.${label}` ? v : label;
  } catch {
    return label;
  }
}

export function generateRules(selectedRules = [], customRules = []) {
  if (!selectedRules || selectedRules.length === 0) {
    selectedRules = PREDEFINED_RULE_SETS.minimal;
  } else if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) {
    selectedRules = PREDEFINED_RULE_SETS[selectedRules];
  } else if (!Array.isArray(selectedRules)) {
    selectedRules = PREDEFINED_RULE_SETS.minimal;
  }

  const rules = [];

  UNIFIED_RULES.forEach(r => {
    if (selectedRules.includes(r.name)) {
      rules.push({
        site_rules: r.site_rules,
        ip_rules: r.ip_rules,
        domain_suffix: r.domain_suffix || [],
        ip_cidr: r.ip_cidr || [],
        outbound: getTranslatedOutbound(r.name)
      });
    }
  });

  if (Array.isArray(customRules)) {
    customRules.forEach(r => {
      if (!r || !r.name) return;
      rules.unshift({
        site_rules: r.site ? r.site.split(',').map(s => s.trim()).filter(Boolean) : [],
        ip_rules: r.ip ? r.ip.split(',').map(i => i.trim()).filter(Boolean) : [],
        domain_suffix: r.domain_suffix ? r.domain_suffix.split(',').map(d => d.trim()).filter(Boolean) : [],
        domain_keyword: r.domain_keyword ? r.domain_keyword.split(',').map(k => k.trim()).filter(Boolean) : [],
        ip_cidr: r.ip_cidr ? r.ip_cidr.split(',').map(c => c.trim()).filter(Boolean) : [],
        protocol: r.protocol ? r.protocol.split(',').map(p => p.trim()).filter(Boolean) : [],
        outbound: getTranslatedOutbound(r.name)
      });
    });
  }

  const seen = new Set();
  return rules.filter(r => {
    const key = JSON.stringify(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getBaseUrl(original) {
  const base = RULE_BASE_OVERRIDE || original;
  return base.replace(/\/*$/, '');
}

export function generateRuleSets(selectedRules = [], customRules = []) {
  if (!selectedRules || selectedRules.length === 0) {
    selectedRules = PREDEFINED_RULE_SETS.minimal;
  } else if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) {
    selectedRules = PREDEFINED_RULE_SETS[selectedRules];
  } else if (!Array.isArray(selectedRules)) {
    selectedRules = PREDEFINED_RULE_SETS.minimal;
  }

  const selectedSet = new Set(selectedRules);
  const siteSet = new Set();
  const ipSet = new Set();

  UNIFIED_RULES.forEach(r => {
    if (selectedSet.has(r.name)) {
      r.site_rules.forEach(s => siteSet.add(s));
      r.ip_rules.forEach(i => ipSet.add(i));
    }
  });

  if (Array.isArray(customRules)) {
    customRules.forEach(r => {
      if (r && r.site) r.site.split(',').forEach(s => siteSet.add(s.trim()));
      if (r && r.ip) r.ip.split(',').forEach(i => ipSet.add(i.trim()));
    });
  }

  const site_rule_sets = Array.from(siteSet).map(tag => ({
    tag,
    type: 'remote',
    format: 'binary',
    url: `${getBaseUrl(SITE_RULE_SET_BASE_URL)}/geosite-${tag}.srs`
  }));

  const ip_rule_sets = Array.from(ipSet).map(tag => ({
    tag: `${tag}-ip`,
    type: 'remote',
    format: 'binary',
    url: `${getBaseUrl(IP_RULE_SET_BASE_URL)}/geoip-${tag}.srs`
  }));

  if (!selectedSet.has('Non-China')) {
    site_rule_sets.push({
      tag: 'geolocation-!cn',
      type: 'remote',
      format: 'binary',
      url: `${getBaseUrl(SITE_RULE_SET_BASE_URL)}/geosite-geolocation-!cn.srs`
    });
  }

  return { site_rule_sets, ip_rule_sets };
}

export function generateClashRuleSets(selectedRules = [], customRules = []) {
  if (!selectedRules || selectedRules.length === 0) {
    selectedRules = PREDEFINED_RULE_SETS.minimal;
  } else if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) {
    selectedRules = PREDEFINED_RULE_SETS[selectedRules];
  } else if (!Array.isArray(selectedRules)) {
    selectedRules = PREDEFINED_RULE_SETS.minimal;
  }

  const selectedSet = new Set(selectedRules);
  const siteSet = new Set();
  const ipSet = new Set();

  UNIFIED_RULES.forEach(r => {
    if (selectedSet.has(r.name)) {
      r.site_rules.forEach(s => siteSet.add(s));
      r.ip_rules.forEach(i => ipSet.add(i));
    }
  });

  if (Array.isArray(customRules)) {
    customRules.forEach(r => {
      if (r && r.site) r.site.split(',').forEach(s => siteSet.add(s.trim()));
      if (r && r.ip) r.ip.split(',').forEach(i => ipSet.add(i.trim()));
    });
  }

  const site_rule_providers = {};
  const ip_rule_providers = {};

  Array.from(siteSet).forEach(tag => {
    site_rule_providers[tag] = {
      type: 'http',
      format: 'mrs',
      behavior: 'domain',
      url: `${getBaseUrl(CLASH_SITE_RULE_SET_BASE_URL)}/${tag}.mrs`,
      path: `./ruleset/${tag}.mrs`,
      interval: 86400
    };
  });

  Array.from(ipSet).forEach(tag => {
    ip_rule_providers[tag] = {
      type: 'http',
      format: 'mrs',
      behavior: 'ipcidr',
      url: `${getBaseUrl(CLASH_IP_RULE_SET_BASE_URL)}/${tag}.mrs`,
      path: `./ruleset/${tag}.mrs`,
      interval: 86400
    };
  });

  if (!selectedSet.has('Non-China')) {
    site_rule_providers['geolocation-!cn'] = {
      type: 'http',
      format: 'mrs',
      behavior: 'domain',
      url: `${getBaseUrl(CLASH_SITE_RULE_SET_BASE_URL)}/geolocation-!cn.mrs`,
      path: './ruleset/geolocation-!cn.mrs',
      interval: 86400
    };
  }

  return {
    site_rule_providers: Object.fromEntries(
      Object.entries(site_rule_providers).filter((v, i, a) => a.findIndex(x => x[0] === v[0]) === i)
    ),
    ip_rule_providers: Object.fromEntries(
      Object.entries(ip_rule_providers).filter((v, i, a) => a.findIndex(x => x[0] === v[0]) === i)
    )
  };
}

export const SING_BOX_CONFIG = {
  dns: {
    servers: [
      { type: 'tcp', tag: 'dns_proxy', server: '1.1.1.1', detour: '🚀 节点选择', domain_resolver: 'dns_resolver' },
      { type: 'https', tag: 'dns_direct', server: 'dns.alidns.com', domain_resolver: 'dns_resolver' },
      { type: 'udp', tag: 'dns_resolver', server: '223.5.5.5' },
      { type: 'fakeip', tag: 'dns_fakeip', inet4_range: '198.18.0.0/15', inet6_range: 'fc00::/18' }
    ],
    rules: [
      { rule_set: 'geolocation-!cn', query_type: ['A', 'AAAA'], server: 'dns_fakeip' },
      { rule_set: 'geolocation-!cn', query_type: 'CNAME', server: 'dns_proxy' }
    ],
    final: 'dns_direct',
    independent_cache: true
  },
  ntp: { enabled: true, server: 'time.apple.com', server_port: 123, interval: '30m' },
  inbounds: [
    { type: 'mixed', tag: 'mixed-in', listen: '0.0.0.0', listen_port: 2080 },
    { type: 'tun', tag: 'tun-in', address: '172.19.0.1/30', auto_route: true, strict_route: true, stack: 'mixed', sniff: true }
  ],
  outbounds: [
    { type: 'block', tag: 'REJECT' },
    { type: 'direct', tag: 'DIRECT' }
  ],
  route: {
    default_domain_resolver: 'dns_resolver',
    rule_set: [{ tag: 'geosite-geolocation-!cn', type: 'local', format: 'binary', path: 'geosite-geolocation-!cn.srs' }],
    rules: []
  },
  experimental: { cache_file: { enabled: true, store_fakeip: true } }
};

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
    asn: 'https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb'
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
      'geosite:geolocation-!cn': ['https://dns.cloudflare.com/dns-query', 'https://dns.google/dns-query']
    }
  },
  proxies: [],
  'proxy-groups': []
};

export const SURGE_CONFIG = {
  general: {
    allowWifiAccess: false,
    wifiAccessHttpPort: 6152,
    wifiAccessSocks5Port: 6153,
    httpListen: '127.0.0.1:6152',
    socks5Listen: '127.0.0.1:6153',
    allowHotspotAccess: false,
    skipProxy: '127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,100.64.0.0/10,17.0.0.0/8,localhost,*.local,*.crashlytics.com,seed-sequoia.siri.apple.com,sequoia.apple.com',
    testTimeout: 5,
    proxyTestUrl: 'http://cp.cloudflare.com/generate_204',
    internetTestUrl: 'http://www.apple.com/library/test/success.html',
    geoipMaxmindUrl: 'https://raw.githubusercontent.com/Loyalsoldier/geoip/release/Country.mmdb',
    ipv6: false,
    showErrorPageForReject: true,
    dnsServer: '119.29.29.29, 180.184.1.1, 223.5.5.5, system',
    encryptedDnsServer: 'https://223.5.5.5/dns-query',
    excludeSimpleHostnames: true,
    readEtcHosts: true,
    alwaysRealIp: '*.msftconnecttest.com, *.msftncsi.com, *.srv.nintendo.net, *.stun.playstation.net, xbox.*.microsoft.com, *.xboxlive.com, *.logon.battlenet.com.cn, *.logon.battle.net, stun.l.google.com, easy-login.10099.com.cn,*-update.xoyocdn.com, *.prod.cloud.netflix.com, appboot.netflix.com, *-appboot.netflix.com',
    hijackDns: '*:53',
    udpPolicyNotSupportedBehaviour: 'REJECT',
    hideVpnIcon: false
  },
  replica: {
    hideAppleRequest: true,
    hideCrashlyticsRequest: true,
    useKeywordFilter: false,
    hideUdp: false
  }
};
