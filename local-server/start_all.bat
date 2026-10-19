@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if not defined LLAMA_SERVER_EXE for /f "delims=" %%I in ('where llama-server.exe 2^>nul') do if not defined LLAMA_SERVER_EXE set "LLAMA_SERVER_EXE=%%I"
if not defined LLAMA_SERVER_EXE (
  echo ERROR: llama-server.exe was not found in PATH.
  echo Set LLAMA_SERVER_EXE to the full path before running this script.
  echo Example: set LLAMA_SERVER_EXE=C:\AI\llama-vulkan\llama-server.exe
  pause
  exit /b 1
)
if not exist "%LLAMA_SERVER_EXE%" (
  echo ERROR: llama-server.exe was not found: %LLAMA_SERVER_EXE%
  pause
  exit /b 1
)
echo ================================================
echo JP Live Meeting Translator 0.9.4 - FAST profile
echo Interviewee-only local PLaMo stack
echo ================================================

rem Check whether port 8766 is free, or already has our Q3_K_M speed profile.
powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if(-not $c){exit 1}; $p=Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $c.OwningProcess); if($p.CommandLine -match 'Q3_K_M'){exit 0}; exit 2"
set "MODEL_STATE=%ERRORLEVEL%"
if "%MODEL_STATE%"=="2" goto :wrong_model
if "%MODEL_STATE%"=="1" (
  echo Starting PLaMo Q3_K_M FAST model on 127.0.0.1:8766...
  start "JP PLaMo FAST Q3_K_M" cmd /k ""%LLAMA_SERVER_EXE%" -hf mmnga/plamo-2-translate-gguf:Q3_K_M -ngl 99 --no-kv-offload --host 127.0.0.1 --port 8766 --ctx-size 2048 --n-predict 40 --alias plamo-fast-q3-km"
) else (
  echo PLaMo Q3_K_M FAST model is already running.
)

echo Waiting for PLaMo health to become ready...
set /a tries=0
:wait_plamo
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8766/health -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
if not errorlevel 1 goto :plamo_ready
set /a tries+=1
if %tries% GEQ 240 (
  echo ERROR: PLaMo did not become ready within 240 seconds.
  echo Check the JP PLaMo FAST model window for GPU-memory or download errors.
  pause
  exit /b 1
)
timeout /t 1 >nul
goto :wait_plamo

:plamo_ready
echo PLaMo FAST model is ready.
rem Check port 8785; reuse the bridge only if it is this version.
powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 8785 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if(-not $c){exit 1}; try{$v=Invoke-RestMethod http://127.0.0.1:8785/version -TimeoutSec 2; if($v.bridge -eq '0.9.4'){exit 0}}catch{}; exit 2"
set "BRIDGE_STATE=%ERRORLEVEL%"
if "%BRIDGE_STATE%"=="2" goto :wrong_bridge
if "%BRIDGE_STATE%"=="1" (
  echo Starting JP Live PLaMo bridge on 127.0.0.1:8785...
  start "JP PLaMo Bridge 0.9.4" cmd /k python "%~dp0bridge_server.py"
) else (
  echo JP Live PLaMo bridge 0.9.4 is already running.
)

echo Waiting for bridge health...
set /a btries=0
:wait_bridge
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8785/health -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
if not errorlevel 1 goto :ready
set /a btries+=1
if %btries% GEQ 20 (
  echo ERROR: bridge did not become ready. Check the bridge window.
  pause
  exit /b 1
)
timeout /t 1 >nul
goto :wait_bridge

:ready
echo.
echo ALL LOCAL SERVICES READY
echo PLaMo FAST: http://127.0.0.1:8766
echo Bridge:     http://127.0.0.1:8785
echo Model: Q3_K_M. First run may take several minutes to download.
echo Close other local AI model servers during speed testing to avoid GPU contention.
echo.
pause >nul
exit /b 0

:wrong_model
echo ERROR: another model is using port 8766.
echo Stop the old JP PLaMo Model window with Ctrl+C, wait for it to exit, then run start_all.bat again.
echo This version requires Q3_K_M to test the fast profile. Your Qwen server on port 8080 is separate.
pause
exit /b 1

:wrong_bridge
echo ERROR: an older bridge or another service is using port 8785.
echo Stop the old JP PLaMo Bridge window with Ctrl+C, then run start_all.bat again.
pause
exit /b 1
