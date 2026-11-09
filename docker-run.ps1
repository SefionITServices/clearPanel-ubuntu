Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Building & Starting ClearPanel (Port 7510) " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

docker compose up --build -d

Write-Host ""
Write-Host ">>> ClearPanel Admin Dashboard: http://localhost:7510/" -ForegroundColor Green
Write-Host ">>> ClearMail Business Webmail: http://localhost:7510/clearmail/" -ForegroundColor Green
Write-Host ">>> API Status:                 http://localhost:7510/api/mail/status" -ForegroundColor Green
Write-Host ""

