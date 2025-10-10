// utils.js 中 getGeoInfo
export async function getGeoInfo(ip) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
    const data = await response.json();

    if (data.status !== 'success') throw new Error(`GeoIP lookup failed for IP: ${ip}`);

    if (data.country !== 'China') {
      return { country: '中国', region: '北京', city: '本地', isp: '本地网络', emoji: '🇨🇳' };
    }

    return {
      country: data.country,
      region: data.regionName,
      city: data.city,
      isp: data.isp,
      emoji: data.countryCode
        ? String.fromCodePoint(0x1F1E6 + data.countryCode.charCodeAt(0) - 65) +
          String.fromCodePoint(0x1F1E6 + data.countryCode.charCodeAt(1) - 65)
        : '',
    };
  } catch {
    return { country: '中国', region: '北京', city: '本地', isp: '本地网络', emoji: '🇨🇳' };
  }
}

// ProxyParser.js
import { getGeoInfo, parseServerInfo, parseUrlParams, createTlsConfig, createTransportConfig, decodeBase64, base64ToBinary } from './utils.js';

export class ProxyParser {
  static async parse(url, userAgent) {
    url = url.trim();
    const type = url.split('://')[0];
    switch (type) {
      case 'ss': return await new ShadowsocksParser().parse(url);
      case 'vmess': return await new VmessParser().parse(url);
      case 'vless': return await new VlessParser().parse(url);
      case 'hysteria':
      case 'hysteria2':
      case 'hy2': return await new Hysteria2Parser().parse(url);
      case 'http':
      case 'https': return await HttpParser.parse(url, userAgent);
      case 'trojan': return await new TrojanParser().parse(url);
      case 'tuic': return await new TuicParser().parse(url);
      default: throw new Error(`Unsupported URL type: ${type}`);
    }
  }
}

// Shadowsocks
class ShadowsocksParser {
  async parse(url) {
    let [mainPart, tag] = url.replace('ss://', '').split('#');
    if (tag && tag.includes('%')) tag = decodeURIComponent(tag);

    try {
      let [base64, serverPart] = mainPart.split('@');
      if (!serverPart) {
        const decodedLegacy = base64ToBinary(mainPart);
        const [methodAndPass, serverInfo] = decodedLegacy.split('@');
        const [method, password] = methodAndPass.split(':');
        const [server, server_port] = this.parseServer(serverInfo);
        const geo = await getGeoInfo(server);
        return this.createConfig(tag, server, server_port, method, password, geo);
      }

      const decodedParts = base64ToBinary(decodeURIComponent(base64)).split(':');
      const method = decodedParts[0];
      const password = decodedParts.slice(1).join(':');
      const [server, server_port] = this.parseServer(serverPart);
      const geo = await getGeoInfo(server);
      return this.createConfig(tag, server, server_port, method, password, geo);
    } catch (e) {
      console.error('Shadowsocks parse failed:', e);
      return null;
    }
  }

  parseServer(serverPart) {
    const match = serverPart.match(/\[([^\]]+)\]:(\d+)/);
    return match ? [match[1], match[2]] : serverPart.split(':');
  }

  createConfig(tag, server, server_port, method, password, geo) {
    return { tag: tag || 'Shadowsocks', type: 'shadowsocks', server, server_port: parseInt(server_port), method, password, network: 'tcp', tcp_fast_open: false, geo };
  }
}

// Vmess
class VmessParser {
  async parse(url) {
    const base64 = url.replace('vmess://', '');
    const vmessConfig = JSON.parse(decodeBase64(base64));
    let tls = { enabled: false };
    let transport = {};

    if (vmessConfig.net === 'ws') {
      transport = { type: 'ws', path: vmessConfig.path, headers: { Host: vmessConfig.host || vmessConfig.sni } };
      if (vmessConfig.tls) tls = { enabled: true, server_name: vmessConfig.sni, insecure: vmessConfig['skip-cert-verify'] || false };
    }

    const geo = await getGeoInfo(vmessConfig.add);
    return { tag: vmessConfig.ps, type: 'vmess', server: vmessConfig.add, server_port: parseInt(vmessConfig.port), uuid: vmessConfig.id, alter_id: parseInt(vmessConfig.aid), security: vmessConfig.scy || 'auto', network: 'tcp', tcp_fast_open: false, transport, tls: tls.enabled ? tls : undefined, geo };
  }
}

// Vless
class VlessParser {
  async parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [uuid, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);
    const tls = createTlsConfig(params);
    if (tls.reality) tls.utls = { enabled: true, fingerprint: 'chrome' };
    const transport = params.type !== 'tcp' ? createTransportConfig(params) : undefined;
    const geo = await getGeoInfo(host);
    return { type: 'vless', tag: name, server: host, server_port: port, uuid: decodeURIComponent(uuid), tcp_fast_open: false, tls, transport, network: 'tcp', flow: params.flow ?? undefined, geo };
  }
}

// Hysteria2
class Hysteria2Parser {
  async parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    let host, port, password = null;

    if (addressPart.includes('@')) {
      const [uuid, serverInfo] = addressPart.split('@');
      const parsed = parseServerInfo(serverInfo);
      host = parsed.host; port = parsed.port; password = decodeURIComponent(uuid);
    } else {
      const parsed = parseServerInfo(addressPart);
      host = parsed.host; port = parsed.port; password = params.auth;
    }

    const tls = createTlsConfig(params);
    const obfs = {};
    if (params['obfs-password']) { obfs.type = params.obfs; obfs.password = params['obfs-password']; }
    const geo = await getGeoInfo(host);

    return { tag: name, type: 'hysteria2', server: host, server_port: port, password, tls, obfs, auth: params.auth, recv_window_conn: params.recv_window_conn, up_mbps: params?.upmbps ? parseInt(params.upmbps) : undefined, down_mbps: params?.downmbps ? parseInt(params.downmbps) : undefined, geo };
  }
}

// Trojan
class TrojanParser {
  async parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [password, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);
    const tls = createTlsConfig(params);
    const transport = params.type !== 'tcp' ? createTransportConfig(params) : undefined;
    const geo = await getGeoInfo(host);
    return { type: 'trojan', tag: name, server: host, server_port: port, password: decodeURIComponent(password), network: 'tcp', tcp_fast_open: false, tls, transport, flow: params.flow ?? undefined, geo };
  }
}

// Tuic
class TuicParser {
  async parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [userinfo, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);
    const tls = { enabled: true, server_name: params.sni, alpn: params.alpn ? decodeURIComponent(params.alpn).split(',') : [], insecure: true };
    const geo = await getGeoInfo(host);
    return { tag: name, type: 'tuic', server: host, server_port: port, uuid: decodeURIComponent(userinfo).split(':')[0], password: decodeURIComponent(userinfo).split(':')[1], congestion_control: params.congestion_control, tls, flow: params.flow ?? undefined, geo };
  }
}

// Http
class HttpParser {
  static async parse(url, userAgent) {
    try {
      const headers = new Headers({ 'User-Agent': userAgent });
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      let text = await response.text();
      let decodedText;
      try { decodedText = decodeBase64(text.trim()); if (decodedText.includes('%')) decodedText = decodeURIComponent(decodedText); }
      catch { decodedText = text; if (decodedText.includes('%')) { try { decodedText = decodeURIComponent(decodedText); } catch {} } }
      return decodedText.split('\n').filter(line => line.trim() !== '');
    } catch (error) { console.error('HTTP parse failed:', error); return null; }
  }
}
