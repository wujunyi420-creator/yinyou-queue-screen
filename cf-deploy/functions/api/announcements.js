import { json, readBody, getSetting } from '../../_utils.js';

// GET /api/announcements — 获取公告
export async function onRequestGet(context) {
  const v = await getSetting(context.env.DB, 'announcements');
  let announcements = [];
  try { announcements = v ? JSON.parse(v) : []; } catch (e) {}
  return json({ ok: true, announcements });
}
