// utils.js

// 深拷贝对象
export function DeepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// 字符串是否以某前缀开始
export function checkStartsWith(str, prefix) {
  return str.startsWith(prefix);
}

// Base64 编码/解码
export function encodeBase64(str) {
  return Buffer.from(str, 'utf-8').toString('base64');
}

export function decodeBase64(str) {
  try {
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return str;
  }
}

// Base64 转二进制
export function base64ToBinary(str) {
  return Buffer.from(str, 'base64').toString('utf-8');
}

// 生成 Web 路径（统一斜杠）
export function GenerateWebPath(path) {
  if (!path) return '';
  return path.replace(/\\/g, '/');
}

// 获取地理位置信息
export async function getGeoInfo(ip) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
    const data = await response.json();

    if (data.status !== 'success') throw new Error(`GeoIP lookup failed for IP: ${ip}`);

    // 如果非中国 IP，返回本地默认值
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

// 解析服务器信息
export function parseServerInfo(serverInfo) {
  if (!serverInfo) return { host: '', port: 0 };
  const match = serverInfo.match(/\[([^\]]+)\]:(\d+)/);
  if (match) return { host: match[1], port: parseInt(match[2]) };
  const [host, port] = serverInfo.split(':');
  return { host, port: parseInt(port) };
}

// 解析 URL 参数
export function parseUrlParams(url) {
  const [base, query = ''] = url.split('?');
  const name = base.includes('#') ? decodeURIComponent(base.split('#')[1]) : '';
  const addressPart = base.includes('#') ? base.split('#')[0] : base;
  const params = Object.fromEntries(new URLSearchParams(query));
  return { addressPart, params, name };
}

// 创建 TLS 配置
export function createTlsConfig(params) {
  return params.tls === '1' || params.tls === 'true'
    ? { enabled: true, server_name: params.sni || '', insecure: params['skip-cert-verify'] === '1' }
    : { enabled: false };
}

// 创建传输配置
export function createTransportConfig(params) {
  const type = params.type || 'tcp';
  switch (type) {
    case 'ws': return { type: 'ws', path: params.path || '/', headers: { Host: params.host || params.sni } };
    case 'grpc': return { type: 'grpc', serviceName: params.serviceName || '' };
    default: return { type };
  }
}
