#Requires -Version 7
# Kiểm tra liên kết của hồ sơ spike còn sống không. Chạy lại sau khi đổi thiết lập từ tài khoản thứ hai (Step 7b).
$def  = Join-Path $HOME '.claude'
$prof = Join-Path $HOME '.claude-profiles\spike'

$p = Get-Item -LiteralPath (Join-Path $prof 'projects') -Force -ErrorAction SilentlyContinue
Write-Host ("projects      : " + ($(if ($p) { "LinkType='$($p.LinkType)' Target='$($p.Target)'" } else { 'không có' })))

$a = Get-Item -LiteralPath (Join-Path $prof 'settings.json') -Force -ErrorAction SilentlyContinue
$b = Get-Item -LiteralPath (Join-Path $def 'settings.json') -Force -ErrorAction SilentlyContinue
if ($a -and $b) {
  $same = (Get-FileHash -LiteralPath $a.FullName).Hash -eq (Get-FileHash -LiteralPath $b.FullName).Hash
  Write-Host "settings.json : LinkType='$($a.LinkType)' nội dung giống ~/.claude: $same"
  Write-Host "                sửa lần cuối (hồ sơ / mặc định): $($a.LastWriteTime) / $($b.LastWriteTime)"
  if (-not $a.LinkType -or -not $same) { Write-Host '  => LIÊN KẾT ĐÃ GÃY: Claude Code đã ghi đè settings.json bằng file thường.' -ForegroundColor Red }
} else {
  Write-Host 'settings.json : thiếu ở hồ sơ hoặc ở ~/.claude'
}
