# 音游窝 · 排队大屏

音游街机店（舞萌 maimai / 中二节奏 CHUNITHM）排队叫号大屏系统，集成扫码取号、语音叫号、社区论坛与 AI 内容审核。

## 简介

专为音游街机店设计的排队管理系统。顾客扫码取号，大屏实时展示排队进度并语音叫号；内置社区论坛供玩家交流，AI 自动审核帖子内容（文字 + 图片逐张审核，违规自动撤回）。

### 核心功能

- **排队大屏**：轮播展示店铺信息、价格表、排队列表，新号叫号全屏弹窗 + 语音播报
- **扫码取号**：顾客手机扫码自助取号，支持会员 / VIP 识别
- **语音叫号**：号码 + 机台 + 窗口语音播报（可自定义音频，支持浏览器 TTS）
- **社区论坛**：发帖、评论、点赞、图片上传、头像、公告、敏感词过滤
- **AI 内容审核**：后台异步审核文字与图片，违规自动撤回并清理图片
- **管理后台**：机台管理、叫号控制、会员管理、背景图、公告设置
- **多种部署**：本地运行 / Render / Cloudflare Pages / Deno Deploy

## 下载

前往 [Releases](../../releases) 页面下载：

- **完整版** `queue-screen-full.zip`：含全部功能与音频文件，开箱即用
- **合作商版** `queue-screen-partner.zip`：精简配置版，适合街机店合作商

## 快速开始（本地运行）

1. 安装 [Node.js](https://nodejs.org/) 14+
2. 下载本项目代码
3. 安装依赖：`npm install`
4. 复制 `.env.example` 为 `.env`，按需填写 AI 审核配置（不填则跳过审核）
5. 启动：`npm start`（或双击 `启动.bat`）
6. 浏览器打开 `http://localhost:8787`
   - 大屏：`/display.html`
   - 取号：`/take.html`
   - 管理后台：`/console.html`
   - 论坛：`/forum.html`

> 开放局域网访问请运行 `开放端口.bat`，其他设备用本机 IP 访问。

## 部署

### Render（推荐 · 一键部署）

1. Fork 本仓库到你的 GitHub
2. Render → New → Blueprint → 选择仓库
3. 填写环境变量（AI_MOD_URL / AI_MOD_KEY / AI_MOD_MODEL）
4. 部署完成

详见 `部署指南.txt`。

### Cloudflare Pages

见 `cf-deploy/部署指南.txt`。

### Deno Deploy

见 `deno-deploy/`。

## 技术栈

- **后端**：Node.js（原生 HTTP，可选 PostgreSQL）
- **前端**：原生 HTML / CSS / JavaScript（无框架，无构建）
- **数据库**：PostgreSQL（可选，默认用内存 + JSON 文件）
- **AI 审核**：OpenAI 兼容格式 API（可自选服务商）

## 项目结构

```
├── server.js          # 主服务（排队 + 论坛 + AI 审核）
├── display.html       # 排队大屏
├── take.html          # 扫码取号页
├── console.html       # 管理后台
├── forum.html         # 社区论坛
├── init.sql           # 数据库建表脚本
├── render.yaml        # Render 部署配置
├── .env.example       # 环境变量示例
├── 排队大屏/           # 独立运行版（含音频）
├── cf-deploy/         # Cloudflare Pages 部署
└── deno-deploy/       # Deno Deploy 部署
```

## AI 内容审核说明

系统支持 OpenAI 兼容格式的 AI 审核接口。配置以下环境变量即可启用：

| 变量 | 说明 |
|------|------|
| `AI_MOD_URL` | AI 审核 API 地址（OpenAI 兼容格式） |
| `AI_MOD_KEY` | API 密钥 |
| `AI_MOD_MODEL` | 模型名称（需支持图片识别） |

不配置则跳过 AI 审核。审核逻辑：文字单独审核 + 每张图片逐张单独审核，任意一项违规即触发撤回并清理图片。

## License

本项目采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 协议（署名-非商业性使用-相同方式共享 4.0 国际），并附加以下条款：

- 允许：分享、修改、二次开发、分发
- 禁止：**商业贩卖**（不得出售本软件或其衍生作品）
- 要求：
  - 署名 + 衍生作品采用相同协议
  - **二次开发必须开源**：衍生作品须发布到酷安、GitHub 或数码交流论坛（V2EX、少数派等），并附上源代码，不得闭源发布

街机店/合作商内部免费使用不视为商业贩卖。详见 [LICENSE](LICENSE)。
