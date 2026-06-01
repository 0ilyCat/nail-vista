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
    "$OpenClawDir\workspace\xiaomei",
    "$OpenClawDir\workspace\ops",
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
Write-Host ""
Write-Host "正在启动 OpenClaw Gateway (端口 $Port)..." -ForegroundColor Cyan
Write-Host "配置来源 : $OpenClawDir\openclaw.json"
Write-Host ""

openclaw gateway run --port $Port
