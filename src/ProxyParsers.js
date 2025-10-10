import { getGeoInfo, parseServerInfo, parseUrlParams, createTlsConfig, createTransportConfig, decodeBase64, base64ToBinary } from './utils.js';

export class ProxyParser {
  static async parse(url, userAgent) {
    url = url.trim();
    const type = url.split('://')[0];
    switch(type) {
      case 'ss': return new ShadowsocksParser().parse(url);
      case 'vmess': return new VmessParser().parse(url);
      case 'vless': return new VlessParser().parse(url);
      case 'hysteria':
      case 'hysteria2': 
      case 'hy2':
        return new Hysteria2Parser().parse(url);
      case 'http':
      case 'https':
        return HttpParser.parse(url, userAgent);
      case 'trojan': return new TrojanParser().parse(url);
      case 'tuic': return new TuicParser().parse(url);
      default: throw new Error("Unsupported URL type");
    }
  }
}

class ShadowsocksParser {
  async parse(url) {
    let parts = url.replace('ss://', '').split('#');
    let mainPart = parts[0];
    let tag = parts[1];
    if (tag && tag.includes('%')) {
      tag = decodeURIComponent(tag);
    }

    try {
      let [base64, serverPart] = mainPart.split('@');
      if (!serverPart) {
        let decodedLegacy = base64ToBinary(mainPart);
        let [methodAndPass, serverInfo] = decodedLegacy.split('@');
        let [method, password] = methodAndPass.split(':');
        let [server, server_port] = this.parseServer(serverInfo);

        // 获取地理位置信息
        const geo = await getGeoInfo(server);

        return this.createConfig(tag, server, server_port, method, password, geo);
      }

      let decodedParts = base64ToBinary(decodeURIComponent(base64)).split(':');
      let method = decodedParts[0];
      let password = decodedParts.slice(1).join(':');
      let [server, server_port] = this.parseServer(serverPart);

      // 获取地理位置信息
      const geo = await getGeoInfo(server);

      return this.createConfig(tag, server, server_port, method, password, geo);
    } catch (e) {
      console.error('Failed to parse Shadowsocks URL:', e);
      return null;
    }
  }

  parseServer(serverPart) {
    let match = serverPart.match(/\[([^\]]+)\]:(\d+)/);
    if (match) {
      return [match[1], match[2]];
    }
    return serverPart.split(':');
  }

  createConfig(tag, server, server_port, method, password, geo) {
    return {
      "tag": tag || "Shadowsocks",
      "type": 'shadowsocks',
      "server": server,
      "server_port": parseInt(server_port),
      "method": method,
      "password": password,
      "network": 'tcp',
      "tcp_fast_open": false,
      "geo": geo // Add geo info here
    };
  }
}

class VmessParser {
  async parse(url) {
    let base64 = url.replace('vmess://', '');
    let vmessConfig = JSON.parse(decodeBase64(base64));
    let tls = { "enabled": false };
    let transport = {};

    if (vmessConfig.net === 'ws') {
      transport = {
        "type": "ws",
        "path": vmessConfig.path,
        "headers": { 'Host': vmessConfig.host ? vmessConfig.host : vmessConfig.sni }
      };
      if (vmessConfig.tls !== '') {
        tls = {
          "enabled": true,
          "server_name": vmessConfig.sni,
          "insecure": vmessConfig['skip-cert-verify'] || false
        };
      }
    }

    const geo = await getGeoInfo(vmessConfig.add); // Get Geo Info

    return {
      "tag": vmessConfig.ps,
      "type": "vmess",
      "server": vmessConfig.add,
      "server_port": parseInt(vmessConfig.port),
      "uuid": vmessConfig.id,
      "alter_id": parseInt(vmessConfig.aid),
      "security": vmessConfig.scy || "auto",
      "network": "tcp",
      "tcp_fast_open": false,
      "transport": transport,
      "tls": tls.enabled ? tls : undefined,
      "geo": geo // Add geo info here
    };
  }
}

class VlessParser {
  async parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [uuid, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);

    const tls = createTlsConfig(params);
    if (tls.reality) {
      tls.utls = {
        enabled: true,
        fingerprint: "chrome",
      };
    }
    const transport = params.type !== 'tcp' ? createTransportConfig(params) : undefined;

    // 获取地理位置信息
    const geo = await getGeoInfo(host);

    return {
      type: "vless",
      tag: name,
      server: host,
      server_port: port,
      uuid: decodeURIComponent(uuid),
      tcp_fast_open: false,
      tls: tls,
      transport: transport,
      network: "tcp",
      flow: params.flow ?? undefined,
      "geo": geo // Add geo info here
    };
  }
}

class Hysteria2Parser {
  async parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    let host, port;
    let password = null;

    if (addressPart.includes('@')) {
      const [uuid, serverInfo] = addressPart.split('@');
      const parsed = parseServerInfo(serverInfo);
      host = parsed.host;
      port = parsed.port;
      password = decodeURIComponent(uuid);
    } else {
      const parsed = parseServerInfo(addressPart);
      host = parsed.host;
      port = parsed.port;
      password = params.auth;
    }

    const tls = createTlsConfig(params);
    const obfs = {};
    if (params['obfs-password']) {
      obfs.type = params.obfs;
      obfs.password = params['obfs-password'];
    };

    // 获取地理位置信息
    const geo = await getGeoInfo(host);

    return {
      tag: name,
      type: "hysteria2",
      server: host,
      server_port: port,
      password: password,
      tls: tls,
      obfs: obfs,
      auth: params.auth,
      recv_window_conn: params.recv_window_conn,
      up_mbps: params?.upmbps ? parseInt(params.upmbps) : undefined,
      down_mbps: params?.downmbps ? parseInt(params.downmbps) : undefined,
      "geo": geo // Add geo info here
    };
  }
}

class TrojanParser {
  async parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [password, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);

    const parsedURL = parseServerInfo(addressPart);
    const tls = createTlsConfig(params);
    const transport = params.type !== 'tcp' ? createTransportConfig(params) : undefined;

    // 获取地理位置信息
    const geo = await getGeoInfo(host);

    return {
      type: 'trojan',
      tag: name,
      server: host,
      server_port: port,
      password: decodeURIComponent(password) || parsedURL.username,
      network: "tcp",
      tcp_fast_open: false,
      tls: tls,
      transport: transport,
      flow: params.flow ?? undefined,
      "geo": geo // Add geo info here
    };
  }
}

class TuicParser {
  async parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [userinfo, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);
    const tls = {
      enabled: true,
      server_name: params.sni,
      alpn: params.alpn ? decodeURIComponent(params.alpn).split(',') : [],
      insecure: true,
    };

    // 获取地理位置信息
    const geo = await getGeoInfo(host);

    return {
      tag: name,
      type: "tuic",
      server: host,
      server_port: port,
      uuid: decodeURIComponent(userinfo).split(':')[0],
      password: decodeURIComponent(userinfo).split(':')[1],
      congestion_control: params.congestion_control,
      tls: tls,
      flow: params.flow ?? undefined,
      "geo": geo // Add geo info here
    };
  }
}

class HttpParser {
  static async parse(url, userAgent) {
    try {
      let headers = new Headers({
        "User-Agent": userAgent
      });
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });
      if (!response.ok)
