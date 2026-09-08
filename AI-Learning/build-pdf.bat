@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo  AI Learning PDF 生成器
echo  将本目录所有 .md 课程合并为一个 PDF
echo ==========================================
echo.
node build-pdf.js
echo.
if %errorlevel%==0 (
  echo 生成完成！PDF 位于本目录下。
) else (
  echo 生成失败，请检查上面的错误信息。
)
echo.
pause
