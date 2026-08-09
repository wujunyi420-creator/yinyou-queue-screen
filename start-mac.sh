#!/bin/bash
# 排队大屏启动脚本 (macOS 专用)
# 用法: chmod +x start-mac.sh && ./start-mac.sh

cd "$(dirname "$0")"

echo "========================================"
echo "  排队大屏服务启动 (macOS · 扫码取号)"
echo "========================================"
echo ""

# 检测 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装："
    echo "  推荐 Homebrew:  brew install node"
    echo "  如未装 Homebrew:"
    echo "    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "  或访问: https://nodejs.org/zh-cn/download/"
    echo ""
    read -p "按回车退出..."
    exit 1
fi

NODE_VER=$(node -v)
echo "[OK] Node.js 版本: $NODE_VER"

# 获取本机局域网 IP (macOS 专用)
get_ip() {
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1"
}

LOCAL_IP=$(get_ip)
PORT=8787

echo ""
echo "服务正在启动..."
echo "控制台地址:  http://localhost:$PORT/console.html"
echo "取号页地址:  http://$LOCAL_IP:$PORT/take.html"
echo "大屏地址:    http://$LOCAL_IP:$PORT/display.html"
echo ""
echo "扫码号前缀: C (例如 C001)"
echo "关闭此窗口即停止服务"
echo "----------------------------------------"
echo ""

# 顺带检测系统中文语音包（仅提示，不影响启动）
if ! command -v say &> /dev/null; then
    echo "[提示] 未找到 say 命令，语音叫号将依赖浏览器 TTS。"
else
    # 检查是否已安装中文语音
    ZH_VOICE=$(say -v '?' 2>/dev/null | grep -iE 'zh|Ting-Ting|Sin-ji|Mei-Jia' | head -1)
    if [ -z "$ZH_VOICE" ]; then
        echo "[提示] 未检测到 macOS 中文系统语音。"
        echo "  如需 Safari 播报中文，请到："
        echo "  系统设置 → 辅助功能 → 语音 → 系统语音 → 管理 → 添加 Ting-Ting"
        echo "  （推荐改用 Chrome / Edge 打开大屏，无需本地语音包）"
    else
        echo "[OK] 已检测到 macOS 中文语音: $ZH_VOICE"
    fi
fi
echo ""

# 用默认浏览器打开控制台（后台执行，不阻塞）
(
    sleep 1
    open "http://localhost:$PORT/console.html" 2>/dev/null
) &

# 启动服务
node server.js
