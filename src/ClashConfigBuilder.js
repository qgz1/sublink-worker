import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
  constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
    super(inputString, baseConfig || CLASH_CONFIG, lang, userAgent);
    this.selectedRules = selectedRules;
    this.customRules = customRules;
    // 初始化配置结构
    this.config.proxies = this.config.proxies || [];
    this.config['proxy-groups'] = this.config['proxy-groups'] || [];
    this.config.rules = this.config.rules || [];
  }

  // 添加优先节点到proxies
  addPriorityProxies() {
    const priorityNodes = ['🇭🇰 香港自动', '🇸🇬 新加坡自动', '🇯🇵 日本自动'];
    priorityNodes.forEach(name => {
      const proxyNode = this.createProxyNodeByName(name);
      if (proxyNode) {
        this.addProxyToConfig(proxyNode);
      } else {
        console.warn(`未找到或生成代理节点：${name}`);
      }
    });
  }

  // 模拟根据名字创建代理节点（请根据实际节点数据定义）
  createProxyNodeByName(name) {
    // 示例：返回静态代理节点，实际应从你的节点列表生成
    return {
      name: name,
      type: 'ss', // 示例类型
      server: '1.2.3.4',
      server_port: 443,
      cipher: 'aes-256-gcm',
      password: 'password'
    };
  }

  // 添加代理节点到配置
  addProxyToConfig(proxy) {
    if (!this.config.proxies.some(p => p.name === proxy.name)) {
      this.config.proxies.push(proxy);
    }
  }

  // 添加出站组（带策略优化）
  addOutboundGroups(outbounds, proxyList) {
    const autoSelect = t('outboundNames.Auto Select');
    const nodeSelect = t('outboundNames.Node Select');

    const priorityNodes = ['🇭🇰 香港自动', '🇸🇬 新加坡自动', '🇯🇵 日本自动'];

    outbounds.forEach(outbound => {
      const outboundName = t(`outboundNames.${outbound}`);
      if (outboundName !== nodeSelect) {
        let optimized;

        if (
          outboundName === t('outboundNames.国内服务') ||
          outboundName === '🔒 国内服务'
        ) {
          // 只允许直连
          optimized = ['DIRECT'];
        } else {
          optimized = new Set([
            ...priorityNodes,
            autoSelect,
            'DIRECT',
            'REJECT',
            ...proxyList,
          ]);

          const lowerOutbound = outbound.toLowerCase();

          if (/media|stream|video|youtube|netflix/i.test(lowerOutbound)) {
            optimized = new Set(['🇭🇰 香港自动', '🇸🇬 新加坡自动', ...optimized]);
          } else if (/openai|chatgpt|ai/i.test(lowerOutbound)) {
            optimized = new Set(['🇸🇬 新加坡自动', '🇺🇸 美国自动', ...optimized]);
          } else if (/game|gaming|steam/i.test(lowerOutbound)) {
            optimized = new Set(['🇭🇰 香港自动', '🇯🇵 日本自动', ...optimized]);
          } else if (/download|torrent|p2p/i.test(lowerOutbound)) {
            optimized = new Set(['🇸🇬 新加坡自动', '🇯🇵 日本自动', ...optimized]);
          } else if (/social|twitter|facebook|telegram/i.test(lowerOutbound)) {
            optimized = new Set(['🇭🇰 香港自动', '🇸🇬 新加坡自动', ...optimized]);
          }
        }

        this.config['proxy-groups'].push({
          type: 'select',
          name: outboundName,
          proxies: DeepCopy([...optimized]),
        });
      }
    });
  }

  // 生成规则
  generateRules() {
    return generateRules(this.selectedRules, this.customRules);
  }

  // 生成完整配置
  formatConfig() {
    const rules = this.generateRules();
    const ruleResults = [];

    const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);
    this.config['rule-providers'] = { ...site_rule_providers, ...ip_rule_providers };

    // 转换规则为字符串
    rules.forEach((r) => {
      if (r.domain_suffix) {
        r.domain_suffix.forEach((s) => {
          ruleResults.push(`DOMAIN-SUFFIX,${s},${t('outboundNames.' + r.outbound)}`);
        });
      }
      if (r.domain_keyword) {
        r.domain_keyword.forEach((k) => {
          ruleResults.push(`DOMAIN-KEYWORD,${k},${t('outboundNames.' + r.outbound)}`);
        });
      }
      if (r.site_rules) {
        r.site_rules.forEach((s) => {
          ruleResults.push(`RULE-SET,${s},${t('outboundNames.' + r.outbound)}`);
        });
      }
      if (r.ip_rules) {
        r.ip_rules.forEach((ip) => {
          ruleResults.push(`RULE-SET,${ip},${t('outboundNames.' + r.outbound)},no-resolve`);
        });
      }
      if (r.ip_cidr) {
        r.ip_cidr.forEach((cidr) => {
          ruleResults.push(`IP-CIDR,${cidr},${t('outboundNames.' + r.outbound)},no-resolve`);
        });
      }
    });

    this.config.rules = [...ruleResults, `MATCH,${t('outboundNames.Fall Back')}`];

    return yaml.dump(this.config);
  }

  // 执行一站式配置流程
  build() {
    // 1. 添加优先节点到proxies
    this.addPriorityProxies();

    // 2. 你可以在这里调用其他添加代理的逻辑
    // this.addOtherProxies();

    // 3. 添加出站组
    const outbounds = ['国内服务', '海外网络']; // 根据你的实际出站名
    const proxyList = this.config.proxies.map((p) => p.name);
    this.addOutboundGroups(outbounds, proxyList);

    // 4. 格式化并输出配置
    return this.formatConfig();
  }
}

// 示例调用
// const builder = new ClashConfigBuilder('输入字符串', ['规则1'], [], null, 'zh', 'UA');
// const yamlStr = builder.build();
// console.log(yamlStr);
