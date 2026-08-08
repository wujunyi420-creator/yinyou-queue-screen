import { json, readBody } from '../../../_utils.js';

// POST /api/blocked-words/replace — 替换全部拦截词
export async function onRequestPost(context) {
  const { env } = context;
  const body = await readBody(context.request);
  const words = Array.isArray(body.words) ? body.words : [];
  await env.DB.prepare('UPDATE settings SET value=? WHERE key=?').bind(JSON.stringify(words), 'blockedWords').run();
  return json({ ok: true, words });
}
