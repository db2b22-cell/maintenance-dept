@echo off
REM สคริปต์สำหรับรันบน Windows
REM ดาวน์โหลดไฟล์จาก OneDrive มาเก็บที่เครื่อง และลบออกจาก OneDrive

echo ========================================
echo   OneDrive to Obsidian Sync
echo ========================================
echo.

REM ตรวจสอบว่ามี Python หรือไม่
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python ไม่ได้ติดตั้ง
    echo กรุณาติดตั้ง Python จาก https://www.python.org/downloads/
    pause
    exit /b 1
)

REM ตรวจสอบว่ามี requests library หรือไม่
python -c "import requests" >nul 2>&1
if errorlevel 1 (
    echo กำลังติดตั้ง requests library...
    pip install requests
)

REM รันสคริปต์
python sync_onedrive_to_obsidian.py

echo.
pause
