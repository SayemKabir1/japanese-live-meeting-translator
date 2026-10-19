@echo off
setlocal
rem Stop only this project's bridge and PLaMo instance. Do not kill unrelated llama-server processes.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$procs=Get-CimInstance Win32_Process; $procs | Where-Object { $_.CommandLine -and $_.CommandLine -match 'bridge_server.py' -and $_.CommandLine -match 'JP-Live-Meeting-Translator' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; $procs | Where-Object { $_.CommandLine -and $_.CommandLine -match 'plamo-2-translate-gguf' -and $_.CommandLine -match '--port 8766' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo JP Live Meeting Translator services stopped if they were running.
pause
