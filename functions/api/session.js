import { isAdmin, clearCookie, json } from '../../lib/auth.js';

// GET: 로그인 상태 확인
export async function onRequestGet({ request, env }) {
  return json({ admin: await isAdmin(request, env) });
}

// DELETE: 로그아웃
export async function onRequestDelete() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}
