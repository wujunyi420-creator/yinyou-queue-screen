-- 初始化数据库表（Render PostgreSQL 首次部署时执行）
-- kv_store: 存储整个 state（JSONB）
CREATE TABLE IF NOT EXISTS kv_store (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- images: 存储图片 base64
CREATE TABLE IF NOT EXISTS images (
  id    TEXT PRIMARY KEY,
  mime  TEXT NOT NULL DEFAULT 'image/jpeg',
  data  TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
