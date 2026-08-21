@echo off
REM Nightly entry point for the overnight orchestrator.
REM
REM Registered with Windows Task Scheduler as "RedAnvil Overnight". Kept as a
REM .cmd rather than a raw schtasks command line because the task needs PATH
REM entries the scheduler's environment does not have: the scheduler starts with
REM a minimal profile, so `claude` and `grok` are simply not found and every item
REM silently reports "no headless agent could run".
REM
REM The checkpoint is cleared at the START of each night on purpose. It exists so
REM a crash, reboot or usage window mid-night resumes where it stopped -- not so
REM that tonight skips work because last night finished it.

setlocal

set "REDANVIL_REPO=C:\Users\brian\RedAnvil"
set "PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.grok\bin;C:\Program Files\GitHub CLI;%PATH%"

cd /d "%REDANVIL_REPO%" || exit /b 1

if not exist ".redanvil\overnight" mkdir ".redanvil\overnight"

REM Archive last night's checkpoint rather than deleting it, so a morning
REM question about what ran has an answer.
if exist ".redanvil\overnight\checkpoint.json" (
  for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul ^| find "="') do set "STAMP=%%I"
  move /y ".redanvil\overnight\checkpoint.json" ".redanvil\overnight\checkpoint-%STAMP:~0,8%-%STAMP:~8,6%.json" >nul 2>&1
)

if not exist "logs" mkdir "logs"

node "n8n-prototype\loki\overnight.mjs" --allow-deploy >> "logs\overnight.log" 2>&1

endlocal
