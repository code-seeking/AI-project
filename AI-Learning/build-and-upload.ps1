$ErrorActionPreference = 'Continue'
$dir = "D:\acme\AI-project\AI-Learning"
$log = "D:\acme\pdf-build.log"
Set-Location $dir
Remove-Item $log -ErrorAction SilentlyContinue

"=== Build+Upload Start: $(Get-Date) ===" | Out-File $log -Encoding utf8

# ---------- 1. Always rebuild (MD content / builder may have changed) ----------
$node = "D:\Program Files\nodejs\node.exe"
if (-not (Test-Path $node)) { $node = "node" }
& $node --version 2>&1 | Out-File $log -Append -Encoding utf8

$before = Get-Date
& $node "build-pdf.js" 2>&1 | Out-File $log -Append -Encoding utf8
$nodeExit = $LASTEXITCODE
"NODE EXIT: $nodeExit" | Out-File $log -Append -Encoding utf8

# ---------- 2. Verify the PDF is real AND freshly written by this run ----------
$pdf = Get-ChildItem -Path $dir -Filter "AI*.pdf" -ErrorAction SilentlyContinue |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1

$fresh = $false
if ($pdf) {
    "PDF TARGET: $($pdf.Name) size=$($pdf.Length) bytes mtime=$($pdf.LastWriteTime)" | Out-File $log -Append -Encoding utf8
    if ($nodeExit -eq 0 -and $pdf.LastWriteTime -gt $before -and $pdf.Length -gt 500000) { $fresh = $true }
}

if (-not $fresh) {
    "ABORT: PDF not freshly built (nodeExit=$nodeExit) - nothing committed" | Out-File $log -Append -Encoding utf8
    exit 1
}

# ---------- 3. Git commit & push (silent, no popup) ----------
$git = "C:\Program Files\Git\cmd\git.exe"
& $git -C "D:\acme\AI-project" add -A 2>&1 | Out-File $log -Append -Encoding utf8
"--- staged ---" | Out-File $log -Append -Encoding utf8
& $git -C "D:\acme\AI-project" status --short 2>&1 | Out-File $log -Append -Encoding utf8
& $git -C "D:\acme\AI-project" commit -m "fix(pdf): embed architecture diagrams as base64 and render mermaid flowcharts" 2>&1 | Out-File $log -Append -Encoding utf8
"COMMIT EXIT: $LASTEXITCODE" | Out-File $log -Append -Encoding utf8
& $git -C "D:\acme\AI-project" push origin main 2>&1 | Out-File $log -Append -Encoding utf8
"PUSH EXIT: $LASTEXITCODE" | Out-File $log -Append -Encoding utf8

"=== ALL DONE: $(Get-Date) ===" | Out-File $log -Append -Encoding utf8
