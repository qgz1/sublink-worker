import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig = CLASH_CONFIG, lang, userAgent) {
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

    proxyTypeHandlers = {
        'shadowsocks': this.convertShadowsocks,
        'vmess': this.convertVmess,
        'vless': this.convertVless,
        'hysteria2': this.convertHysteria2,
        'trojan': this.convertTrojan,
        'tuic': this.convertTuic
    };

    convertProxy(proxy) {
        const handler = this.proxyTypeHandlers[proxy.type];
        return handler ? handler.call(this, proxy) : proxy;
    }

    convertShadowsocks(proxy) {
        return {
            name: proxy.tag,
            type: 'ss',
            server: proxy.server,
            port: proxy.server_port,
            cipher: proxy.method,
            password: proxy.password
        };
    }

    convertVmess(proxy) {
        return {
            name: proxy.tag,
            type: 'vmess',
            server: proxy.server,
            port: proxy.server_port,
            uuid: proxy.uuid,
            alterId: proxy.alter_id,
            cipher: proxy.security,
            tls: proxy.tls?.enabled ?? false,
            servername: proxy.tls?.server_name ?? '',
            'skip-cert-verify': proxy.tls?.insecure ?? false,
            network: proxy.transport?.type || proxy.network || 'tcp',
            'ws-opts': this.buildWsOpts(proxy),
            'http-opts': this.buildHttpOpts(proxy),
            'grpc-opts': this.buildGrpcOpts(proxy),
            'h2-opts': this.buildH2Opts(proxy)
        };
    }

    convertVless(proxy) {
        return {
            name: proxy.tag,
            type: 'vless',
            server: proxy.server,
            port: proxy.server_port,
            uuid: proxy.uuid,
            cipher: proxy.security,
            tls: proxy.tls?.enabled ?? false,
            'client-fingerprint': proxy.tls?.utls?.fingerprint,
            servername: proxy.tls?.server_name ?? '',
            network: proxy.transport?.type || 'tcp',
            'ws-opts': this.buildWsOpts(proxy),
            'reality-opts': proxy.tls?.reality?.enabled ? {
                'public-key': proxy.tls.reality.public_key,
                'short-id': proxy.tls.reality.short_id
            } : undefined,
            'grpc-opts': this.buildGrpcOpts(proxy),
            tfo: proxy.tcp_fast_open,
            'skip-cert-verify': proxy.tls?.insecure,
            'flow': proxy.flow ?? undefined,
        };
    }

    convertHysteria2(proxy) {
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
            sni: proxy.tls?.server_name ?? '',
            'skip-cert-verify': proxy.tls?.insecure ?? false,
        };
    }

    convertTrojan(proxy) {
        return {
            name: proxy.tag,
            type: proxy.type,
            server: proxy.server,
            port: proxy.server_port,
            password: proxy.password,
            cipher: proxy.security,
            tls: proxy.tls?.enabled ?? false,
            'client-fingerprint': proxy.tls?.utls?.fingerprint,
            sni: proxy.tls?.server_name ?? '',
            network: proxy.transport?.type || 'tcp',
            'ws-opts': this.buildWsOpts(proxy),
            'reality-opts': proxy.tls?.reality?.enabled ? {
                'public-key': proxy.tls.reality.public_key,
                'short-id': proxy.tls.reality.short_id
            } : undefined,
            'grpc-opts': this.buildGrpcOpts(proxy),
            tfo: proxy.tcp_fast_open,
            'skip-cert-verify': proxy.tls?.insecure,
            'flow': proxy.flow ?? undefined,
        };
    }

    convertTuic(proxy) {
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
            'alpn': proxy.tls?.alpn,
            'sni': proxy.tls?.server_name,
            'udp-relay-mode': 'native',
        };
    }

    buildWsOpts(proxy) {
        if (proxy.transport?.type === 'ws') {
            const obj = {};
            if (proxy.transport?.path !== undefined) obj.path = proxy.transport.path;
            if (proxy.transport?.headers && Object.keys(proxy.transport.headers).length > 0) obj.headers = proxy.transport.headers;
            return Object.keys(obj).length > 0 ? obj : undefined;
        }
        return undefined;
    }

    buildHttpOpts(proxy) {
        if (proxy.transport?.type === 'http') {
            const opts = {};
            opts.method = proxy.transport?.method || 'GET';
            const pathVal = proxy.transport?.path;
            opts.path = Array.isArray(pathVal) ? pathVal : [pathVal ?? '/'];
            if (proxy.transport?.headers && Object.keys(proxy.transport.headers).length > 0) opts.headers = proxy.transport.headers;
            return Object.keys(opts).length > 0 ? opts : undefined;
        }
        return undefined;
    }

    buildGrpcOpts(proxy) {
        if (proxy.transport?.type === 'grpc') {
            const obj = {};
            if (proxy.transport?.service_name !== undefined) obj['grpc-service-name'] = proxy.transport.service_name;
            return Object.keys(obj).length > 0 ? obj : undefined;
        }
        return undefined;
    }

    buildH2Opts(proxy) {
        if (proxy.transport?.type === 'h2') {
            const obj = {};
            if (proxy.transport?.path !== undefined) obj.path = proxy.transport.path;
            if (proxy.transport?.host !== undefined) obj.host = proxy.transport.host;
            return Object.keys(obj).length > 0 ? obj : undefined;
        }
        return undefined;
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        const similar = this.config.proxies.filter(p => p.name.includes(proxy.name));
        const same = similar.some(p => {
            const a = { ...proxy };
            const b = { ...p };
            delete a.name;
            delete b.name;
            return JSON.stringify(a) === JSON.stringify(b);
        });
        if (same) return;
        if (similar.length > 0) proxy.name = `${proxy.name} ${similar.length + 1}`;
        this.config.proxies.push(proxy);
    }

    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push({
            name: t('outboundNames.Auto Select'),
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://www.gstatic.com/generate_204',
            interval: 300,
            lazy: false
        });
    }

    addNodeSelectGroup(proxyList) {
        proxyList.unshift(t('outboundNames.Auto Select'), 'DIRECT', 'REJECT');
        this.config['proxy-groups'].unshift({
            type: 'select',
            name: t('outboundNames.Node Select'),
            proxies: proxyList
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        outbounds.forEach(outbound => {
            const name = t(`outboundNames.${outbound}`);
            if (outbound === 'Node Select') return;
            if (name === '🔒 国内服务' || name === '🏠 私有网络') {
                this.config['proxy-groups'].push({
                    type: 'select',
                    name,
                    proxies: ['DIRECT']
                });
                return;
            }
            this.config['proxy-groups'].push({
                type: 'select',
                name,
                proxies: [t('outboundNames.Node Select'), ...proxyList]
            });
        });
    }


    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config['proxy-groups'].push({
                    type: 'select',
                    name: t(`outboundNames.${rule.name}`),
                    proxies: [t('outboundNames.Node Select'), ...proxyList]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push({
            type: 'select',
            name: t('outboundNames.Fall Back'),
            proxies: [t('outboundNames.Node Select'), ...proxyList]
        });
    }

    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    formatConfig() {
        const rules = this.generateRules();
        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        this.config['rule-providers'] = {
            ...site_rule_providers,
            ...ip_rule_providers
        };
        const ruleResults = this.buildRules(rules);
        this.config.rules = [...ruleResults, `MATCH,${t('outboundNames.Fall Back')}`];
        return yaml.dump(this.config);
    }

    buildRules(rules) {
        const results = [];
        for (const rule of rules) {
            if (rule.domain_suffix || rule.domain_keyword) {
                (rule.domain_suffix || []).forEach(suffix => {
                    results.push(`DOMAIN-SUFFIX,${suffix},${t('outboundNames.' + rule.outbound)}`);
                });
                (rule.domain_keyword || []).forEach(keyword => {
                    results.push(`DOMAIN-KEYWORD,${keyword},${t('outboundNames.' + rule.outbound)}`);
                });
            }
            if (rule.site_rules && rule.site_rules.length > 0) {
                rule.site_rules.forEach(site => {
                    results.push(`RULE-SET,${site},${t('outboundNames.' + rule.outbound)}`);
                });
            }
            if (rule.ip_rules && rule.ip_rules.length > 0) {
                rule.ip_rules.forEach(ip => {
                    results.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`);
                });
            }
            if (rule.ip_cidr && rule.ip_cidr.length > 0) {
                rule.ip_cidr.forEach(cidr => {
                    results.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`);
                });
            }
        }
        return results;
    }
}
