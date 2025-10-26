import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

// 保持 ClashConfigBuilder 的原始定义
export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        if (!baseConfig) baseConfig = CLASH_CONFIG;
        super(inputString, baseConfig, lang, userAgent);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
    }

    // 获取代理列表
    getProxies() {
        return this.config.proxies || [];
    }

    // 获取代理名称
    getProxyName(proxy) {
        return proxy.name;
    }

    // 转换代理配置（例：shadowsocks, vmess, trojan 等）
    convertProxy(proxy) {
        switch (proxy.type) {
            case 'shadowsocks':
                return {
                    name: proxy.tag,
                    type: 'ss',
                    server: proxy.server,
                    port: proxy.server_port,
                    cipher: proxy.method,
                    password: proxy.password
                };
            case 'vmess':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    alterId: proxy.alter_id,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    servername: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined
                };
            case 'trojan':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    sni: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled
                        ? {
                            'public-key': proxy.tls.reality.public_key,
                            'short-id': proxy.tls.reality.short_id
                        }
                        : undefined
                };
            default:
                return proxy;
        }
    }

    // 你可以继续添加其他方法...
}

// 新增：ConfigBuilder 类保持与 ClashConfigBuilder 同级，不嵌套
export class ConfigBuilder {
    constructor() {
        this.config = {
            proxies: [],
            'proxy-groups': [],
            rules: []
        };
    }

    // 添加代理
    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        const similar = this.config.proxies.filter(p => p.name.includes(proxy.name));

        const isIdentical = similar.some(p => {
            const { name: _, ...a } = proxy;
            const { name: __, ...b } = p;
            return JSON.stringify(a) === JSON.stringify(b);
        });

        if (isIdentical) return;
        if (similar.length > 0) proxy.name = `${proxy.name} ${similar.length + 1}`;
        this.config.proxies.push(proxy);
    }

    // 自动创建地区测速组（可选）
    addRegionGroups(proxyList) {
        const regions = {
            '🇭🇰 香港自动': /香港|HK|Hong/i,
            '🇸🇬 新加坡自动': /新加坡|SG|Singapore/i,
            '🇯🇵 日本自动': /日本|JP|Tokyo|Osaka/i,
            '🇺🇸 美国自动': /美国|US|United/i
        };

        for (const [name, regex] of Object.entries(regions)) {
            const matched = proxyList.filter(p => regex.test(p));
            if (matched.length === 0) continue;

            this.config['proxy-groups'].push({
                name,
                type: 'url-test',
                proxies: matched,
                url: 'https://cp.cloudflare.com/generate_204',
                interval: 600,
                tolerance: 50,
                lazy: true
            });
        }
    }

    // 自动测速组
    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'].push({
            name: '🚀 自动选择',
            type: 'url-test',
            proxies: proxyList,
            url: 'https://cp.cloudflare.com/generate_204',
            interval: 600,
            tolerance: 50,
            lazy: true
        });
    }

    // 节点选择组
    addNodeSelectGroup(proxyList) {
        this.config['proxy-groups'].unshift({
            name: '🌐 节点选择',
            type: 'select',
            proxies: ['🚀 自动选择', 'DIRECT', 'REJECT', ...proxyList]
        });
    }

    // Fallback 组
    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push({
            name: '🧱 Fallback',
            type: 'select',
            proxies: ['🌐 节点选择', ...proxyList]
        });
    }

    // 生成最简规则
    generateRules() {
        this.config.rules = ['MATCH,🧱 Fallback'];
    }

    // 生成最终配置（对象）
    build(proxyList) {
        this.addRegionGroups(proxyList);
        this.addAutoSelectGroup(proxyList);
        this.addNodeSelectGroup(proxyList);
        this.addFallBackGroup(proxyList);
        this.generateRules();
        return this.config;
    }

    // 转换为 YAML 文本（内置简易 YAML 转换）
    formatConfig() {
        const cfg = this.config;
        const toYaml = obj => JSON.stringify(obj, null, 2)
            .replace(/[{}"]/g, '')
            .replace(/,/g, '')
            .replace(/^/gm, '  ');
        return `proxies:\n${toYaml(cfg.proxies)}\nproxy-groups:\n${toYaml(cfg['proxy-groups'])}\nrules:\n${toYaml(cfg.rules)}`;
    }
}
