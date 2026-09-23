@echo off
REM Nightly entry point for the overnight orchestrator.
REM
REM Registered with Windows Task Scheduler as "RedAnvil Overnight". Kept as a
REM .cmd rather than a raw schtasks command line because the task needs PATH
REM entries the scheduler's environment does not have: the scheduler starts with
REM a minimal profile, so `claude` and `grok` are simply not found and every item
REM silently reports "no headless agent could run".
REM
REM The checkpoint exists so a crash, reboot or usage window mid-night resumes
REM where it stopped -- not so that tonight skips work because last night
REM finished it. Per-night rollover lives in overnight.mjs: a checkpoint whose
REM night (the local calendar date of that run's deadline) is not tonight is
REM archived there, and a crash later the same night still resumes. Do not
REM archive from this script. The old wmic block never ran on this machine
REM (wmic is gone), %STAMP% expanded before it was set, and the move error
REM was hidden.

setlocal

set "REDANVIL_REPO=C:\Users\brian\RedAnvil"
REM git is on this list because a pre-flight check caught it MISSING. The loop
REM calls `git rev-parse HEAD` for every receipt and `git worktree add` for every
REM item, so without it no worktree is created, commitBefore/commitAfter come
REM back null, diffChanged is false, and no item can ever reach VERIFIED. It
REM would have failed quietly all night and looked like the agent doing nothing.
set "PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.grok\bin;C:\Program Files\Git\cmd;C:\Program Files\nodejs;C:\Program Files\GitHub CLI;%PATH%"

cd /d "%REDANVIL_REPO%" || exit /b 1

if not exist ".redanvil\overnight" mkdir ".redanvil\overnight"

if not exist "logs" mkdir "logs"

node "n8n-prototype\loki\overnight.mjs" --allow-deploy >> "logs\overnight.log" 2>&1
set "EXITCODE=%ERRORLEVEL%"

REM endlocal resets ERRORLEVEL. A zero-receipt night exits non-zero from
REM overnight.mjs; without this, the scheduled task would still look green.
endlocal & exit /b %EXITCODE%
