Set-Location "D:\acme\AI-project"
& "C:\Program Files\Git\cmd\git.exe" add -A
$status = & "C:\Program Files\Git\cmd\git.exe" status --short
Write-Host "=== GIT STATUS ==="
Write-Host $status
& "C:\Program Files\Git\cmd\git.exe" commit -m "feat: fix section numbering, enhance concept explanations, add Mermaid diagrams and tables"
& "C:\Program Files\Git\cmd\git.exe" push origin main
Write-Host "=== DONE ==="
