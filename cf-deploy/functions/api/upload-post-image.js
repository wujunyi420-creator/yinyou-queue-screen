import { json } from '../../_utils.js';

// POST /api/upload-post-image — 上传帖子图片
export async function onRequestPost(context) {
  const { env } = context;
  const formData = await context.request.formData();
  const file = formData.get('file');
  if (!file) return json({ error: '未收到图片' }, 400);

  const maxSize = 5 * 1024 * 1024;
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > maxSize) return json({ error: '图片过大（超过5MB）' }, 413);

  // 推断 mime
  let mime = 'image/jpeg';
  const name = (file.name || '').toLowerCase();
  if (/\.png$/.test(name)) mime = 'image/png';
  else if (/\.gif$/.test(name)) mime = 'image/gif';
  else if (/\.webp$/.test(name)) mime = 'image/webp';

  // base64 编码
  const buf = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  const base64 = btoa(binary);

  const id = 'post_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  await env.DB.prepare('INSERT INTO images(id, mime, data, created_at) VALUES(?,?,?,?)').bind(id, mime, base64, Date.now()).run();
  return json({ ok: true, url: '/api/img/' + id });
}
