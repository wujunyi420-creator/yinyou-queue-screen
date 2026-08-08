@echo off
title 开放防火墙端口 8787
>nul 2>&1 net session
if %errorlevel% neq 0 (
  echo 需要管理员权限来开放防火墙端口。
  echo 即将弹出授权窗口，请点"是"。
  echo.
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
echo ========================================
echo   开放防火墙端口 8787（所有网络）
echo ========================================
echo.
netsh advfirewall firewall delete rule name="排队大屏 8787" >nul 2>nul
netsh advfirewall firewall add rule name="排队大屏 8787" dir=in action=allow protocol=TCP localport=8787 profile=any >nul
if %errorlevel% equ 0 (
  echo [成功] 端口 8787 已对所有网络（公用/专用/域）开放
  echo.
  echo 现在其他电脑可以访问大屏和扫码取号了。
  echo 之后只需双击"启动.bat"即可，不用再运行本脚本。
) else (
  echo [失败] 添加规则失败，请手动放行
)
echo.
pause