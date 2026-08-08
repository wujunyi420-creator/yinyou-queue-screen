import { json, readBody } from '../../../_utils.js';

// POST /api/posts/view — 浏览量+1
export async function onRequestPost(context) {
  const { env } = context;
  const body = await readBody(context.request);
  const postId = body.id;
  if (!postId) return json({ ok: true });
  await env.DB.prepare('UPDATE posts SET views=views+1 WHERE id=?').bind(postId).run();
  return json({ ok: true });
}
