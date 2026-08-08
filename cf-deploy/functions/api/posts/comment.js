import { json, readBody, getBlockedWords, checkBlocked } from '../../../_utils.js';

// POST /api/posts/comment — 评论
export async function onRequestPost(context) {
  const { env } = context;
  const body = await readBody(context.request);
  const postId = body.id;
  if (!postId) return json({ error: '缺少帖子ID' }, 400);
  const text = String(body.text || '').trim();
  if (!text) return json({ error: '评论内容不能为空' }, 400);

  // 拦截词检查
  const blockedWords = await getBlockedWords(env.DB);
  const blocked = checkBlocked(text, blockedWords);
  if (blocked) return json({ error: '评论包含违规词「' + blocked + '」' }, 400);

  const row = await env.DB.prepare('SELECT comments FROM posts WHERE id=?').bind(postId).first();
  if (!row) return json({ error: '帖子不存在' }, 404);

  let comments = [];
  try { comments = JSON.parse(row.comments || '[]'); } catch (e) {}
  const comment = {
    name: body.name || '匿名',
    text: text,
    phone: body.phone || '',
    ts: Date.now()
  };
  comments.push(comment);
  await env.DB.prepare('UPDATE posts SET comments=? WHERE id=?').bind(JSON.stringify(comments), postId).run();
  return json({ ok: true, comments });
}
