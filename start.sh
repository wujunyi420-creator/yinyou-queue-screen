#!/bin/bash
# 排队大屏启动脚本 (Linux / macOS 通用)
# 用法: chmod +x start.sh && ./start.sh

cd "$(dirname "$0")"

echo "========================================"
echo "  排队大屏服务启动 (扫码取号)"
echo "========================================"
echo ""

# 检测 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装："
    echo "  macOS (Homebrew):  brew install node"
    echo "  Ubuntu/Debian:     sudo apt install nodejs"
    echo "  CentOS/RHEL:       sudo yum install nodejs"
    echo "  或访问:            https://nodejs.org/"
    echo ""
    read -p "按回车退出..."
    exit 1
fi

NODE_VER=$(node -v)
echo "[OK] Node.js 版本: $NODE_VER"

# 获取本机局域网 IP
get_ip() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1"
    else
        # Linux
        hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "127.0.0.1"
    fi
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

# 尝试打开默认浏览器(后台执行,不阻塞)
(
    sleep 1
    URL="http://localhost:$PORT/console.html"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$URL" 2>/dev/null
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$URL" 2>/dev/null
    fi
) &

# 启动服务
node server.js
