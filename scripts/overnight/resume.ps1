<#
.SYNOPSIS
  Relaunch the unattended RedAnvil night session after a Claude Code session ends.

.DESCRIPTION
  The night's real work runs OUTSIDE the Claude session -- n8n executes the build
  server-side and Grok runs as its own process -- but the orchestration does not.
  When a session hits a token or hourly limit it simply stops, and nothing picks
  the thread back up. This script is the thing that picks it back up.

  It is deliberately dumb and idempotent:
    * refuses to start if the night is already marked complete
    * refuses to start if a previous resume is still running (live PID in the lock)
    * refuses to start outside the night window
  Each guard logs why it declined, so an empty night is distinguishable from a
  night that never tried.
#>
[CmdletBinding()]
param(
  [string] $Repo    = 'C:\Users\brian\RedAnvil',
  [int]    $EndHour = 9
)

$ErrorActionPreference = 'Stop'

$stateDir = Join-Path $Repo '.redanvil\overnight'
$logDir   = Join-Path $Repo 'logs\overnight'
$lockPath = Join-Path $stateDir 'resume.lock'
$donePath = Join-Path $stateDir 'NIGHT-COMPLETE'
$log      = Join-Path $logDir 'resume.log'

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir   | Out-Null

function Write-Log([string] $Message) {
  $line = ('{0}  {1}' -f (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'), $Message)
  Add-Content -Path $log -Value $line -Encoding utf8
}

if (Test-Path $donePath) {
  Write-Log 'night marked complete; nothing to resume'
  exit 0
}

# The window closes in the morning. Without this the task would keep relaunching
# a session all day, which is not autonomy, it is a runaway.
$hour = [int](Get-Date -Format 'HH')
if ($hour -ge $EndHour -and $hour -lt 20) {
  Write-Log ('outside the night window (hour {0}); not resuming' -f $hour)
  exit 0
}

if (Test-Path $lockPath) {
  $held = (Get-Content $lockPath -Raw).Trim()
  $alive = $null
  if ($held -match '^\d+$') {
    try { $alive = Get-Process -Id ([int]$held) -ErrorAction Stop } catch { $alive = $null }
  }
  if ($alive) {
    Write-Log ('a resume is already running (pid {0}); skipping' -f $held)
    exit 0
  }
  Write-Log ('stale lock from pid {0}; taking it' -f $held)
  Remove-Item $lockPath -Force
}

Set-Content -Path $lockPath -Value $PID -Encoding ascii
Write-Log ('resuming the night session (pid {0})' -f $PID)

$promptPath = Join-Path $Repo 'scripts\overnight\resume-prompt.txt'
$prompt = Get-Content -Raw -Path $promptPath
$sessionLog = Join-Path $logDir ('session-{0}.log' -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

try {
  & 'C:\Users\brian\.local\bin\claude.exe' -p $prompt --dangerously-skip-permissions --add-dir $Repo *>&1 |
    Out-File -FilePath $sessionLog -Encoding utf8
  Write-Log ('session exited with code {0}' -f $LASTEXITCODE)
}
catch {
  Write-Log ('session threw: {0}' -f $_.Exception.Message)
}
finally {
  if (Test-Path $lockPath) { Remove-Item $lockPath -Force }
}
