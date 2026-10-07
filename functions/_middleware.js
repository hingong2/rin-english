import { json } from '../lib/auth.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');
  let res;

  // 쓰기 요청은 같은 출처에서 온 것만 허용 (CSRF 방어)
  if (isApi && !['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('Origin');
    if (origin !== url.origin) return json({ error: '허용되지 않은 요청입니다.' }, 403);
  }

  try {
    res = await context.next();
  } catch (e) {
    console.error(e);
    if (!isApi) throw e;
    res = json({ error: '서버 오류가 발생했어요.' }, 500); // 내부 오류 내용은 노출하지 않음
  }

  res = new Response(res.body, res);
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return res;
}
