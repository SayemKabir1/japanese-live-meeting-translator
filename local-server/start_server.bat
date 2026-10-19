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
echo JP Live Translator FAST model: PLaMo Q3_K_M (~4.64 GB)
echo GPU offload: maximum available layers; KV cache remains on CPU for Vulkan compatibility.
echo Endpoint: http://127.0.0.1:8766
echo First use downloads the Q3_K_M model once.
"%LLAMA_SERVER_EXE%" -hf mmnga/plamo-2-translate-gguf:Q3_K_M -ngl 99 --no-kv-offload --host 127.0.0.1 --port 8766 --ctx-size 2048 --n-predict 40 --alias plamo-fast-q3-km
