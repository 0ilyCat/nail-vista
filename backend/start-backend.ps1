<#
    功能：自动杀死8190端口进程 → 启动uvicorn服务
#>

# 配置端口
$PORT = 8190
Write-Host "`n=== 端口 $PORT 自动清理工具 ===" -ForegroundColor Cyan

# 1. 获取占用端口的进程
$tcpProcess = Get-NetTCPConnection -LocalPort $PORT -ErrorAction SilentlyContinue

if ($tcpProcess) {
    # 获取进程PID
    $processId = $tcpProcess.OwningProcess
    Write-Host "`n检测到端口 $PORT 被 PID: $processId 占用" -ForegroundColor Yellow
    
    # 强制终止进程
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 300
    Write-Host "进程已强制关闭" -ForegroundColor Green
}
else {
    Write-Host "`n端口 $PORT 空闲，无需清理" -ForegroundColor Green
}

# 2. 启动 uvicorn 服务
Write-Host "`n正在启动服务：D:/anaconda3/envs/nail/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port $PORT --reload`n" -ForegroundColor Cyan
D:/anaconda3/envs/nail/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port $PORT --reload