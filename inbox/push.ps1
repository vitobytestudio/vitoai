# inbox/push.ps1 — رفع الفيديو الخام إلى فرع المونتاج عبر git (ويندوز).
#   سقف 25 MB هو سقف صفحة الرفع على الإنترنت، لا سقف git؛ حدّ هذا الطريق 100 MB للملف.
# الاستعمال:
#   powershell -ExecutionPolicy Bypass -File .\push.ps1 -Path "C:\Users\you\Videos\a.mp4"
#   powershell -ExecutionPolicy Bypass -File .\push.ps1 -Path "C:\Users\you\Downloads\parts"   # مجلد الأجزاء
param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference = "Stop"
$REPO   = if ($env:VITO_INBOX_REPO)   { $env:VITO_INBOX_REPO }   else { "https://github.com/vitobytestudio/vitoai.git" }
$BRANCH = if ($env:VITO_INBOX_BRANCH) { $env:VITO_INBOX_BRANCH } else { "arena/c36750ba-vitoai" }
$MAX    = 100MB

if (-not (Test-Path -LiteralPath $Path)) { Write-Error "لا يوجد مسار: $Path"; exit 2 }
if (Test-Path -LiteralPath $Path -PathType Container) {
  $files = Get-ChildItem -LiteralPath $Path -File | Sort-Object Name
  if ($files.Count -eq 0) { Write-Error "المجلد فارغ: $Path"; exit 2 }
} else { $files = @(Get-Item -LiteralPath $Path) }

$total = 0
foreach ($f in $files) {
  if ($f.Length -gt $MAX) {
    Write-Host ("✗ {0} حجمه {1} MB — فوق سقف GitHub لكل ملف (100 MB)." -f $f.Name, [math]::Round($f.Length/1MB,1)) -ForegroundColor Red
    Write-Host "  قطّعه بـ inbox/split.html ثم مرّر مجلد الأجزاء إلى هذا السكربت، أو أرسله في المحادثة."
    exit 3
  }
  $total += $f.Length
}
Write-Host ("→ {0} ملف · {1:N1} ميغابايت إجمالاً" -f $files.Count, ($total/1MB))

$tmp = Join-Path $env:TEMP ("vitoai-inbox-" + [guid]::NewGuid().ToString("N").Substring(0,8))
try {
  Write-Host "→ نسخ خفيف للفرع — بلا تنزيل وسائط المستودع"
  git clone -q --filter=blob:none --no-checkout --single-branch -b $BRANCH $REPO $tmp
  if ($LASTEXITCODE -ne 0) { throw "تعذّر النسخ — سجّل الدخول على GitHub أولاً (git clone $REPO)." }
  Push-Location $tmp
  git config user.name  "vitoai-inbox" | Out-Null
  git config user.email "inbox@vitoai.local" | Out-Null
  # sparse-checkout: الفهرس يحمل الشجرة كاملة، فعملنا إضافةٌ لا استبدالُ مشروع.
  git sparse-checkout set --no-cone "/inbox" | Out-Null
  git checkout -q $BRANCH
  $before = (git ls-tree -r HEAD --name-only | Measure-Object).Count
  # حارس الأساس: شجرة ناقصة تحت commit سليم تدمّر المشروع كله
  foreach ($a in @("package.json", "src/index.ts", "inbox/README.md")) {
    git cat-file -e ("HEAD:" + $a) 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "الأساس المنسوخ لا يحوي $a — الفرع تالف أو مقلّص؛ لن أضيف فوقه." }
  }

  New-Item -ItemType Directory -Force -Path inbox | Out-Null
  $msg = ""
  foreach ($f in $files) {
    Copy-Item -LiteralPath $f.FullName -Destination (Join-Path "inbox" $f.Name)
    git add -f ("inbox/" + $f.Name) | Out-Null
    $h = (Get-FileHash -Algorithm SHA256 -LiteralPath $f.FullName).Hash.ToLower().Substring(0,16)
    Write-Host ("   + {0,-40} {1,11} bytes  sha256 {2}…" -f $f.Name, $f.Length, $h)
    $msg += "  {0}  {1}  sha256 {2}{3}" -f $f.Name, $f.Length, $h, [Environment]::NewLine
  }
  git commit -q -m ("inbox: raw footage for the cut — {0} ملف، {1} بايت{2}{3}" -f $files.Count, $total, [Environment]::NewLine, $msg) | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "git commit فشل" }

  # حرّاس: إضافة فقط، لا حذف ولا تعديل.
  $st = git diff --name-status HEAD~1 HEAD
  $notadd = @($st | Where-Object { $_ -and ($_ -split "\t")[0] -ne "A" }).Count
  $added  = @($st | Where-Object { $_ -and ($_ -split "\t")[0] -eq "A" }).Count
  $after  = (git ls-tree -r HEAD --name-only | Measure-Object).Count
  if ($notadd -ne 0) { throw "الـ commit يحوي حذف/تعديل ($notadd) — لم أدفعه. أرسل لي هذه الرسالة." }
  if ($after -ne ($before + $added)) { throw "عدد المسارات بعد الرفع ($after) ≠ $before + $added — لم أدفعه." }
  Write-Host "   ✓ حرّاس: $before → $after مسارات، $added إضافة، صفر حذف"

  git push -q origin ("HEAD:" + $BRANCH)
  if ($LASTEXITCODE -ne 0) { throw "فشل الدفع — قد يطلب GitHub اسم مستخدم + Personal Access Token." }
  Pop-Location
  Write-Host "✓ وصل إلى $BRANCH/inbox/ — اكتب «تم» في المحادثة." -ForegroundColor Green
} finally {
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
}
