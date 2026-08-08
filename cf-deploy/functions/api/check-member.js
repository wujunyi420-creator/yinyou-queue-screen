import { json, readBody } from '../../_utils.js';

// POST /api/check-member — 查询会员（Cloudflare 版无会员系统，统一返回非会员）
export async function onRequestPost(context) {
  const body = await readBody(context.request);
  const phone = String(body.phone || '').trim();
  return json({
    isMember: false,
    vip: false,
    name: '',
    avatar: null,
    visits: 0,
    phone: phone
  });
}
