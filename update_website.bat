@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo       Makron Static Site Generator
echo ==========================================

:: 1: Core Page Generation
echo (1/7) Running generate.py...
python generate.py
if %errorlevel% neq 0 goto :error

:: 2: Core Post Generation
echo (2/7) Running generate.py...
python generate_posts.py
if %errorlevel% neq 0 goto :error

:: 3: URL List
echo (3/7) Running generate_links.py...
python generate_links.txt_script.py
if %errorlevel% neq 0 goto :error

:: 4: LLMS context
echo (4/7) Running generate_llms.py...
python generate_llms.txt_script.py
if %errorlevel% neq 0 goto :error

:: 5: Robots.txt
echo (5/7) Running generate_robots.py...
python generate_robots.txt_script.py
if %errorlevel% neq 0 goto :error

:: 6: RSS Feed
echo (6/7) Running generate_rss.py...
python generate_rss.xml_script.py
if %errorlevel% neq 0 goto :error

:: 7: Sitemap
echo (7/7) Running generate_sitemap.py...
python generate_sitemap.xml_script.py
if %errorlevel% neq 0 goto :error

echo.
echo ==========================================
echo    SUCCESS: All tasks completed!
echo ==========================================
pause
exit /b

:error
echo.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo    ERROR: Script failed at step %~1
echo    Process halted. Check logs above.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
pause
exit /b 1