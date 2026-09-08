$maxAttempts = 30
for ($i = 0; $i -lt $maxAttempts; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8080/api/candidates?page=0&size=1" -UseBasicParsing -TimeoutSec 3
        Write-Host "Backend OK at attempt $i"
        exit 0
    } catch {
        Write-Host "Waiting... $i"
    }
}
Write-Host "Backend failed to start after $maxAttempts attempts"
exit 1
