@echo off
chcp 65001 >nul
title Chat Portal 启动器

echo ========================================
echo   Chat Portal - 一键启动
echo ========================================
echo.

:: 杀掉同端口的旧进程
echo [1/5] 清理旧进程...
powershell -NoProfile -Command "$ports=@(3001,5174,8081); foreach($p in $ports){ netstat -ano | Select-String (':'+$p) | ForEach-Object { $procId = ($_.Line.Trim() -split '\s+')[-1]; if ($procId -and $procId -ne '0') { taskkill /f /pid $procId 2>$null } } }"

:: 启动 AI Service
echo [2/5] 启动 AI 服务 (端口 8081)...
cd /d "%~dp0ai-service"
if exist target\ai-service.jar (
  start "Chat-Portal-AI" cmd /c "java -jar target\ai-service.jar"
) else (
  echo   AI 服务 JAR 不存在，跳过...
)

:: 启动后端
echo [3/5] 启动后端服务 (端口 3001)...
cd /d "%~dp0backend"
start "Chat-Portal-Backend" cmd /c "node server.js"

:: 等待后端启动
echo 等待后端启动...
timeout /t 3 /nobreak >nul

:: 启动前端
echo [4/5] 启动前端服务 (端口 5174)...
cd /d "%~dp0frontend"
start "Chat-Portal-Frontend" cmd /c "npx vite --host"

:: 等待前端就绪
echo 等待前端就绪...
timeout /t 4 /nobreak >nul

:: 打开浏览器
echo [5/5] 自动打开浏览器...
start "" "http://localhost:5174"

echo.
echo ========================================
echo   ✅ Chat Portal 已启动！
echo   前端: http://localhost:5174
echo   后端: http://localhost:3001
echo   AI  : http://localhost:8081
echo ========================================
echo.
echo 关闭此窗口不影响服务运行。
echo 如需关闭服务，请运行 start.bat 或手动结束进程。
echo.
timeout /t 5 /nobreak >nul
