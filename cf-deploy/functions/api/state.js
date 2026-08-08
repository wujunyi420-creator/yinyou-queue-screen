import { json, readBody, getSetting } from '../_utils.js';

// GET /api/state — 返回基础设置（店名等）
export async function onRequestGet(context) {
  const { env } = context;
  const shopName = await getSetting(env.DB, 'shopName') || '音游窝社区';
  const tagline = await getSetting(env.DB, 'tagline') || '欢迎来到音游窝';
  return json({ shopName, tagline });
}
