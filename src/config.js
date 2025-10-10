// src/config.js
import { t } from './i18n';

/**
 * ✅ 国内外分流优化版
 * - 国内（CN / Private / 内网）直连
 * - 国外（!CN / Google / AI / YouTube 等）代理
 * - 兼容 SingBox / Clash / Surge / Worker
 * - 修复缺失的 generateRuleSets & generateClashRuleSets 导出
 */

// ====== 基础规则源地址 ======
export const SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geosite/';
export const IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/lyc8503/sing-box-rules/refs/heads/rule-set-geoip/';
export const CLASH_SITE_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/';
export const CLASH_IP_RULE_SET_BASE_URL = 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/';
export const SURGE_SITE_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geosite/';
export const SURGE_IP_RULE_SET_BASEURL = 'https://gh-proxy.com/https://github.com/NSZA156/surge-geox-rules/raw/refs/heads/release/geo/geoip/';

// ====== 自定义规则占位 ======
export const CUSTOM_RULES = [];

// ====== 统一规则结构（国内直连 + 国外代理）======
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
	{ name: 'Social Media', outbound: t('outboundNames.Social Media'), site_rules: ['facebook', 'instagram', 'twitter', 'tiktok', 'linkedin'], ip_rules: [] },
	{ name: 'Streaming', outbound: t('outboundNames.Streaming'), site_rules: ['netflix', 'hulu', 'disney', 'hbo', 'amazon', 'bahamut'], ip_rules: [] },
	{ name: 'Gaming', outbound: t('outboundNames.Gaming'), site_rules: ['steam', 'epicgames', 'ea', 'ubisoft', 'blizzard'], ip_rules: [] },
	{ name: 'Education', outbound: t('outboundNames.Education'), site_rules: ['coursera', 'edx', 'udemy', 'khanacademy', 'category-scholar-!cn'], ip_rules: [] },
	{ name: 'Financial', outbound: t('outboundNames.Financial'), site_rules: ['paypal', 'visa', 'mastercard', 'stripe', 'wise'], ip_rules: [] },
	{ name: 'Cloud Services', outbound: t('outboundNames.Cloud Services'), site_rules: ['aws', 'azure', 'digitalocean', 'heroku', 'dropbox'], ip_rules: [] },
	{ name: 'Non-China', outbound: t('outboundNames.Non-China'), site_rules: ['geolocation-!cn'], ip_rules: [] }
];

// ====== 预设策略组 ======
export const PREDEFINED_RULE_SETS = {
	minimal: ['Location:CN', 'Private', 'Non-China'],
	balanced: ['Location:CN', 'Private', 'Non-China', 'Github', 'Google', 'Youtube', 'AI Services', 'Telegram'],
	comprehensive: UNIFIED_RULES.map(rule => rule.name)
};

// ====== 规则文件映射 ======
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

// ====== 工具函数 ======
export function getOutbounds(selectedRuleNames) {
	if (!selectedRuleNames || !Array.isArray(selectedRuleNames)) return [];
	return UNIFIED_RULES.filter(rule => selectedRuleNames.includes(rule.name)).map(rule => rule.name);
}

export function generateRules(selectedRules = [], customRules = []) {
	if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) {
		selectedRules = PREDEFINED_RULE_SETS[selectedRules];
	}
	if (!selectedRules || selectedRules.length === 0) selectedRules = PREDEFINED_RULE_SETS.minimal;

	const rules = [];
	UNIFIED_RULES.forEach(rule => {
		if (selectedRules.includes(rule.name)) {
			rules.push({
				site_rules: rule.site_rules,
				ip_rules: rule.ip_rules,
				outbound: rule.name
			});
		}
	});

	customRules.reverse();
	customRules.forEach(rule => {
		rules.unshift({
			site_rules: rule.site.split(','),
			ip_rules: rule.ip.split(','),
			outbound: rule.name
		});
	});

	return rules;
}

// ========================
// ✅ 兼容导出：SingBox & Clash
// ========================
export function generateRuleSets(selectedRules = []) {
	if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) {
		selectedRules = PREDEFINED_RULE_SETS[selectedRules];
	}
	if (!selectedRules || selectedRules.length === 0) selectedRules = PREDEFINED_RULE_SETS.minimal;

	const ruleSets = [];
	UNIFIED_RULES.forEach((rule) => {
		if (selectedRules.includes(rule.name)) {
			rule.site_rules.forEach((site) => ruleSets.push({ type: 'site', name: site, file: SITE_RULE_SETS[site] }));
			rule.ip_rules.forEach((ip) => ruleSets.push({ type: 'ip', name: ip, file: IP_RULE_SETS[ip] }));
		}
	});
	return ruleSets;
}

export function generateClashRuleSets(selectedRules = []) {
	if (typeof selectedRules === 'string' && PREDEFINED_RULE_SETS[selectedRules]) {
		selectedRules = PREDEFINED_RULE_SETS[selectedRules];
	}
	if (!selectedRules || selectedRules.length === 0) selectedRules = PREDEFINED_RULE_SETS.minimal;

	const ruleSets = [];
	UNIFIED_RULES.forEach((rule) => {
		if (selectedRules.includes(rule.name)) {
			rule.site_rules.forEach((site) => ruleSets.push({ type: 'site', name: site, file: CLASH_SITE_RULE_SETS[site] }));
			rule.ip_rules.forEach((ip) => ruleSets.push({ type: 'ip', name: ip, file: CLASH_IP_RULE_SETS[ip] }));
		}
	});
	return ruleSets;
}

// ========================
// 📦 SingBox 默认配置
// ========================
export const SING_BOX_CONFIG = {
	dns: {
		servers: [
			{ type: "tcp", tag: "dns_proxy", server: "1.1.1.1", detour: "🚀 节点选择", domain_resolver: "dns_resolver" },
			{ type: "https", tag: "dns_direct", server: "dns.alidns.com", domain_resolver: "dns_resolver" },
			{ type: "udp", tag: "dns_resolver", server: "223.5.5.5" },
			{ type: "fakeip", tag: "dns_fakeip", inet4_range: "198.18.0.0/15", inet6_range: "fc00::/18" }
		],
		rules: [
			{ rule_set: "geolocation-!cn", query_type: ["A", "AAAA"], server: "dns_fakeip" },
			{ rule_set: "geolocation-!cn", query_type: "CNAME", server: "dns_proxy" },
			{ query_type: ["A", "AAAA", "CNAME"], invert: true, action: "predefined", rcode: "REFUSED" }
		],
		final: "dns_direct",
		independent_cache: true
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
		rule_set: [{ tag: "geosite-geolocation-!cn", type: "local", format: "binary", path: "geosite-geolocation-!cn.srs" }],
		rules: []
	}
};

// ========================
// 📦 Clash 默认配置
// ========================
export const CLASH_CONFIG = {
	port: 7890,
	"socks-port": 7891,
	"allow-lan": false,
	mode: "rule",
	"log-level": "info",
	"geodata-mode": true,
	"geo-auto-update": true,
	"geodata-loader": "standard",
	"geo-update-interval": 24,
	"geox-url": {
		geoip: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat",
		geosite: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
		mmdb: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb",
		asn: "https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb"
	},
	"dns": {
		enable: true,
		ipv6: true,
		"respect-rules": true,
		"enhanced-mode": "fake-ip",
		nameserver: ["https://120.53.53.53/dns-query", "https://223.5.5.5/dns-query"],
		"proxy-server-nameserver": ["https://120.53.53.53/dns-query", "https://223.5.5.5/dns-query"],
		"nameserver-policy": {
			"geosite:cn,private": ["https://120.53.53.53/dns-query", "https://223.5.5.5/dns-query"],
			"geosite:geolocation-!cn": ["https://dns.cloudflare.com/dns-query", "https://dns.google/dns-query"]
		}
	},
	proxies: [],
	"proxy-groups": []
};

// ========================
// 📦 Surge 默认配置
// ========================
export const SURGE_CONFIG = {
	general: {
		'allow-wifi-access': false,
		'wifi-access-http-port': 6152,
		'wifi-access-socks5-port': 6153,
		'http-listen': '127.0.0.1:6152',
		'socks5-listen': '127.0.0.1:6153',
		'skip-proxy': '127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,localhost,*.local',
		'test-timeout': 5,
		'proxy-test-url': 'http://cp.cloudflare.com/generate_204',
		'internet-test-url': 'http://www.apple.com/library/test/success.html',
		'dns-server': '119.29.29.29,223.5.5.5,system',
		'encrypted-dns-server': 'https://223.5.5.5/dns-query'
	}
};
