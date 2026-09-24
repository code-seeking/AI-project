$ErrorActionPreference = 'Continue'
# Self-heal: some launchers (e.g. embedded tool hosts) inherit a broken PATHEXT like ".CPL",
# which makes PowerShell treat every .exe as a "document" (CantActivateDocumentInPipeline)
# and kills all & node.exe / & git.exe calls below. Restore the standard value first.
$env:PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.JS;.WSF;.MSC;.CPL'
$dir  = "D:\acme\AI-project\AI-Learning"
$log  = "D:\acme\pdf-build.log"
$done = "D:\acme\pdf-run.done"
$gate = "D:\acme\pdf-gate.txt"
$runId = (Get-Date).ToString("yyyyMMdd-HHmmss")

$script:Result = "UNKNOWN"
try {
  # Make PowerShell decode child (node/git) UTF-8 stdout correctly instead of GBK-mangling it
  try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

  # Clean previous artifacts FIRST, so nobody mistakes a stale log for a fresh result
  Remove-Item $log, $done, $gate -ErrorAction SilentlyContinue
  Remove-Item "D:\acme\pdf-diag.json", "D:\acme\pdf-inspect-before.json", "D:\acme\pdf-inspect-after.json" -ErrorAction SilentlyContinue
  Remove-Item "D:\acme\md-heading-report.json", "D:\acme\md-heading-verify.json" -ErrorAction SilentlyContinue
  Remove-Item "D:\acme\pdf-img-dump" -Recurse -Force -ErrorAction SilentlyContinue
  # ~pdf-preview.html = intermediate HTML with inlined base64 images (20-40 MB).
  # A crashed previous run leaves it on disk; without this it would be committed by git add -A.
  Remove-Item (Join-Path $dir "~pdf-preview.html") -Force -ErrorAction SilentlyContinue

  $node = "D:\Program Files\nodejs\node.exe"
  if (-not (Test-Path $node)) { $node = "node" }

  # NEVER rely on the caller's CWD (launching from Win+R lands in C:\WINDOWS\system32)
  Set-Location $dir
  $builder = Join-Path $dir "build-pdf.js"
  $fixer   = Join-Path $dir "fix-heading-numbers.js"
  if (-not (Test-Path $builder)) {
    "ABORT: builder not found at $builder" | Out-File $log -Encoding utf8
    Set-Content $gate "RESULT=FAIL_BUILDER_MISSING" -Encoding ascii
    $script:Result = "FAIL_BUILDER_MISSING"
    exit 1
  }

  "=== Build+Upload Start: $(Get-Date) runId=$runId cwd=$((Get-Location).Path) ===" | Out-File $log -Encoding utf8
  Set-Content $gate "RUN_ID=$runId" -Encoding ascii
  & $node --version 2>&1 | Out-File $log -Append -Encoding utf8

  # ---------- -1. Renumber MD headings: 中文序号 -> 阿拉伯数字（apply 后紧接 verify） ----------
  if (Test-Path $fixer) {
    & $node $fixer --apply --verify 2>&1 | Out-File $log -Append -Encoding utf8
    $fixExit = $LASTEXITCODE
    "HEADINGS EXIT: $fixExit" | Out-File $log -Append -Encoding utf8
    Add-Content $gate "HEADINGS_EXIT=$fixExit"
    if ($fixExit -ne 0) {
      "ABORT: headings still have leftover Chinese numbers or duplicates - not building PDF" |
        Out-File $log -Append -Encoding utf8
      Add-Content $gate "RESULT=FAIL_HEADINGS"
      $script:Result = "FAIL_HEADINGS"
      exit 4
    }
  } else {
    "WARN: fixer not found, skipping heading renumber" | Out-File $log -Append -Encoding utf8
  }

  # ---------- 0. Forensics on the PDF currently on disk (i.e. what GitHub serves today) ----------
  $old = Get-ChildItem -Path $dir -Filter "AI*.pdf" -ErrorAction SilentlyContinue |
         Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($old) {
    "BEFORE: $($old.Name) size=$($old.Length) mtime=$($old.LastWriteTime)" | Out-File $log -Append -Encoding utf8
    & $node $builder inspect $old.FullName "D:\acme\pdf-img-dump\before" "D:\acme\pdf-inspect-before.json" 2>&1 |
      Out-File $log -Append -Encoding utf8
    "INSPECT-BEFORE EXIT: $LASTEXITCODE" | Out-File $log -Append -Encoding utf8
    if (Test-Path "D:\acme\pdf-inspect-before.json") {
      $jb = Get-Content "D:\acme\pdf-inspect-before.json" -Raw -Encoding UTF8 | ConvertFrom-Json
      "BEFORE_MB=$($jb.pdfMB) BEFORE_PAGES=$($jb.pages) BEFORE_IMGS=$($jb.imageXObjects) BEFORE_BIG=$($jb.bigImages)" |
        Out-File $gate -Append -Encoding ascii
    } else { "BEFORE_IMGS=missing-report" | Out-File $gate -Append -Encoding ascii }
  } else {
    "BEFORE: no pdf found" | Out-File $log -Append -Encoding utf8
    "BEFORE_IMGS=no-pdf" | Out-File $gate -Append -Encoding ascii
  }

  # ---------- 1. Offline mermaid vendor (bounded, never blocks the build) ----------
  $vendor = "D:\acme\pdf-gen\node_modules\mermaid\dist\mermaid.min.js"
  if (Test-Path $vendor) {
    "MERMAID VENDOR CACHED" | Out-File $log -Append -Encoding utf8
  } else {
    "installing mermaid (max 180s, non-fatal) ..." | Out-File $log -Append -Encoding utf8
    $job = Start-Job -ScriptBlock {
      Set-Location "D:\acme\pdf-gen"
      $npm = "D:\Program Files\nodejs\npm.cmd"
      if (-not (Test-Path $npm)) { $npm = "npm" }
      & $npm install mermaid@10 --no-audit --no-fund --loglevel=error 2>&1
    }
    $null = Wait-Job $job -Timeout 180
    Receive-Job $job | Out-File $log -Append -Encoding utf8
    Remove-Job $job -Force
  }
  "MERMAID VENDOR PRESENT: $(Test-Path $vendor)" | Out-File $log -Append -Encoding utf8

  # ---------- 2. Rebuild PDF (build-pdf.js also writes D:\acme\pdf-diag.json in UTF-8) ----------
  $buildStart = Get-Date
  & $node $builder 2>&1 | Out-File $log -Append -Encoding utf8
  $nodeExit = $LASTEXITCODE
  "NODE EXIT: $nodeExit" | Out-File $log -Append -Encoding utf8

  # ---------- 3. Freshness gate ----------
  $pdf = Get-ChildItem -Path $dir -Filter "AI*.pdf" -ErrorAction SilentlyContinue |
         Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $fresh = $false
  if ($pdf) {
    "PDF TARGET: $($pdf.Name) size=$($pdf.Length) mtime=$($pdf.LastWriteTime)" | Out-File $log -Append -Encoding utf8
    if ($nodeExit -eq 0 -and $pdf.LastWriteTime -gt $buildStart -and $pdf.Length -gt 500000) { $fresh = $true }
  }
  if (-not $fresh) {
    "ABORT: PDF not freshly built (nodeExit=$nodeExit)" | Out-File $log -Append -Encoding utf8
    Add-Content $gate "RESULT=FAIL_BUILD nodeExit=$nodeExit"
    $script:Result = "FAIL_BUILD"
    exit 1
  }

  # ---------- 4. Hard gate: diagrams must physically exist inside the new PDF ----------
  if (-not (Test-Path "D:\acme\pdf-inspect-after.json")) {
    "ABORT: no after-inspect report - cannot prove diagrams are inside the PDF" | Out-File $log -Append -Encoding utf8
    Add-Content $gate "RESULT=FAIL_NO_FORENSICS"
    $script:Result = "FAIL_NO_FORENSICS"
    exit 2
  }
  $ja = Get-Content "D:\acme\pdf-inspect-after.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $flow = "?"
  if (Test-Path "D:\acme\pdf-diag.json") {
    $jd = Get-Content "D:\acme\pdf-diag.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    $flow = $jd.flowchartsRendered
    Add-Content $gate "ARCH_ON_PAPER=$($jd.onPaperImages)/$($jd.architectureImages) JPEG_REENCODED=$($jd.jpegReencoded) FLOWCHARTS=$flow MERMAID_SRC=$($jd.mermaidSource) STATUS=$($jd.mermaidStatus)"
  }
  "VERIFY: pdf=$($ja.pdfMB)MB pages=$($ja.pages) imageXObjects=$($ja.imageXObjects) bigImages=$($ja.bigImages) exported=$($ja.exported.Count) flowcharts=$flow" |
    Out-File $log -Append -Encoding utf8
  Add-Content $gate "AFTER_MB=$($ja.pdfMB) AFTER_PAGES=$($ja.pages) AFTER_IMGS=$($ja.imageXObjects) AFTER_BIG=$($ja.bigImages) FLOW=$flow"
  if ($ja.bigImages -lt 8) {
    "ABORT: only $($ja.bigImages) big bitmaps inside the PDF, expected >= 8 architecture diagrams - NOT pushing" |
      Out-File $log -Append -Encoding utf8
    Add-Content $gate "RESULT=FAIL_IMAGES"
    $script:Result = "FAIL_IMAGES"
    exit 3
  }

  # ---------- 5. Commit & push only after the evidence passed ----------
  Remove-Item (Join-Path $dir "~pdf-preview.html") -Force -ErrorAction SilentlyContinue
  $git = "C:\Program Files\Git\cmd\git.exe"
  & $git -C "D:\acme\AI-project" add -A 2>&1 | Out-File $log -Append -Encoding utf8
  "--- staged ---" | Out-File $log -Append -Encoding utf8
  & $git -C "D:\acme\AI-project" status --short 2>&1 | Out-File $log -Append -Encoding utf8
  & $git -C "D:\acme\AI-project" commit -m "docs: renumber chapter headings to arabic numerals (7.5/7.6 insertion sections); fix(pdf): embed architecture diagrams as jpeg + render mermaid flowcharts offline + raise print timeout" 2>&1 |
    Out-File $log -Append -Encoding utf8
  $commitExit = $LASTEXITCODE
  "COMMIT EXIT: $commitExit" | Out-File $log -Append -Encoding utf8
  & $git -C "D:\acme\AI-project" push origin main 2>&1 | Out-File $log -Append -Encoding utf8
  $pushExit = $LASTEXITCODE
  "PUSH EXIT: $pushExit" | Out-File $log -Append -Encoding utf8
  Add-Content $gate "COMMIT_EXIT=$commitExit PUSH_EXIT=$pushExit"
  if ($pushExit -ne 0) {
    Add-Content $gate "RESULT=FAIL_PUSH"
    $script:Result = "FAIL_PUSH"
  } else {
    Add-Content $gate "RESULT=PASS"
    $script:Result = "PASS"
  }
  "=== ALL DONE: $(Get-Date) ===" | Out-File $log -Append -Encoding utf8
}
finally {
  Add-Content $gate "FINAL=$($script:Result) AT=$((Get-Date).ToString('o'))"
  Set-Content $done "$($script:Result) $(Get-Date -Format o)" -Encoding ascii
}
