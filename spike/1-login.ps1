#Requires -Version 7
# Task 1 Step 2: tạo hồ sơ ~/.claude-profiles/spike và đăng nhập tài khoản thứ hai vào đó.
# Chạy: pwsh -File spike\1-login.ps1
# Script không đọc token: chỉ kiểm tra .credentials.json có tồn tại hay không, và chỉ in TÊN các khoá của .claude.json cùng email.
$ErrorActionPreference = 'Stop'
$profileDir = Join-Path $HOME '.claude-profiles\spike'
New-Item -ItemType Directory -Force $profileDir | Out-Null

$claude = (Get-Command claude -ErrorAction SilentlyContinue)?.Source
if (-not $claude) {
  $ext = Get-ChildItem (Join-Path $HOME '.vscode\extensions') -Directory -Filter 'anthropic.claude-code-*' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($ext) {
    $candidate = Join-Path $ext.FullName 'resources\native-binary\claude.exe'
    if (Test-Path $candidate) { $claude = $candidate }
  }
}
if (-not $claude) { Write-Host 'Không tìm thấy claude. Ghi "no-cli" vào docs/spike-results.md.'; exit 1 }
Write-Host "Dùng: $claude"
Write-Host "CLAUDE_CONFIG_DIR = $profileDir"
$env:CLAUDE_CONFIG_DIR = $profileDir

& $claude auth login
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host "'claude auth login' không chạy được (mã thoát $LASTEXITCODE)."
  Write-Host 'Mở phiên tương tác: gõ /login, đăng nhập tài khoản thứ hai, rồi /exit.'
  & $claude
}

Write-Host ''
Write-Host "Có .credentials.json trong hồ sơ: $(Test-Path (Join-Path $profileDir '.credentials.json'))"
$json = Join-Path $profileDir '.claude.json'
if (Test-Path $json) {
  $data = Get-Content $json -Raw | ConvertFrom-Json
  Write-Host "oauthAccount.emailAddress = $($data.oauthAccount.emailAddress)"
  Write-Host 'Tên các khoá cấp cao trong .claude.json (tìm trường email nếu dòng trên trống):'
  $data.PSObject.Properties.Name | Sort-Object | ForEach-Object { "  $_" }
  if ($data.oauthAccount) {
    Write-Host 'Tên các khoá trong oauthAccount:'
    $data.oauthAccount.PSObject.Properties.Name | Sort-Object | ForEach-Object { "  $_" }
  }
} else {
  Write-Host "Chưa thấy $json"
}
