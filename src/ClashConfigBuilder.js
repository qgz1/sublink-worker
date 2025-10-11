import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        if (!baseConfig) {
            baseConfig = CLASH_CONFIG;
        }
        super(inputString, baseConfig, lang, userAgent);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
        
        // 初始化代理数组，确保只包含唯一的 DIRECT 和 REJECT
        this.config.proxies = this.config.proxies || [];
        this.ensureBasicProxies();
    }

    // 确保基本的 DIRECT 和 REJECT 代理存在且唯一
    ensureBasicProxies() {
        const hasDirect = this.config.proxies.some(p => p.name === 'DIRECT');
        const hasReject = this.config.proxies.some(p => p.name === 'REJECT');
        
        if (!hasDirect) {
            this.config.proxies.push({
                name: 'DIRECT',
                type: 'direct'
            });
        }
        
        if (!hasReject) {
            this.config.proxies.push({
                name: 'REJECT', 
                type: 'reject'
            });
        }
        
        // 移除重复的 DIRECT 和 REJECT
        this.removeDuplicateProxies();
    }

    // 移除重复的代理
    removeDuplicateProxies() {
        const seen = new Set();
        this.config.proxies = this.config.proxies.filter(proxy => {
            if (seen.has(proxy.name)) {
                console.warn(`Removing duplicate proxy: ${proxy.name}`);
                return false;
            }
            seen.add(proxy.name);
            return true;
        });
    }

    getProxies() {
        return this.config.proxies || [];
    }

    getProxyName(proxy) {
        return proxy.name;
    }

    convertProxy(proxy) {
        // 跳过 DIRECT 和 REJECT 代理的转换
        if (proxy.type === 'direct' || proxy.type === 'reject') {
            return null;
        }

        switch(proxy.type) {
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
                    type: 'vmess',
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    alterId: proxy.alter_id,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    servername: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined
                };
            case 'vless':
                return {
                    name: proxy.tag,
                    type: 'vless',
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    }: undefined,
                    'reality-opts': proxy.tls?.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo : proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls?.insecure,
                    'flow': proxy.flow ?? undefined,
                };
            case 'hysteria2':
                return {
                    name: proxy.tag,
                    type: 'hysteria2',
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    obfs: proxy.obfs?.type,
                    'obfs-password': proxy.obfs?.password,
                    auth: proxy.auth,
                    up: proxy.up_mbps,
                    down: proxy.down_mbps,
                    'recv-window-conn': proxy.recv_window_conn,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || true,
                };
            case 'trojan':
                return {
                    name: proxy.tag,
                    type: 'trojan',
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': proxy.tls?.insecure || false,
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    }: undefined
                };
            case 'tuic':
                return {
                    name: proxy.tag,
                    type: 'tuic',
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
            default:
                console.warn(`Unknown proxy type: ${proxy.type}, returning as-is`);
                return proxy;
        }
    }

    addProxyToConfig(proxy) {
        if (!proxy) return;
        
        this.config.proxies = this.config.proxies || [];
    
        // 检查是否已存在相同名称的代理
        const existingProxy = this.config.proxies.find(p => p.name === proxy.name);
        if (existingProxy) {
            console.warn(`Proxy with name ${proxy.name} already exists, skipping`);
            return;
        }
    
        // 添加代理到配置
        this.config.proxies.push(proxy);
    }

    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        
        // 创建自动选择组
        const autoSelectGroup = {
            name: '🚀 自动节点',
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'http://www.gstatic.com/generate_204',
            interval: 300,
            tolerance: 50
        };
        
        // 检查是否已存在自动选择组
        const existingGroup = this.config['proxy-groups'].find(g => g.name === '🚀 自动节点');
        if (!existingGroup) {
            this.config['proxy-groups'].push(autoSelectGroup);
        }
    }

    addNodeSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        
        // 创建节点选择组
        const nodeSelectGroup = {
            type: "select",
            name: "🚀 节点选择",
            proxies: [
                '🚀 自动节点',  // 默认选项
                'DIRECT', 
                'REJECT',
                ...proxyList
            ]
        };
        
        // 检查是否已存在节点选择组
        const existingGroup = this.config['proxy-groups'].find(g => g.name === '🚀 节点选择');
        if (!existingGroup) {
            this.config['proxy-groups'].unshift(nodeSelectGroup);
        }
    }

    addOutboundGroups(outbounds, proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        
        outbounds.forEach(outbound => {
            if (outbound !== '🚀 节点选择') {
                const groupName = this.getOutboundGroupName(outbound);
                const existingGroup = this.config['proxy-groups'].find(g => g.name === groupName);
                
                if (!existingGroup) {
                    this.config['proxy-groups'].push({
                        type: "select",
                        name: groupName,
                        proxies: [
                            '🚀 自动节点',
                            'DIRECT',
                            'REJECT',
                            ...proxyList
                        ]
                    });
                }
            }
        });
    }

    // 根据规则名称获取代理组名称
    getOutboundGroupName(outbound) {
        const groupNames = {
            'Ad Block': '🛡️ 广告拦截',
            'AI Services': '🤖 AI服务',
            'Bilibili': '📺 B站',
            'Youtube': '🎥 YouTube', 
            'Google': '🔍 Google',
            'Private': '🔒 私有网络',
            'Location:CN': '🇨🇳 中国网站',
            'Telegram': '✈️ Telegram',
            'Github': '💻 GitHub',
            'Microsoft': '💼 Microsoft',
            'Apple': '🍎 Apple',
            'Social Media': '👥 社交媒体',
            'Streaming': '🎬 流媒体',
            'Gaming': '🎮 游戏',
            'Education': '🎓 教育',
            'Financial': '💳 金融',
            'Cloud Services': '☁️ 云服务',
            'Non-China': '🌍 非中国'
        };
        
        return groupNames[outbound] || outbound;
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                const existingGroup = this.config['proxy-groups'].find(g => g.name === rule.name);
                
                if (!existingGroup) {
                    this.config['proxy-groups'].push({
                        type: "select",
                        name: rule.name,
                        proxies: [
                            '🚀 自动节点',
                            'DIRECT',
                            'REJECT',
                            ...proxyList
                        ]
                    });
                }
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        
        const fallbackGroup = {
            type: "select",
            name: "🐟 漏网之鱼",
            proxies: [
                '🚀 自动节点',
                'DIRECT',
                'REJECT',
                ...proxyList
            ]
        };
        
        const existingGroup = this.config['proxy-groups'].find(g => g.name === '🐟 漏网之鱼');
        if (!existingGroup) {
            this.config['proxy-groups'].push(fallbackGroup);
        }
    }

    // 生成规则
    generateRules() {
        const rules = generateRules(this.selectedRules, this.customRules);
        
        // 将规则名称映射到代理组名称
        return rules.map(rule => {
            let groupName;
            
            // 特殊处理直连和拒绝规则
            if (rule.outbound === 'DIRECT' || rule.outbound === 'REJECT') {
                groupName = rule.outbound;
            } else if (rule.outbound === 'Location:CN' || rule.outbound === 'Private') {
                groupName = 'DIRECT';
            } else {
                // 其他规则使用自动选择
                groupName = '🚀 自动节点';
            }
            
            return {
                ...rule,
                groupName: groupName
            };
        });
    }

    formatConfig() {
        const rules = this.generateRules();
        const ruleResults = [];
        
        // 获取.mrs规则集配置
        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
        
        // 添加规则集提供者
        this.config['rule-providers'] = {
            ...site_rule_providers,
            ...ip_rule_providers
        };

        // 处理域名规则
        rules.filter(rule => rule.domain_suffix && rule.domain_suffix.length > 0).forEach(rule => {
            rule.domain_suffix.forEach(suffix => {
                ruleResults.push(`DOMAIN-SUFFIX,${suffix},${rule.groupName}`);
            });
        });

        rules.filter(rule => rule.domain_keyword && rule.domain_keyword.length > 0).forEach(rule => {
            rule.domain_keyword.forEach(keyword => {
                ruleResults.push(`DOMAIN-KEYWORD,${keyword},${rule.groupName}`);
            });
        });

        // 处理站点规则
        rules.filter(rule => rule.site_rules && rule.site_rules.length > 0).forEach(rule => {
            rule.site_rules.forEach(site => {
                ruleResults.push(`RULE-SET,${site},${rule.groupName}`);
            });
        });

        // 处理IP规则
        rules.filter(rule => rule.ip_rules && rule.ip_rules.length > 0).forEach(rule => {
            rule.ip_rules.forEach(ip => {
                ruleResults.push(`RULE-SET,${ip},${rule.groupName},no-resolve`);
            });
        });

        // 处理CIDR规则
        rules.filter(rule => rule.ip_cidr && rule.ip_cidr.length > 0).forEach(rule => {
            rule.ip_cidr.forEach(cidr => {
                ruleResults.push(`IP-CIDR,${cidr},${rule.groupName},no-resolve`);
            });
        });

        // 添加基本规则
        const basicRules = [
            // 局域网直连
            'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
            'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
            'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
            'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
            'IP-CIDR,100.64.0.0/10,DIRECT,no-resolve',
            
            // GEOIP 中国直连
            'GEOIP,CN,DIRECT',
            
            // 最终规则 - 使用漏网之鱼组
            'MATCH,🐟 漏网之鱼'
        ];

        this.config.rules = [...basicRules, ...ruleResults];

        // 确保配置完整性
        this.ensureConfigIntegrity();

        return yaml.dump(this.config, {
            lineWidth: -1,
            noRefs: true,
            noCompatMode: true
        });
    }

    // 确保配置完整性
    ensureConfigIntegrity() {
        // 确保所有代理组中引用的代理都存在
        this.config['proxy-groups']?.forEach(group => {
            group.proxies = group.proxies.filter(proxyName => {
                // 检查代理是否存在
                const exists = this.config.proxies?.some(p => p.name === proxyName) || 
                              ['DIRECT', 'REJECT'].includes(proxyName);
                if (!exists) {
                    console.warn(`Removing non-existent proxy ${proxyName} from group ${group.name}`);
                }
                return exists;
            });
        });

        // 确保规则中引用的代理组都存在
        const validGroups = new Set(this.config['proxy-groups']?.map(g => g.name) || []);
        validGroups.add('DIRECT');
        validGroups.add('REJECT');
        
        this.config.rules = this.config.rules?.filter(rule => {
            const match = rule.match(/^[^,]+,([^,]+),/);
            if (match) {
                const groupName = match[1];
                if (!validGroups.has(groupName)) {
                    console.warn(`Removing rule with non-existent group: ${rule}`);
                    return false;
                }
            }
            return true;
        });
    }

    // 构建配置
    build() {
        // 清空现有代理组
        this.config['proxy-groups'] = [];
        
        // 确保基本代理存在
        this.ensureBasicProxies();
        
        // 获取代理列表（排除 DIRECT 和 REJECT）
        const proxyList = this.getProxies()
            .map(proxy => this.getProxyName(proxy))
            .filter(name => name !== 'DIRECT' && name !== 'REJECT');
        
        // 确保有代理节点
        if (proxyList.length === 0) {
            console.warn('No proxies found, configuration may not work properly');
        }
        
        // 添加代理组
        this.addAutoSelectGroup(proxyList);
        this.addNodeSelectGroup(proxyList);
        
        const outbounds = getOutbounds(this.selectedRules);
        this.addOutboundGroups(outbounds, proxyList);
        this.addCustomRuleGroups(proxyList);
        this.addFallBackGroup(proxyList);

        // 格式化配置
        return this.formatConfig();
    }

    // 验证配置
    validateConfig() {
        try {
            const configYaml = this.build();
            const parsed = yaml.load(configYaml);
            
            // 基本验证
            if (!parsed.proxies) {
                throw new Error('Missing proxies section');
            }
            if (!parsed['proxy-groups']) {
                throw new Error('Missing proxy-groups section');
            }
            if (!parsed.rules) {
                throw new Error('Missing rules section');
            }
            
            // 检查重复代理名称
            const proxyNames = new Set();
            parsed.proxies.forEach(proxy => {
                if (proxyNames.has(proxy.name)) {
                    throw new Error(`Duplicate proxy name: ${proxy.name}`);
                }
                proxyNames.add(proxy.name);
            });
            
            return true;
        } catch (error) {
            console.error('Configuration validation failed:', error);
            return false;
        }
    }
}
