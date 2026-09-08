Start-Sleep -Seconds 20
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8080/api/candidates?page=1&size=10" -UseBasicParsing -TimeoutSec 10
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Content: $($r.Content.Substring(0, 300))"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
