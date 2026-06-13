<#
.SYNOPSIS
    NailVista OpenClaw Gateway 启动脚本（项目内自包含）
.DESCRIPTION
    以项目根目录为 OPENCLAW_HOME，强制 OpenClaw 读取 .openclaw/ 下的配置。
    所有配置（含 API Key）均在 .openclaw/openclaw.json 中管理，无需设置额外环境变量。
.PARAMETER Port
    Gateway 端口，默认 18789
.EXAMPLE
    .\start-openclaw.ps1
    .\start-openclaw.ps1 -Port 18790
#>
param(
    [int]$Port = 18789
)

$ErrorActionPreference = "Stop"

# ============================================================
# 1. 自动定位项目根目录（脚本所在目录）
# ============================================================
$ProjectRoot = $PSScriptRoot
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  NailVista OpenClaw Gateway Launcher" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "项目根目录 : $ProjectRoot"

# ============================================================
# 2. 设置 OPENCLAW_HOME（强制指向项目根目录）
# ============================================================
$env:OPENCLAW_HOME = $ProjectRoot
Write-Host "OPENCLAW_HOME: $env:OPENCLAW_HOME"

# ============================================================
# 3. 确保运行时目录结构存在（不覆盖已有配置）
# ============================================================
$OpenClawDir = Join-Path $ProjectRoot ".openclaw"
$DirsToCreate = @(
    "$OpenClawDir\logs",
    "$OpenClawDir\plugin-skills"
)

foreach ($Dir in $DirsToCreate) {
    if (-not (Test-Path $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
        Write-Host "已创建目录 : $Dir" -ForegroundColor Gray
    }
}

# ============================================================
# 4. 启动 OpenClaw Gateway
# ============================================================

# 配置端口
Write-Host "`n=== 端口 $Port 自动清理工具 ===" -ForegroundColor Cyan

# 1. 获取占用端口的进程
$tcpProcess = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($tcpProcess) {
    # 获取进程PID
    $processId = $tcpProcess.OwningProcess
    Write-Host "`n检测到端口 $Port 被 PID: $processId 占用" -ForegroundColor Yellow
    
    # 强制终止进程
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 300
    Write-Host "进程已强制关闭" -ForegroundColor Green
}
else {
    Write-Host "`n端口 $Port 空闲，无需清理" -ForegroundColor Green
}

Write-Host ""
Write-Host "正在启动 OpenClaw Gateway (端口 $Port)..." -ForegroundColor Cyan
Write-Host "配置来源 : $OpenClawDir\openclaw.json"
Write-Host ""

openclaw gateway run --port $Port
