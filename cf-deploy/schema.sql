-- Cloudflare D1 初始化脚本
-- 在 Cloudflare Dashboard > Workers & Pages > D1 > 你的数据库 > Console 中执行

-- 帖子表
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  cat TEXT DEFAULT '讨论',
  author_phone TEXT DEFAULT '',
  author_name TEXT DEFAULT '匿名',
  author_vip INTEGER DEFAULT 0,
  author_member INTEGER DEFAULT 0,
  author_avatar TEXT DEFAULT '',
  images TEXT DEFAULT '[]',
  likes INTEGER DEFAULT 0,
  liked_by TEXT DEFAULT '[]',
  views INTEGER DEFAULT 0,
  comments TEXT DEFAULT '[]',
  created_at INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

-- 图片表（base64 存储）
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  mime TEXT DEFAULT 'image/jpeg',
  data TEXT DEFAULT '',
  created_at INTEGER DEFAULT 0
);

-- 设置表（KV 风格，存店名/公告/拦截词等）
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);

-- 初始化默认拦截词（首次部署时插入）
INSERT OR IGNORE INTO settings(key, value) VALUES('shopName', '音游窝社区');
INSERT OR IGNORE INTO settings(key, value) VALUES('tagline', '欢迎来到音游窝');
INSERT OR IGNORE INTO settings(key, value) VALUES('announcements', '[]');
INSERT OR IGNORE INTO settings(key, value) VALUES('blockedWords', '["我操你妈","操你妈","傻逼","fuck","shit","bitch","色情","赌博","毒品","诈骗","广告引流","人身攻击"]');
