@echo off
setlocal
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
echo JP Live Translator QUALITY model: PLaMo Q4_K_S (~5.51 GB)
echo Stop any other model using port 8766 before starting.
echo Endpoint: http://127.0.0.1:8766
"%LLAMA_SERVER_EXE%" -hf mmnga/plamo-2-translate-gguf:Q4_K_S --no-kv-offload --host 127.0.0.1 --port 8766 --ctx-size 2048 --n-predict 48 --alias plamo-quality-q4-ks
