@echo off
rem Task 1 Step 4 (wrapper): ghi toàn bộ tham số nhận được ra wrapper-log.txt cạnh file này,
rem đặt CLAUDE_CONFIG_DIR vào hồ sơ spike rồi chạy tiếp đúng các tham số đó.
rem Không in gì ra stdout: Claude Code nói chuyện với tiến trình qua stdin/stdout.
set "CLAUDE_CONFIG_DIR=%USERPROFILE%\.claude-profiles\spike"
>>"%~dp0wrapper-log.txt" echo [%date% %time%] %*
%*
exit /b %errorlevel%
