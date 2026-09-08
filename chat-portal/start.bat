@echo off
chcp 65001 >nul
echo ========================================
echo   Chat Portal - 启动中...
echo ========================================
echo.

:: 编译 AI Service
echo [1/5] 编译 AI Service...
cd /d "%~dp0ai-service"
call mvn clean package -DskipTests -q
if %errorlevel% neq 0 (
  echo 警告: AI Service 编译失败，将跳过 AI 功能
  set AI_SKIP=1
) else (
  echo AI Service 编译成功
  set AI_SKIP=0
)

:: 安装后端依赖
echo [2/5] 安装后端依赖...
cd /d "%~dp0backend"
call npm install
if %errorlevel% neq 0 (
  echo 后端依赖安装失败!
  pause
  exit /b 1
)

:: 安装前端依赖
echo [3/5] 安装前端依赖...
cd /d "%~dp0frontend"
call npm install
if %errorlevel% neq 0 (
  echo 前端依赖安装失败!
  pause
  exit /b 1
)

:: 杀掉同端口的旧进程
powershell -NoProfile -Command "
  Write-Host '  检查端口 3001 (后端)...'
  netstat -ano | Select-String ':3001' | ForEach-Object {
    $procId = ($_.Line.Trim() -split '\s+')[-1]
    if ($procId -and $procId -ne '0') {
      Write-Host ('    发现端口 3001 被进程 ' + $procId + ' 占用，正在关闭...')
      taskkill /f /pid $procId 2>$null
    }
  }
  Write-Host '  检查端口 5174 (前端)...'
  netstat -ano | Select-String ':5174' | ForEach-Object {
    $procId = ($_.Line.Trim() -split '\s+')[-1]
    if ($procId -and $procId -ne '0') {
      Write-Host ('    发现端口 5174 被进程 ' + $procId + ' 占用，正在关闭...')
      taskkill /f /pid $procId 2>$null
    }
  }
  Write-Host '  检查端口 8081 (AI Service)...'
  netstat -ano | Select-String ':8081' | ForEach-Object {
    $procId = ($_.Line.Trim() -split '\s+')[-1]
    if ($procId -and $procId -ne '0') {
      Write-Host ('    发现端口 8081 被进程 ' + $procId + ' 占用，正在关闭...')
      taskkill /f /pid $procId 2>$null
    }
  }
"

:: 启动 AI Service（后台）
if "%AI_SKIP%"=="0" (
  echo [4/5] 启动 AI Service...
  cd /d "%~dp0ai-service"
  start "Chat-Portal-AI" cmd /c "java -jar target\ai-service.jar"
)

:: 启动后端（后台）
echo [4/5] 启动后端服务...
cd /d "%~dp0backend"
start "Chat-Portal-Backend" cmd /c "node server.js"

:: 等待后端启动
echo 等待后端启动...
timeout /t 3 /nobreak >nul

:: 启动前端（开发服务器）
echo [5/5] 启动前端服务...
cd /d "%~dp0frontend"
start "Chat-Portal-Frontend" cmd /c "npx vite --open"

echo.
echo ========================================
echo   Chat Portal 已启动！
echo   前端: http://localhost:5174
echo   后端: http://localhost:3001
if "%AI_SKIP%"=="0" echo   AI Service: http://localhost:8081
echo ========================================
echo.
echo 按任意键关闭所有服务...
pause >nul

:: 关闭服务
taskkill /fi "WindowTitle eq Chat-Portal-AI*" /f >nul 2>&1
taskkill /fi "WindowTitle eq Chat-Portal-Backend*" /f >nul 2>&1
taskkill /fi "WindowTitle eq Chat-Portal-Frontend*" /f >nul 2>&1

