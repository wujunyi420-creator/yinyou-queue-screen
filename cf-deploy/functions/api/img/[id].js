// GET /api/img/:id — 读取图片
export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;
  if (!id) return new Response('Not found', { status: 404 });

  const row = await env.DB.prepare('SELECT mime, data FROM images WHERE id=?').bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });

  // base64 解码
  const binary = atob(row.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return new Response(bytes, {
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
