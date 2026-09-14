$ErrorActionPreference = 'Continue'
$dir = "D:\acme\AI-project\AI-Learning"
$log = Join-Path $dir "pdf-build.log"
Set-Location $dir
Remove-Item $log -ErrorAction SilentlyContinue

"=== Build+Upload Start: $(Get-Date) ===" | Out-File $log -Encoding utf8

# 1. Locate latest AI*.pdf (ASCII wildcard only - CJK literals break in PS5.1 without BOM)
$pdf = Get-ChildItem -Path $dir -Filter "AI*.pdf" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($pdf -and ((Get-Date) - $pdf.LastWriteTime).TotalHours -lt 1) {
    "PDF FRESH: $($pdf.Name) $([math]::Round($pdf.Length/1MB,2)) MB (skip rebuild)" | Out-File $log -Append -Encoding utf8
} else {
    "PDF missing or stale - rebuilding..." | Out-File $log -Append -Encoding utf8
    $node = "D:\Program Files\nodejs\node.exe"
    if (-not (Test-Path $node)) { $node = "node" }
    & $node "build-pdf.js" 2>&1 | Out-File $log -Append -Encoding utf8
    "NODE EXIT: $LASTEXITCODE" | Out-File $log -Append -Encoding utf8
    $pdf = Get-ChildItem -Path $dir -Filter "AI*.pdf" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

if (-not $pdf) {
    "PDF STILL MISSING - abort git steps" | Out-File $log -Append -Encoding utf8
    exit 1
}
"PDF TARGET: $($pdf.Name) size=$($pdf.Length) bytes" | Out-File $log -Append -Encoding utf8

# 2. Git commit & push (silent, no popup)
$git = "C:\Program Files\Git\cmd\git.exe"
& $git -C "D:\acme\AI-project" add -A 2>&1 | Out-File $log -Append -Encoding utf8
& $git -C "D:\acme\AI-project" status --short 2>&1 | Out-File $log -Append -Encoding utf8
& $git -C "D:\acme\AI-project" commit -m "docs: regenerate course PDF from latest chapters, remove old roadmap PDF" 2>&1 | Out-File $log -Append -Encoding utf8
"COMMIT EXIT: $LASTEXITCODE" | Out-File $log -Append -Encoding utf8
& $git -C "D:\acme\AI-project" push origin main 2>&1 | Out-File $log -Append -Encoding utf8
"PUSH EXIT: $LASTEXITCODE" | Out-File $log -Append -Encoding utf8

"=== ALL DONE: $(Get-Date) ===" | Out-File $log -Append -Encoding utf8
