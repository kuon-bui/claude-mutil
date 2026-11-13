#Requires -Version 7
# Task 1 Step 3 (processEnv): mở VS Code với CLAUDE_CONFIG_DIR trỏ vào hồ sơ spike.
# Phải đóng HẾT cửa sổ VS Code trước, nếu không lệnh `code` chỉ chuyển sang tiến trình cũ và biến môi trường bị bỏ qua.
# Chạy từ Windows Terminal (không phải terminal trong VS Code): pwsh -File spike\2-open-vscode-processEnv.ps1 [thư mục dự án]
if (Get-Process Code -ErrorAction SilentlyContinue) {
  Write-Host 'VS Code vẫn đang chạy. Đóng hết cửa sổ VS Code rồi chạy lại.'
  exit 1
}
$env:CLAUDE_CONFIG_DIR = Join-Path $HOME '.claude-profiles\spike'
Write-Host "Mở VS Code với CLAUDE_CONFIG_DIR = $env:CLAUDE_CONFIG_DIR"
code @args
