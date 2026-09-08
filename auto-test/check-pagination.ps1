try {
    $r = Invoke-WebRequest -Uri "http://localhost:8080/api/candidates?page=1&size=10" -UseBasicParsing -TimeoutSec 10
    Write-Host "Status: $($r.StatusCode)"
    $json = $r.Content | ConvertFrom-Json
    Write-Host "Total: $($json.data.total)"
    Write-Host "Pages: $($json.data.pages)"
    Write-Host "Current: $($json.data.current)"
    Write-Host "Size: $($json.data.size)"
    Write-Host "Records count: $($json.data.records.Count)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response: $($sr.ReadToEnd())"
    }
}
