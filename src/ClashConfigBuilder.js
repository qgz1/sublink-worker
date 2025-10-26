import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        if (!baseConfig) baseConfig = CLASH_CONFIG;
        super(inputString, baseConfig, lang, userAgent);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
    }

    getProxies() {
        return this.config.proxies || [];
    }

    getProxyName(proxy) {
        return proxy.name;
    }

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
            case 'vless':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled
                        ? {
                              'public-key': proxy.tls.reality.public_key,
                              'short-id': proxy.tls.reality.short_id
                          }
                        : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc'
                        ? { 'grpc-service-name': proxy.transport.service_name }
                        : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure,
                    flow: proxy.flow ?? undefined
                };
            case 'hysteria2':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    obfs: proxy.obfs?.type,
                    'obfs-password': proxy.obfs?.password,
                    password: proxy.password,
                    auth: proxy.auth,
                    up: proxy.up_mbps,
                    down: proxy.down_mbps,
                    'recv-window-conn': proxy.recv_window_conn,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure ?? true
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
                        : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc'
                        ? { 'grpc-service-name': proxy.transport.service_name }
                        : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure,
                    flow: proxy.flow ?? undefined
                };
            case 'tuic':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    password: proxy.password,
                    'congestion-controller': proxy.congestion,
                    'skip-cert-verify': proxy.tls?.insecure,
                    'disable-sni': true,
                    alpn: proxy.tls?.alpn,
                    sni: proxy.tls?.server_name,
                    'udp-relay-mode': 'native'
                };
            default:
                return proxy;
        }
    }

    class ConfigBuilder {
    constructor() {
        this.config = {
            proxies: [],
            'proxy-groups': [],
            rules: []
        };
    }

    // 添加代理到配置
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

    // 创建自动测速组
    addAutoSelectGroup(proxyList) {
        if (this.config['proxy-groups']?.some(g => g.name === '🚀 自动选择')) return;

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

    // 创建节点选择组
    addNodeSelectGroup(proxyList) {
        if (this.config['proxy-groups']?.some(g => g.name === '🌐 节点选择')) return;

        this.config['proxy-groups'].unshift({
            name: '🌐 节点选择',
            type: 'select',
            proxies: ['🚀 自动选择', 'DIRECT', 'REJECT', ...proxyList]
        });
    }

    // 创建 FallBack 组
    addFallBackGroup(proxyList) {
        if (this.config['proxy-groups']?.some(g => g.name === '🧱 Fallback')) return;

        this.config['proxy-groups'].push({
            name: '🧱 Fallback',
            type: 'select',
            proxies: ['🌐 节点选择', ...proxyList]
        });
    }

    // 生成最简规则
    generateRules() {
        this.config.rules = ['MATCH,🧱 Fallback'];
        return this.config.rules;
    }

    // 输出配置为 YAML
    formatConfig() {
        this.generateRules();
        return yaml.dump(this.config);
    }
}
