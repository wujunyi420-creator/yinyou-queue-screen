import { json, readBody, getBlockedWords, checkBlocked, aiModeratePost } from '../../_utils.js';

// GET /api/posts — 获取帖子列表
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') || '';
  const cat = url.searchParams.get('cat') || '';
  const authorPhone = url.searchParams.get('authorPhone') || '';

  let sql = 'SELECT * FROM posts';
  const conditions = [];
  const params = [];
  if (keyword) { conditions.push('(title LIKE ? OR content LIKE ?)'); params.push('%' + keyword + '%', '%' + keyword + '%'); }
  if (cat && cat !== '全部') { conditions.push('cat=?'); params.push(cat); }
  if (authorPhone) { conditions.push('author_phone=?'); params.push(authorPhone); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT 500';

  const result = await env.DB.prepare(sql).bind(...params).all();
  const posts = (result.results || []).map(formatPost);
  return json({ ok: true, posts });
}

// POST /api/posts — 发布帖子
export async function onRequestPost(context) {
  const { env } = context;
  const body = await readBody(context.request);
  const blockedWords = await getBlockedWords(env.DB);
  const fullText = (body.title || '') + ' ' + (body.content || '');
  const blocked = checkBlocked(fullText, blockedWords);
  if (blocked) {
    return json({ error: '内容包含违规词「' + blocked + '」，请修改后重试' }, 400);
  }

  const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const now = Date.now();
  const images = JSON.stringify(body.images || []);

  await env.DB.prepare(
    'INSERT INTO posts(id,title,content,cat,author_phone,author_name,author_vip,author_member,author_avatar,images,likes,liked_by,views,comments,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(
    id, body.title || '', body.content || '', body.cat || '讨论',
    body.authorPhone || '', body.authorName || '匿名',
    body.authorVip ? 1 : 0, body.authorMember ? 1 : 0, body.authorAvatar || '',
    images, 0, '[]', 0, '[]', now
  ).run();

  // 异步 AI 审核（不等待）
  const post = { id, title: body.title || '', content: body.content || '', cat: body.cat || '讨论', images };
  context.waitUntil(aiModeratePost(env, env.DB, post));

  return json({ ok: true, post: { id, ...body, images: body.images || [], likes: 0, likedBy: [], views: 0, comments: [], createdAt: now } });
}

function formatPost(row) {
  let images = [], likedBy = [], comments = [];
  try { images = JSON.parse(row.images || '[]'); } catch (e) {}
  try { likedBy = JSON.parse(row.liked_by || '[]'); } catch (e) {}
  try { comments = JSON.parse(row.comments || '[]'); } catch (e) {}
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    cat: row.cat,
    authorPhone: row.author_phone,
    authorName: row.author_name,
    authorVip: !!row.author_vip,
    authorMember: !!row.author_member,
    authorAvatar: row.author_avatar,
    images,
    likes: row.likes || 0,
    likedBy,
    views: row.views || 0,
    comments,
    createdAt: row.created_at
  };
}
