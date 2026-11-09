Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Launching ClearMail Webmail on Port 7510    " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

docker compose -f docker-compose.clearmail.yml up --build -d

Write-Host ""
Write-Host ">>> ClearMail Webmail is LIVE at: http://localhost:7510/" -ForegroundColor Green
Write-Host ">>> To point a subdomain later (e.g. mail.yourdomain.com):" -ForegroundColor Yellow
Write-Host "    Proxy your subdomain directly to http://127.0.0.1:7510" -ForegroundColor Yellow
Write-Host ""

