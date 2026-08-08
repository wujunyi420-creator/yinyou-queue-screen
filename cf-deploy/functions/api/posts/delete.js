import { json, readBody } from '../../../_utils.js';

// POST /api/posts/delete — 删除帖子
export async function onRequestPost(context) {
  const { env } = context;
  const body = await readBody(context.request);
  const postId = body.id;
  const byPhone = body.byPhone || '';
  const isAdmin = body.isAdmin || false;
  if (!postId) return json({ error: '缺少帖子ID' }, 400);

  const row = await env.DB.prepare('SELECT author_phone, images FROM posts WHERE id=?').bind(postId).first();
  if (!row) return json({ error: '帖子不存在' }, 404);
  if (!isAdmin && row.author_phone !== byPhone) return json({ error: '无权删除他人帖子' }, 403);

  // 删除关联图片
  let images = [];
  try { images = JSON.parse(row.images || '[]'); } catch (e) {}
  for (const u of images) {
    const iid = String(u).split('?')[0].replace(/^\/api\/img\//, '');
    await env.DB.prepare('DELETE FROM images WHERE id=?').bind(iid).run();
  }
  await env.DB.prepare('DELETE FROM posts WHERE id=?').bind(postId).run();
  return json({ ok: true });
}
