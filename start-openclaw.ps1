<#
.SYNOPSIS
以项目目录为 OPENCLAW_HOME 启动 OpenClaw
#>

# 1. 脚本所在目录 = 项目根目录（自动，相对路径）
$ProjectRoot = $PSScriptRoot
Write-Host "项目根目录: $ProjectRoot"

# 2. 设置 OPENCLAW_HOME 为项目根目录
$env:OPENCLAW_HOME = $ProjectRoot
Write-Host "OPENCLAW_HOME = $env:OPENCLAW_HOME"

# 3. 确保 .openclaw 目录存在
$OpenClawDir = Join-Path $ProjectRoot ".openclaw"
if (-not (Test-Path $OpenClawDir)) {
    New-Item -ItemType Directory -Path (Join-Path $OpenClawDir "workspace") | Out-Null
    Write-Host "已创建: $OpenClawDir"
}

# 4. 启动 openclaw（可改成 onboard / gateway / server）
openclaw gateway run --port 18789