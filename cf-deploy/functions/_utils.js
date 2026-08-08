// 共享工具函数
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export async function readBody(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 拦截词检查
export function checkBlocked(text, words) {
  if (!words || !words.length || !text) return null;
  const lower = String(text).toLowerCase();
  for (const w of words) {
    const w1 = String(w).trim().toLowerCase();
    if (w1 && lower.indexOf(w1) >= 0) return w;
  }
  return null;
}

// 获取设置
export async function getSetting(db, key) {
  const r = await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();
  return r ? r.value : null;
}

// 获取拦截词数组
export async function getBlockedWords(db) {
  const v = await getSetting(db, 'blockedWords');
  try { return v ? JSON.parse(v) : []; } catch (e) { return []; }
}

// AI 审核：单次请求
export async function callAIModeration(env, payload) {
  const url = env.AI_MOD_URL;
  const key = env.AI_MOD_KEY;
  const model = env.AI_MOD_MODEL;
  if (!url || !key || !model) return '';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    return String(reply).trim();
  } catch (e) {
    return '';
  }
}

export function isViolationReply(reply) {
  if (!reply) return false;
  return reply.indexOf('1') === 0 || reply === '1' || reply === '违规';
}

// AI 审核帖子（文字 + 逐张图片）
export async function aiModeratePost(env, db, post) {
  const url = env.AI_MOD_URL;
  const key = env.AI_MOD_KEY;
  const model = env.AI_MOD_MODEL;
  if (!url || !key || !model) return;

  const basePrompt = '你是一名音游社区（音游窝）的内容审核员，负责守护社区氛围。'
    + '你的任务是判断用户发布的内容是否违规。\n'
    + '违规标准：人身攻击、辱骂、脏话、色情低俗裸露、毒品赌博、政治敏感、广告引流、诈骗、人肉隐私、煽动暴力、违法违规内容。图片含色情/暴力/血腥/违法违规元素也视为违规。\n'
    + '正常讨论音游玩法、约拼机、晒成绩截图、技术交流、闲聊属于合规内容。\n'
    + '判断依据：整体语义和图片内容，不拘泥于单个词汇。\n'
    + '输出规则：只回复一个字符，违规回复"1"，正常回复"0"。禁止任何解释、标点、多余文字。';

  const postText = '分类：' + (post.cat || '讨论') + '\n标题：' + (post.title || '') + '\n内容：' + (post.content || '');
  let images = [];
  try { images = JSON.parse(post.images || '[]'); } catch (e) {}
  images = images.slice(0, 6);

  // 构建任务
  const tasks = [];
  // 文字任务
  tasks.push({
    label: '文字',
    payload: {
      model,
      messages: [
        { role: 'system', content: basePrompt },
        { role: 'user', content: '请审核以下帖子文字内容：\n' + postText }
      ],
      temperature: 0.1,
      max_tokens: 5
    }
  });
  // 图片任务（逐张）
  for (let i = 0; i < images.length; i++) {
    const imgUrl = images[i];
    const imgId = imgUrl.split('?')[0].replace(/^\/api\/img\//, '');
    const imgRow = await db.prepare('SELECT mime, data FROM images WHERE id=?').bind(imgId).first();
    if (!imgRow) continue;
    const dataUrl = 'data:' + imgRow.mime + ';base64,' + imgRow.data;
    tasks.push({
      label: '图片' + (i + 1),
      payload: {
        model,
        messages: [
          { role: 'system', content: basePrompt + '\n本次仅审核一张图片本身是否违规。' },
          { role: 'user', content: [
            { type: 'text', text: '请仅判断下面这张图片是否违规（帖子文字背景：\n' + postText + '\n）。' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ] }
        ],
        temperature: 0.1,
        max_tokens: 5
      }
    });
  }

  // 并行发起所有审核
  const replies = await Promise.all(tasks.map(t => callAIModeration(env, t.payload)));
  for (let i = 0; i < replies.length; i++) {
    console.log('[AI审核] 帖子 ' + post.id + ' ' + tasks[i].label + ' 回复:', JSON.stringify(replies[i]));
    if (isViolationReply(replies[i])) {
      // 违规 → 删除帖子 + 图片
      const pImgs = [];
      try { pImgs = JSON.parse(post.images || '[]'); } catch (e) {}
      for (const u of pImgs) {
        const iid = String(u).split('?')[0].replace(/^\/api\/img\//, '');
        await db.prepare('DELETE FROM images WHERE id=?').bind(iid).run();
      }
      await db.prepare('DELETE FROM posts WHERE id=?').bind(post.id).run();
      console.log('[AI审核] 帖子 ' + post.id + ' ' + tasks[i].label + '违规已撤回');
      return;
    }
  }
  console.log('[AI审核] 帖子 ' + post.id + ' 全部通过（' + tasks.length + ' 项）');
}
