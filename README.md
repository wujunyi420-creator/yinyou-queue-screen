<div align="center">

# 🎮 音游窝 · 排队大屏

### 一站式音游街机店排队叫号 · 社区论坛 · AI 内容审核系统

专为舞萌 maimai / 中二节奏 CHUNITHM 街机店打造的全功能排队管理系统

🌐 **在线体验**：[音游窝社区论坛](https://yinyou-forum.wujunyi420.workers.dev/)（需挂梯子访问，部署在国外）

[![License](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-FF5C7A?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D14-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-4A90E2?style=flat-square)]()
[![Release](https://img.shields.io/badge/Release-v1.0.0-FFB238?style=flat-square)](../../releases)

</div>

---

## ✨ 项目简介

音游窝排队大屏是一套面向音游街机店的**全栈排队管理解决方案**，将排队叫号、语音播报、社区互动与 AI 智能审核融为一体。顾客扫码即可取号，大屏实时展示排队进度并语音叫号；内置社区论坛让玩家在线交流，AI 全天候守护社区氛围。

> 🎯 **设计理念**：零依赖、开箱即用、一人即可运维的轻量化街机店系统

---

## 🚀 核心功能

### 📺 排队大屏
- 三屏轮播展示：店铺 LOGO / 价格表 / 实时排队列表
- 新号叫号全屏弹窗 + 环形光效动画
- VIP / 会员尊享特效（金色粒子、脉冲光环）
- 自定义背景图与亮度调节

### 📱 扫码取号
- 顾客手机扫码自助取号，无需排队机
- 自动识别会员 / VIP 身份
- 实时查看前方排队人数与预计等待时间

### 🔊 语音叫号
- 号码 + 机台 + 窗口完整语音播报
- 支持自定义音频文件（角色音色、合成语音均可）
- 浏览器 TTS 兜底方案，无需额外服务

### 💬 社区论坛
- 发帖、评论、点赞、图片上传
- 自定义头像、公告系统
- 敏感词过滤与替换

### 🤖 AI 内容审核
- 后台异步审核，不阻塞用户操作
- **文字与图片分离审核**，每张图片逐张检测，杜绝漏检
- 违规内容自动撤回并清理图片
- 兼容 OpenAI 标准接口，可接入任意大模型

### ⚙️ 管理后台
- 机台状态管理（在线 / 离线 / 维护）
- 叫号控制与历史记录
- 会员管理与背景配置
- 实时状态监控

### 🌐 多平台部署
- **本地运行**：双击即用，无需服务器
- **Render**：一键 Blueprint 部署 + PostgreSQL
- **Cloudflare Pages**：边缘部署，全球加速
- **Deno Deploy**：轻量级云部署

---

## 📦 下载

前往 [Releases](../../releases) 页面下载最新版本：

| 版本 | 文件 | 说明 |
|:----:|------|------|
| 👾Windows版 | `queue-screen-windows.zip` | Windows版直接开箱即用 |
| 🐧 Linux 版 | `queue-screen-linux.zip` | 含 start-linux.sh 启动脚本 + TTS 语音包配置 |
| 🍎 macOS 版 | `queue-screen-mac.zip` | 含 start-mac.sh 启动脚本，原生中文语音支持 |

---

## 🛠 快速开始

### 本地运行（最简单）

```bash
# 1. 安装 Node.js 14+ (https://nodejs.org/)
# 2. 下载项目代码并进入目录
npm install                        # 安装依赖
cp .env.example .env               # 复制环境变量示例（按需填写）
npm start                          # 启动服务
```

启动后浏览器打开 `http://localhost:8787`：

| 页面 | 地址 | 用途 |
|------|------|------|
| 📺 排队大屏 | `/display.html` | 投屏到店铺大屏 |
| 📱 扫码取号 | `/take.html` | 顾客手机取号 |
| ⚙️ 管理后台 | `/console.html` | 店主管理 |
| 💬 社区论坛 | `/forum.html` | 玩家交流 |

> 💡 **局域网访问**：双击 `开放端口.bat`，其他设备用本机 IP 访问即可

<details>
<summary>🪟 Windows 一键启动（点击展开）</summary>

直接双击 `启动.bat` 即可，无需命令行操作。

</details>

<details>
<summary>🐧 Linux 启动（点击展开）</summary>

```bash
# 1. 下载 queue-screen-linux.zip 并解压
# 2. 安装 Node.js 14+
#    Ubuntu:   sudo apt install nodejs
#    CentOS:   sudo yum install nodejs
# 3. 进入解压目录，赋权并启动
chmod +x start-linux.sh
./start-linux.sh
```

首次需放行防火墙端口：
- Ubuntu: `sudo ufw allow 8787/tcp`
- CentOS: `sudo firewall-cmd --permanent --add-port=8787/tcp && sudo firewall-cmd --reload`

> 🔊 **Linux 语音叫号需额外配置 TTS**：浏览器不像 Windows/Mac 自带在线语音，
> 首次启动可用 `INSTALL_TTS=1 ./start-linux.sh` 引导安装 espeak-ng，
> 详细方案见包内 `使用指南-Linux.txt` 第六章。

</details>

<details>
<summary>🍎 macOS 启动（点击展开）</summary>

```bash
# 1. 下载 queue-screen-mac.zip 并解压
# 2. 安装 Node.js 14+
#    推荐 Homebrew:  brew install node
# 3. 进入解压目录，赋权并启动
chmod +x start-mac.sh
./start-mac.sh
```

> 🔊 推荐用 Edge / Chrome 打开大屏，可调用在线 Neural 语音（需联网），
> 无需本地语音包。用 Safari 需在「系统设置 → 辅助功能 → 语音」中
> 添加 `Ting-Ting` 中文语音。

</details>

---

## ☁️ 云端部署

### Render（推荐 · 一键部署）

```
1. Fork 本仓库 → 2. Render 新建 Blueprint → 3. 填写环境变量 → 4. 部署完成
```

详见 [`部署指南.txt`](部署指南.txt)

### 其他平台

| 平台 | 指南 |
|------|------|
| Cloudflare Pages | [`cf-deploy/部署指南.txt`](cf-deploy/部署指南.txt) |
| Deno Deploy | [`deno-deploy/`](deno-deploy/) |

---

## 🧰 技术栈

| 层级 | 技术 | 说明 |
|:----:|------|------|
| 后端 | Node.js | 原生 HTTP，零框架依赖 |
| 前端 | HTML / CSS / JS | 原生实现，无构建步骤 |
| 数据库 | PostgreSQL | 可选，默认内存 + JSON 文件 |
| AI 审核 | OpenAI 兼容 API | 可接入任意主流大模型 |

---

## 📁 项目结构

```
yinyou-queue-screen/
├── server.js              # 🚀 主服务（排队 + 论坛 + AI 审核）
├── display.html           # 📺 排队大屏
├── take.html              # 📱 扫码取号页
├── console.html           # ⚙️ 管理后台
├── forum.html             # 💬 社区论坛
├── init.sql               # 🗄 数据库建表脚本
├── render.yaml            # ☁️ Render 部署配置
├── .env.example           # 🔧 环境变量示例
├── 排队大屏/               # 📦 独立运行版（含音频）
├── cf-deploy/             # ☁️ Cloudflare Pages 部署
└── deno-deploy/           # ☁️ Deno Deploy 部署
```

---

## 🤖 AI 内容审核配置

系统支持任意 OpenAI 兼容格式的 AI 审核接口。配置以下环境变量即可启用：

```env
AI_MOD_URL=你的AI审核API地址
AI_MOD_KEY=你的API密钥
AI_MOD_MODEL=你的模型名称（需支持图片识别）
```

> ⚙️ 不配置则自动跳过 AI 审核。审核策略：文字单独审核 + 每张图片逐张单独审核，任意一项违规即触发撤回并清理图片。

---

## 📄 License

本项目采用 **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)** 协议（署名-非商业性使用-相同方式共享 4.0 国际），并附加以下条款：

| | 条款 |
|:---:|------|
| ✅ 允许 | 分享、修改、二次开发、分发 |
| ❌ 禁止 | **商业贩卖**（不得出售本软件或其衍生作品） |
| 📌 要求 | 署名 + 衍生作品采用相同协议 |
| 📌 要求 | **二次开发必须开源**：衍生作品须发布到酷安、GitHub 或数码交流论坛（V2EX、少数派等），并附上源代码 |

> 街机店 / 合作商内部免费使用不视为商业贩卖。详见 [LICENSE](LICENSE)。

---

<div align="center">

**如果这个项目对你有帮助，欢迎 ⭐ Star 支持！**

Made with ❤️ for rhythm game arcades

</div>
