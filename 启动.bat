@echo off
title 排队大屏服务
cd /d "%~dp0"
echo ========================================
echo   排队大屏服务启动（含扫码取号）
echo ========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js
  echo 下载地址：https://nodejs.org/
  echo.
  pause
  exit /b 1
)
netsh advfirewall firewall show rule name="排队大屏 8787" >nul 2>nul
if errorlevel 1 (
  echo [提示] 首次使用：请先双击"开放端口.bat"开放防火墙端口，
  echo        否则其他电脑无法访问大屏。运行一次即可。
  echo.
)
echo 正在启动服务...
echo 控制台（本机）：http://localhost:8787/console.html
echo 取号页（手机）：http://本机IP:8787/take.html
echo 大屏（其他电脑）：http://本机IP:8787/display.html
echo.
echo 扫码号前缀：C（如 C001）
echo 关闭此窗口即停止服务
echo ----------------------------------------
echo.
start "" http://localhost:8787/console.html
node server.js
pause