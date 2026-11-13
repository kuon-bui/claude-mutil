#Requires -Version 7
# Task 1 Step 7 (+ Step 7b bổ sung): nối projects/ và settings.json của hồ sơ spike về ~/.claude.
# Không xoá gì: mục cũ của hồ sơ (nếu có và không phải liên kết) được đổi tên thành *.spike-bak.
$ErrorActionPreference = 'Stop'
$def  = Join-Path $HOME '.claude'
$prof = Join-Path $HOME '.claude-profiles\spike'
if (-not (Test-Path $prof)) { Write-Host "Chưa có $prof. Chạy 1-login.ps1 trước."; exit 1 }

function Move-Aside([string]$path) {
  $bak = "$path.spike-bak"
  if (Test-Path $bak) { throw "$bak đã tồn tại; xử lý bằng tay trước." }
  Move-Item -LiteralPath $path -Destination $bak
  Write-Host "Đã đổi tên mục cũ thành $bak"
}

# projects/ -> junction
$link = Join-Path $prof 'projects'
$item = Get-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue
if ($item -and $item.LinkType) {
  Write-Host "projects đã là $($item.LinkType) -> $($item.Target)"
} else {
  if ($item) { Move-Aside $link }
  New-Item -ItemType Junction -Path $link -Target (Join-Path $def 'projects') | Out-Null
  Write-Host 'Đã tạo junction projects -> ~/.claude/projects'
}

# settings.json -> symlink, nếu không được thì hard link
$target = Join-Path $def 'settings.json'
$slink  = Join-Path $prof 'settings.json'
if (-not (Test-Path $target)) {
  Write-Host 'Không có ~/.claude/settings.json; bỏ qua bước settings.'
  exit 0
}
$item = Get-Item -LiteralPath $slink -Force -ErrorAction SilentlyContinue
if ($item -and $item.LinkType) {
  Write-Host "settings.json đã là $($item.LinkType)"
} else {
  if ($item) { Move-Aside $slink }
  try {
    New-Item -ItemType SymbolicLink -Path $slink -Target $target | Out-Null
    Write-Host 'Đã tạo symlink settings.json'
  } catch {
    Write-Host "Không tạo được symlink ($($_.Exception.Message.Trim())); dùng hard link."
    New-Item -ItemType HardLink -Path $slink -Target $target | Out-Null
    Write-Host 'Đã tạo hard link settings.json'
  }
}
& (Join-Path $PSScriptRoot '6-check-links.ps1')
