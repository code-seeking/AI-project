<#
.SYNOPSIS
  Chat Portal — PostgreSQL 一键安装与初始化脚本
.DESCRIPTION
  使用 winget 安装 PostgreSQL 16，初始化数据库和表结构
#>

$ErrorActionPreference = 'Stop'
$PG_VERSION = '16'
$DB_NAME = 'chat_portal'
$DB_USER = 'postgres'
$DB_PASS = 'postgres'

Write-Host "🔧 Chat Portal PostgreSQL 安装脚本" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# 1. 检查是否已安装
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService) {
  Write-Host "✅ PostgreSQL 服务已存在: $($pgService.Name)" -ForegroundColor Green
} else {
  Write-Host "📥 正在安装 PostgreSQL $PG_VERSION ..." -ForegroundColor Yellow
  Write-Host "   这可能需要几分钟时间，请稍候..." -ForegroundColor Yellow

  try {
    winget install PostgreSQL.PostgreSQL.$PG_VERSION --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
      throw "winget 安装失败，请手动从 https://www.enterprisedb.com/downloads/postgres-postgresql-downloads 安装"
    }
  } catch {
    Write-Host "❌ $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 请手动安装 PostgreSQL 后重试" -ForegroundColor Yellow
    exit 1
  }
}

# 2. 等待服务启动
Write-Host "⏳ 等待 PostgreSQL 服务启动..." -ForegroundColor Yellow
$timeout = 30
$started = $false
while ($timeout -gt 0) {
  $svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -eq 'Running') {
    $started = $true
    break
  }
  Start-Sleep -Seconds 2
  $timeout -= 2
}
if (-not $started) { Write-Host "⚠️ 服务未自动启动，尝试手动启动..." -ForegroundColor Yellow
  $svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
  if ($svc) { Start-Service $svc.Name }
}

# 3. 初始化数据库
$pgBin = "$env:ProgramFiles\PostgreSQL\$PG_VERSION\bin"
$env:Path = "$pgBin;$env:Path"

Write-Host "🗄️ 正在初始化数据库: $DB_NAME ..." -ForegroundColor Yellow
try {
  # 检查数据库是否已存在
  $exists = & psql -U $DB_USER -l 2>$null | Select-String $DB_NAME
  if (-not $exists) {
    & createdb -U $DB_USER $DB_NAME
    Write-Host "✅ 数据库 $DB_NAME 已创建" -ForegroundColor Green
  } else {
    Write-Host "✅ 数据库 $DB_NAME 已存在" -ForegroundColor Green
  }
} catch {
  Write-Host "⚠️ 无法自动创建数据库: $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "💡 请手动运行: createdb -U postgres $DB_NAME" -ForegroundColor Yellow
}

# 4. 初始化表结构
Write-Host "📋 初始化表结构..." -ForegroundColor Yellow
$schemaSql = @"
-- 书签分组
CREATE TABLE IF NOT EXISTS bookmark_groups (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 书签（含标签数组、分组、多语言）
CREATE TABLE IF NOT EXISTS bookmarks (
  id          SERIAL PRIMARY KEY,
  keyword     VARCHAR(255) NOT NULL,
  url         TEXT NOT NULL,
  description TEXT DEFAULT '',
  tags        TEXT[] DEFAULT '{}',
  group_id    INTEGER REFERENCES bookmark_groups(id) ON DELETE SET NULL,
  language    VARCHAR(10) DEFAULT 'zh',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_keyword ON bookmarks(keyword);
CREATE INDEX IF NOT EXISTS idx_bookmarks_tags   ON bookmarks USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_bookmarks_group  ON bookmarks(group_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_lang   ON bookmarks(language);

-- 导入导出日志
CREATE TABLE IF NOT EXISTS import_export_logs (
  id          SERIAL PRIMARY KEY,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('import', 'export')),
  format      VARCHAR(10) NOT NULL CHECK (format IN ('json', 'csv')),
  count       INTEGER NOT NULL DEFAULT 0,
  file_path   TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
"@

$schemaSql | & psql -U $DB_USER -d $DB_NAME
Write-Host "✅ 表结构初始化完成" -ForegroundColor Green

# 5. 验证
Write-Host "`n🔍 验证数据库连接..." -ForegroundColor Cyan
try {
  $result = & psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) AS total FROM bookmarks" -t 2>$null
  Write-Host "✅ PostgreSQL 就绪！当前书签数: $($result.Trim())" -ForegroundColor Green
} catch {
  Write-Host "⚠️ 验证失败，请检查配置" -ForegroundColor Yellow
}

Write-Host "`n📝 请在 backend/.env 中配置以下信息:" -ForegroundColor Cyan
Write-Host "  PGHOST=localhost" -ForegroundColor White
Write-Host "  PGPORT=5432" -ForegroundColor White
Write-Host "  PGDATABASE=$DB_NAME" -ForegroundColor White
Write-Host "  PGUSER=$DB_USER" -ForegroundColor White
Write-Host "  PGPASSWORD=$DB_PASS" -ForegroundColor White
Write-Host "`n🎉 安装完成！请重启后端服务" -ForegroundColor Green
