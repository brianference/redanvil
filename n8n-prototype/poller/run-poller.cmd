@echo off
REM Poller entry point for Windows Task Scheduler.
REM
REM The scheduler starts with a minimal PATH (node is not on it) and a working
REM directory of System32. This script puts the same tools on PATH that
REM loki\run-overnight.cmd does, then cds to the repo that contains it.
REM The repo is derived from this file's location so a worktree and the main
REM checkout both run. Do not register the scheduled task from here.

setlocal

set "PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.grok\bin;C:\Program Files\Git\cmd;C:\Program Files\nodejs;C:\Program Files\GitHub CLI;%PATH%"

set "HERE=%~dp0"
cd /d "%HERE%..\.." || exit /b 1

if not exist "logs" mkdir "logs"
if not exist ".redanvil\dispatch" mkdir ".redanvil\dispatch"

REM %* is how Task Scheduler passes --once. The token stays in the environment;
REM it is not placed on this command line.
node "n8n-prototype\poller\job-poller.mjs" %* >> "logs\poller.log" 2>&1
set "EXITCODE=%ERRORLEVEL%"

REM endlocal resets ERRORLEVEL. A missing token exits non-zero from the poller;
REM without this, the scheduled task would still look green.
endlocal & exit /b %EXITCODE%
