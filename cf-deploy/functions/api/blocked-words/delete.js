import { json, readBody, getBlockedWords } from '../../../_utils.js';

// POST /api/blocked-words/delete — 删除拦截词
export async function onRequestPost(context) {
  const { env } = context;
  const body = await readBody(context.request);
  const word = String(body.word || '').trim();
  const words = await getBlockedWords(env.DB);
  const idx = words.indexOf(word);
  if (idx >= 0) words.splice(idx, 1);
  await env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(JSON.stringify(words), 'blockedWords').run();
  return json({ ok: true, words });
}
