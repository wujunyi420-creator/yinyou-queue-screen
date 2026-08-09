#!/bin/bash
# 排队大屏启动脚本 (Linux 专用)
# 用法: chmod +x start-linux.sh && ./start-linux.sh
#
# 可选环境变量:
#   INSTALL_TTS=1    首次启动时自动安装中文 TTS 语音包 (espeak-ng)
#   SKIP_TTS_CHECK=1 跳过 TTS 检测

cd "$(dirname "$0")"

echo "========================================"
echo "  排队大屏服务启动 (Linux · 扫码取号)"
echo "========================================"
echo ""

# 检测 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装："
    echo "  Ubuntu/Debian:     sudo apt install -y nodejs"
    echo "  CentOS/RHEL:       sudo yum install -y nodejs"
    echo "  Fedora:            sudo dnf install -y nodejs"
    echo "  Arch:              sudo pacman -S nodejs"
    echo "  或访问:            https://nodejs.org/zh-cn/download/"
    echo ""
    read -p "按回车退出..."
    exit 1
fi

NODE_VER=$(node -v)
echo "[OK] Node.js 版本: $NODE_VER"

# ===== Linux TTS 语音包检测 / 安装 =====
# 说明: Linux 浏览器 Web Speech API 普遍会回退到系统 TTS 引擎
#       不装语音包 => 大屏叫号可能没声音；装 espeak-ng => 至少能出声
install_tts() {
    echo ""
    echo "----------------------------------------"
    echo "  检测到未安装中文 TTS 语音包"
    echo "----------------------------------------"
    echo "Linux 浏览器不像 Windows/Mac 自带在线语音，"
    echo "需要安装系统 TTS 引擎才能让大屏叫号出声。"
    echo ""
    echo "推荐方案："
    echo "  1) espeak-ng   ——轻量、几乎所有发行版都有，声音偏机械"
    echo "  2) piper       ——神经网络语音，质量好，需手动下载模型（见使用指南）"
    echo ""
    read -p "是否现在安装 espeak-ng？[y/N] " ans
    case "$ans" in
        y|Y|yes|YES)
            if command -v apt &> /dev/null; then
                echo "[执行] sudo apt install -y espeak-ng"
                sudo apt install -y espeak-ng
            elif command -v dnf &> /dev/null; then
                echo "[执行] sudo dnf install -y espeak-ng"
                sudo dnf install -y espeak-ng
            elif command -v yum &> /dev/null; then
                echo "[执行] sudo yum install -y espeak-ng"
                sudo yum install -y espeak-ng
            elif command -v pacman &> /dev/null; then
                echo "[执行] sudo pacman -S --noconfirm espeak-ng"
                sudo pacman -S --noconfirm espeak-ng
            elif command -v zypper &> /dev/null; then
                echo "[执行] sudo zypper install -y espeak-ng"
                sudo zypper install -y espeak-ng
            else
                echo "[跳过] 未识别的包管理器，请手动安装 espeak-ng"
                echo "       参考使用指南-Linux.txt 第六章"
            fi
            ;;
        *)
            echo "[跳过] 未安装 TTS。大屏语音可能无法播报。"
            echo "       可稍后手动安装，或改用 Windows/Mac/平板当大屏机。"
            ;;
    esac
}

if [ "$SKIP_TTS_CHECK" != "1" ]; then
    if ! command -v espeak-ng &> /dev/null && ! command -v espeak &> /dev/null && ! command -v piper &> /dev/null; then
        if [ "$INSTALL_TTS" = "1" ]; then
            install_tts
        else
            echo ""
            echo "[提示] 未检测到中文 TTS 语音包，大屏语音叫号可能没声音。"
            echo "  · 现在安装:   INSTALL_TTS=1 ./start-linux.sh"
            echo "  · 稍后安装:   参考使用指南-Linux.txt 第六章"
            echo "  · 跳过此提示: SKIP_TTS_CHECK=1 ./start-linux.sh"
        fi
    else
        echo "[OK] 已检测到系统 TTS 引擎"
        # 测试中文语音是否可用
        if command -v espeak-ng &> /dev/null; then
            ZH_VOICE=$(espeak-ng --voices=zh 2>/dev/null | tail -n +2 | head -1)
            if [ -n "$ZH_VOICE" ]; then
                echo "       espeak-ng 中文语音: $ZH_VOICE"
            else
                echo "       [警告] espeak-ng 已装但无中文语音数据"
                echo "              Ubuntu/Debian: sudo apt install -y espeak-ng-data"
            fi
        fi
    fi
fi

# 获取本机局域网 IP (Linux 专用)
get_ip() {
    hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "127.0.0.1"
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

# 尝试用默认浏览器打开控制台（后台执行，不阻塞）
(
    sleep 1
    URL="http://localhost:$PORT/console.html"
    if command -v xdg-open &> /dev/null; then
        xdg-open "$URL" 2>/dev/null
    elif command -v gio &> /dev/null; then
        gio open "$URL" 2>/dev/null
    fi
) &

# 启动服务
node server.js
