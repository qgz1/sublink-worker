// ClashConfigBuilder.ts
import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

/**
 * 类型定义（必要字段和常见可选字段）
 */
type ProxyType = 'ss' | 'vmess' | 'vless' | 'trojan' | 'hysteria2' | 'tuic' | string;

export interface RawProxyInput {
  tag?: string;
  name?: string;
  type?: string;
  server?: string;
  server_port?: number;
  method?: string;
  password?: string;
  uuid?: string;
  alter_id?: number;
  security?: string;
  tls?: any;
  transport?: any;
  obfs?: any;
  up_mbps?: number;
  down_mbps?: number;
  congestion?: string;
  tcp_fast_open?: boolean;
  flow?: string;
  [k: string]: any;
}

export interface ClashProxy {
  name: string;
  type: ProxyType;
  server: string;
  port: number;
  'skip-cert-verify'?: boolean;
  // 可选字段
  cipher?: string;
  password?: string;
  uuid?: string;
  alterId?: number;
  network?: string;
  tls?: boolean;
  servername?: string;
  'ws-opts'?: any;
  'reality-opts'?: any;
  [k: string]: any;
}

export interface ClashConfig {
  proxies?: ClashProxy[];
  'proxy-groups'?: any[];
  rules?: string[];
  'rule-providers'?: Record<string, any>;
  [k: string]: any;
}

/**
 * ClashConfigBuilder - TypeScript 版本
 */
export class ClashConfigBuilder extends BaseConfigBuilder {
  config: ClashConfig;
  selectedRules: any[];
  customRules: any[];

  constructor(inputString: string | undefined, selectedRules: any[] = [], customRules: any[] = [], baseConfig?: ClashConfig, lang?: string, userAgent?: string) {
    const cfg = baseConfig ?? CLASH_CONFIG;
    super(inputString, cfg, lang, userAgent);
    this.config = this.config || cfg;
    this.selectedRules = selectedRules;
    this.customRules = customRules;
  }

  getProxies(): ClashProxy[] {
    return this.config.proxies ?? [];
  }

  getProxyName(proxy: ClashProxy | RawProxyInput): string {
    return (proxy as any).name ?? (proxy as any).tag ?? '';
  }

  /**
   * convertProxy - 将原始节点描述转换为 Clash 可识别的 proxy 对象
   * 自动补齐 port、ws path、Host 等，减少配置错误
   */
  convertProxy(proxy: RawProxyInput): ClashProxy {
    const normalize = <T>(val: T | undefined | null, def: T): T => (val !== undefined && val !== null ? val : def);

    const name = proxy.tag ?? proxy.name ?? 'unnamed';
    const server = proxy.server ?? '';
    const port = normalize<number>(proxy.server_port, 443);
    const skipCert = proxy.tls?.insecure ?? false;

    const base: Partial<ClashProxy> = {
      name,
      server,
      port,
      'skip-cert-verify': skipCert
    };

    const type = (proxy.type ?? '').toLowerCase();

    switch (type) {
      case 'shadowsocks':
        return {
          ...(base as ClashProxy),
          type: 'ss',
          cipher: proxy.method,
          password: proxy.password
        };

      case 'vmess':
        return {
          ...(base as ClashProxy),
          type: 'vmess',
          uuid: proxy.uuid,
          alterId: proxy.alter_id ?? 0,
          cipher: proxy.security ?? 'auto',
          tls: proxy.tls?.enabled ?? false,
          servername: proxy.tls?.server_name ?? server,
          network: proxy.transport?.type ?? 'tcp',
          'ws-opts': proxy.transport?.type === 'ws' ? {
            path: proxy.transport?.path ?? '/',
            headers: proxy.transport?.headers ?? { Host: proxy.tls?.server_name ?? server }
          } : undefined
        };

      case 'vless':
        return {
          ...(base as ClashProxy),
          type: 'vless',
          uuid: proxy.uuid,
          tls: proxy.tls?.enabled ?? true,
          cipher: proxy.security ?? 'auto',
          'client-fingerprint': proxy.tls?.utls?.fingerprint,
          servername: proxy.tls?.server_name ?? server,
          network: proxy.transport?.type ?? 'tcp',
          'ws-opts': proxy.transport?.type === 'ws' ? {
            path: proxy.transport?.path ?? '/',
            headers: proxy.transport?.headers ?? { Host: proxy.tls?.server_name ?? server }
          } : undefined,
          'reality-opts': proxy.tls?.reality?.enabled ? {
            'public-key': proxy.tls.reality.public_key,
            'short-id': proxy.tls.reality.short_id
          } : undefined,
          tfo: proxy.tcp_fast_open ?? false
        };

      case 'trojan':
        return {
          ...(base as ClashProxy),
          type: 'trojan',
          password: proxy.password,
          tls: proxy.tls?.enabled ?? true,
          'client-fingerprint': proxy.tls?.utls?.fingerprint,
          sni: proxy.tls?.server_name ?? server,
          network: proxy.transport?.type ?? 'tcp',
          'ws-opts': proxy.transport?.type === 'ws' ? {
            path: proxy.transport?.path ?? '/',
            headers: proxy.transport?.headers ?? { Host: proxy.tls?.server_name ?? server }
          } : undefined
        };

      case 'hysteria2':
        return {
          ...(base as ClashProxy),
          type: 'hysteria2',
          up: proxy.up_mbps ?? 50,
          down: proxy.down_mbps ?? 100,
          obfs: proxy.obfs?.type,
          'obfs-password': proxy.obfs?.password,
          password: proxy.password,
          sni: proxy.tls?.server_name ?? server
        };

      case 'tuic':
        return {
          ...(base as ClashProxy),
          type: 'tuic',
          uuid: proxy.uuid,
          password: proxy.password,
          'congestion-controller': proxy.congestion ?? 'bbr',
          'disable-sni': false,
          alpn: proxy.tls?.alpn,
          sni: proxy.tls?.server_name ?? server
        };

      default:
        return {
          ...(base as ClashProxy),
          type: (proxy.type ?? 'ss') as ProxyType
        };
    }
  }

  /**
   * 向 config.proxies 添加节点（自动校验与去重）
   */
  addProxyToConfig(proxy: ClashProxy | RawProxyInput) {
    if (!proxy) return;
    const p = (proxy as any).name ? proxy as ClashProxy : this.convertProxy(proxy as RawProxyInput);

    if (!p.name || !p.server) return;

    this.config.proxies = this.config.proxies ?? [];

    if (!p.port || p.port <= 0) p.port = 443;

    const exists = this.config.proxies.some(x => x.name === p.name);
    if (!exists) this.config.proxies.push(p);
  }

  /** 自动创建地区测速组（Cloudflare 测速，lazy） */
  addRegionAutoGroups(proxyList: string[] | ClashProxy[] | undefined) {
    if (!Array.isArray(proxyList) || proxyList.length === 0) return;

    const names = typeof proxyList[0] === 'string' ? proxyList as string[] : (proxyList as ClashProxy[]).map(p => p.name);
    const regions: Record<string, RegExp> = {
      '🇭🇰 香港自动': /(香港|HK|🇭🇰)/i,
      '🇸🇬 新加坡自动': /(新加坡|SG|🇸🇬)/i,
      '🇺🇸 美国自动': /(美国|US|🇺🇸)/i,
      '🇯🇵 日本自动': /(日本|JP|🇯🇵)/i,
      '🇹🇼 台湾自动': /(台湾|TW|台北|🇹🇼)/i,
    };

    this.config['proxy-groups'] = this.config['proxy-groups'] ?? [];

    for (const [regionName, regex] of Object.entries(regions)) {
      const regionProxies = names.filter(n => regex.test(n));
      if (regionProxies.length === 0) continue;
      if (this.config['proxy-groups'].some(g => g.name === regionName)) continue;

      this.config['proxy-groups'].push({
        name: regionName,
        type: 'url-test',
        proxies: DeepCopy(regionProxies),
        url: 'https://cp.cloudflare.com/generate_204',
        interval: 900,
        tolerance: 50,
        lazy: true,
        'max-failed-times': 3
      });
    }
  }

  /** 全局自动测速组 */
  addAutoSelectGroup(proxyList: string[] | ClashProxy[] | undefined) {
    const autoName = t('outboundNames.Auto Select');
    if (this.config['proxy-groups']?.some(g => g.name === autoName)) return;
    const proxies = Array.isArray(proxyList) && typeof proxyList[0] === 'string' ? proxyList as string[] : (proxyList as ClashProxy[] ?? []).map(p => p.name);

    this.config['proxy-groups'] = this.config['proxy-groups'] ?? [];
    this.config['proxy-groups'].push({
      name: autoName,
      type: 'url-test',
      proxies: DeepCopy(proxies),
      url: 'https://cp.cloudflare.com/generate_204',
      interval: 900,
      tolerance: 50,
      lazy: true,
      'max-failed-times': 3
    });
  }

  /** 节点选择组（手动） */
  addNodeSelectGroup(proxyList: string[] | ClashProxy[] | undefined) {
    const autoSelect = t('outboundNames.Auto Select');
    const nodeSelect = t('outboundNames.Node Select');
    const names = Array.isArray(proxyList) && typeof proxyList[0] === 'string' ? proxyList as string[] : (proxyList as ClashProxy[] ?? []).map(p => p.name);
    const merged = [...new Set([autoSelect, 'DIRECT', 'REJECT', ...names])];

    if (this.config['proxy-groups']?.some(g => g.name === nodeSelect)) return;

    this.config['proxy-groups'] = this.config['proxy-groups'] ?? [];
    this.config['proxy-groups'].unshift({
      type: 'select',
      name: nodeSelect,
      proxies: DeepCopy(merged)
    });
  }

  /** 根据 outbounds 自动生成分组（媒体 / AI / 游戏 优先策略） */
  addOutboundGroups(outbounds: string[] | undefined, proxyList: string[] | ClashProxy[] | undefined) {
    if (!Array.isArray(outbounds)) return;

    const autoSelect = t('outboundNames.Auto Select');
    const nodeSelect = t('outboundNames.Node Select');
    const names = Array.isArray(proxyList) && typeof proxyList[0] === 'string' ? proxyList as string[] : (proxyList as ClashProxy[] ?? []).map(p => p.name);

    outbounds.forEach(outbound => {
      const outboundName = t(`outboundNames.${outbound}`);
      if (outboundName === nodeSelect) return;

      let optimized: (string | ClashProxy)[] | Set<string> | string[] = [];

      if (outboundName === t('outboundNames.国内服务') || outboundName === '🔒 国内服务') {
        optimized = ['DIRECT'];
      } else {
        optimized = new Set([nodeSelect, autoSelect, 'DIRECT', 'REJECT', ...names]);

        if (/media|stream|video|youtube|netflix|disney/i.test(outbound)) {
          optimized = new Set(['🇭🇰 香港自动', '🇸🇬 新加坡自动', ...(Array.from(optimized) as string[])]);
        } else if (/openai|chatgpt|ai|claude|gemini/i.test(outbound)) {
          optimized = new Set(['🇸🇬 新加坡自动', '🇺🇸 美国自动', ...(Array.from(optimized) as string[])]);
        }
      }

      this.config['proxy-groups'] = this.config['proxy-groups'] ?? [];
      this.config['proxy-groups'].push({
        type: 'select',
        name: outboundName,
        proxies: DeepCopy(Array.isArray(optimized) ? optimized : Array.from(optimized as Set<string>))
      });
    });
  }

  /** 自定义规则组 */
  addCustomRuleGroups(proxyList: string[] | ClashProxy[] | undefined) {
    if (!Array.isArray(this.customRules)) return;
    const names = Array.isArray(proxyList) && typeof proxyList[0] === 'string' ? proxyList as string[] : (proxyList as ClashProxy[] ?? []).map(p => p.name);
    this.config['proxy-groups'] = this.config['proxy-groups'] ?? [];

    this.customRules.forEach(rule => {
      this.config['proxy-groups'].push({
        type: 'select',
        name: t(`outboundNames.${rule.name}`),
        proxies: [t('outboundNames.Node Select'), ...names]
      });
    });
  }

  /** 备用组 */
  addFallBackGroup(proxyList: string[] | ClashProxy[] | undefined) {
    const names = Array.isArray(proxyList) && typeof proxyList[0] === 'string' ? proxyList as string[] : (proxyList as ClashProxy[] ?? []).map(p => p.name);
    this.config['proxy-groups'] = this.config['proxy-groups'] ?? [];
    this.config['proxy-groups'].push({
      type: 'select',
      name: t('outboundNames.Fall Back'),
      proxies: [t('outboundNames.Node Select'), ...names]
    });
  }

  generateRules() {
    return generateRules(this.selectedRules, this.customRules);
  }

  formatConfig(): string {
    const rules = this.generateRules();
    const ruleResults: string[] = [];

    const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
    this.config['rule-providers'] = { ...(this.config['rule-providers'] ?? {}), ...site_rule_providers, ...ip_rule_providers };

    rules.filter((r: any) => !!r.domain_suffix || !!r.domain_keyword).forEach((rule: any) => {
      rule.domain_suffix?.forEach((s: string) => ruleResults.push(`DOMAIN-SUFFIX,${s},${t('outboundNames.' + rule.outbound)}`));
      rule.domain_keyword?.forEach((k: string) => ruleResults.push(`DOMAIN-KEYWORD,${k},${t('outboundNames.' + rule.outbound)}`));
    });

    rules.filter((r: any) => !!r.site_rules?.[0]).forEach((rule: any) => {
      rule.site_rules.forEach((s: string) => ruleResults.push(`RULE-SET,${s},${t('outboundNames.' + rule.outbound)}`));
    });

    rules.filter((r: any) => !!r.ip_rules?.[0]).forEach((rule: any) => {
      rule.ip_rules.forEach((ip: string) => ruleResults.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`));
    });

    rules.filter((r: any) => !!r.ip_cidr).forEach((rule: any) => {
      rule.ip_cidr.forEach((cidr: string) => ruleResults.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`));
    });

    this.config.rules = [...ruleResults];
    this.config.rules.push(`MATCH,${t('outboundNames.Fall Back')}`);

    return yaml.dump(this.config);
  }
}
