import { withDb } from '../../../lib/db.js';
import { isAdmin, json, readJson, cleanWord } from '../../../lib/auth.js';

async function guard({ request, env, params }) {
  if (!(await isAdmin(request, env))) return json({ error: '로그인이 필요해요.' }, 401);
  if (!/^\d{1,10}$/.test(params.id)) return json({ error: '잘못된 요청이에요.' }, 400);
  return null;
}

// PUT /api/words/:id  { word, meaning }
export async function onRequestPut(context) {
  const bad = await guard(context);
  if (bad) return bad;
  const body = await readJson(context.request);
  const it = cleanWord(body?.word, body?.meaning);
  if (!it) return json({ error: '단어는 영문, 뜻은 100자 이내로 입력하세요.' }, 400);
  return withDb(context, async (db) => {
    await db.query('UPDATE vocab_words SET word = ?, meaning = ? WHERE word_id = ?',
      [it.word, it.meaning, Number(context.params.id)]);
    return json({ ok: true });
  });
}

// DELETE /api/words/:id
export async function onRequestDelete(context) {
  const bad = await guard(context);
  if (bad) return bad;
  return withDb(context, async (db) => {
    await db.query('DELETE FROM vocab_words WHERE word_id = ?', [Number(context.params.id)]);
    return json({ ok: true });
  });
}
