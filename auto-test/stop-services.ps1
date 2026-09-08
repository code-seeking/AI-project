# Stop backend (8080)
$conn8080 = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn8080) {
    Stop-Process -Id $conn8080.OwningProcess -Force
    Write-Host "Stopped backend PID: $($conn8080.OwningProcess)"
} else {
    Write-Host "Backend not running"
}

# Stop frontend (5173)
$conn5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn5173) {
    Stop-Process -Id $conn5173.OwningProcess -Force
    Write-Host "Stopped frontend PID: $($conn5173.OwningProcess)"
} else {
    Write-Host "Frontend not running"
}
