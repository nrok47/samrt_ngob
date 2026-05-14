@echo off
chcp 65001 >nul
title GFMIS NFMA46 Auto-Downloader
echo.
echo  ═══════════════════════════════════════
echo   GFMIS NFMA46 — ดึงรายงานอัตโนมัติ
echo  ═══════════════════════════════════════
echo.

C:\Python314\python.exe "%~dp0gfmis_scraper.py"

if errorlevel 1 (
    echo.
    echo  เกิดข้อผิดพลาด — กด Enter เพื่อปิด
    pause >nul
)
