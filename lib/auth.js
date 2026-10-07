const enc = new TextEncoder();
const COOKIE = 'ew_admin';
const SESSION_HOURS = 8;

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function secret(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || !env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD / SESSION_SECRET(32자 이상) 환경 변수를 설정하세요.');
  }
  return env.SESSION_SECRET;
}

// 길이가 달라도 시간이 새지 않도록 HMAC 끼리 비교
export async function checkPassword(env, input) {
  const s = secret(env);
  const [a, b] = await Promise.all([hmac(s, 'pw:' + input), hmac(s, 'pw:' + env.ADMIN_PASSWORD)]);
  return safeEqual(a, b);
}

export async function sessionCookie(env) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const token = `${exp}.${await hmac(secret(env), 's:' + exp)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function isAdmin(request, env) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!/^\d+$/.test(exp || '') || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret(env), 's:' + exp));
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export async function readJson(request) {
  try {
    const text = await request.text();
    if (text.length > 20000) return null;
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
export const isMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function cleanWord(w, m) {
  const word = String(w ?? '').trim().replace(/\s+/g, ' ');
  const meaning = String(m ?? '').trim().replace(/\s+/g, ' ');
  if (!/^[A-Za-z][A-Za-z '\-]{0,99}$/.test(word)) return null;
  if (!meaning || meaning.length > 100) return null;
  return { word, meaning };
}
