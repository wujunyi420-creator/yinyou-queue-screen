import { json, readBody } from '../../../_utils.js';

// POST /api/posts/like — 点赞/取消点赞
export async function onRequestPost(context) {
  const { env } = context;
  const body = await readBody(context.request);
  const postId = body.id;
  const phone = body.phone;
  if (!postId || !phone) return json({ error: '缺少参数' }, 400);

  const row = await env.DB.prepare('SELECT likes, liked_by FROM posts WHERE id=?').bind(postId).first();
  if (!row) return json({ error: '帖子不存在' }, 404);

  let likedBy = [];
  try { likedBy = JSON.parse(row.liked_by || '[]'); } catch (e) {}
  const idx = likedBy.indexOf(phone);
  let liked;
  if (idx >= 0) {
    likedBy.splice(idx, 1);
    liked = false;
  } else {
    likedBy.push(phone);
    liked = true;
  }
  const likes = likedBy.length;
  await env.DB.prepare('UPDATE posts SET likes=?, liked_by=? WHERE id=?').bind(likes, JSON.stringify(likedBy), postId).run();
  return json({ ok: true, likes, liked });
}
