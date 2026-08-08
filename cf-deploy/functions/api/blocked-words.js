import { json, readBody, getBlockedWords } from '../../_utils.js';

// GET /api/blocked-words — 获取拦截词
export async function onRequestGet(context) {
  const words = await getBlockedWords(context.env.DB);
  return json({ ok: true, words });
}

// POST /api/blocked-words — 添加拦截词
export async function onRequestPost(context) {
  const { env } = context;
  const body = await readBody(context.request);
  const words = await getBlockedWords(env.DB);
  let added = 0;
  if (Array.isArray(body.words)) {
    body.words.forEach(function (w) {
      var w1 = String(w).trim();
      if (w1 && words.indexOf(w1) < 0) { words.push(w1); added++; }
    });
  } else if (body.word) {
    var w1 = String(body.word).trim();
    if (w1 && words.indexOf(w1) < 0) { words.push(w1); added++; }
  }
  await env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(JSON.stringify(words), 'blockedWords').run();
  return json({ ok: true, words, added });
}
