// Dev-only absolute-URL rewrite via Vite /api-proxy (CORS bypass)

export const normalizeBaseUrl = (baseUrl: string) =>
  (baseUrl || '').trim().replace(/\/$/, '');

export const isDevProxyAvailable = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(
      window.location.hostname,
    ));

// https://token.sensenova.cn/v1/models -> /api-proxy/https/token.sensenova.cn/v1/models
export const toProxyUrl = (absoluteUrl: string): string => {
  try {
    const u = new URL(absoluteUrl);
    if (!isDevProxyAvailable()) return absoluteUrl;
    if (u.origin === window.location.origin) return absoluteUrl;
    if (u.pathname.startsWith('/api-proxy/')) return absoluteUrl;
    const scheme = u.protocol.replace(':', '');
    return `/api-proxy/${scheme}/${u.host}${u.pathname}${u.search}`;
  } catch {
    return absoluteUrl;
  }
};

export const proxyFetch = (absoluteUrl: string, init: RequestInit = {}) => {
  const url = toProxyUrl(absoluteUrl);
  const headers = new Headers(init.headers || {});
  return fetch(url, { ...init, headers, mode: 'cors' as RequestMode });
};
