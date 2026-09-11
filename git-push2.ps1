Set-Location "D:\acme\AI-project"
$log = "D:\acme\AI-project\git-log.txt"
& "C:\Program Files\Git\cmd\git.exe" add -A 2>&1 | Out-File $log
"=== ADD DONE ===" | Out-File $log -Append
& "C:\Program Files\Git\cmd\git.exe" status --short 2>&1 | Out-File $log -Append
"=== STATUS DONE ===" | Out-File $log -Append
& "C:\Program Files\Git\cmd\git.exe" commit -m "feat: fix section numbering, enhance concept explanations, add Mermaid diagrams and tables" 2>&1 | Out-File $log -Append
"=== COMMIT DONE ===" | Out-File $log -Append
& "C:\Program Files\Git\cmd\git.exe" push origin main 2>&1 | Out-File $log -Append
"=== PUSH DONE ===" | Out-File $log -Append
