<#
    DeepSeek Harness launcher, invoked by the dsh:// URL protocol.

    Behaviour:
      * port already listening -> open the cached token URL when this script
        started that server, otherwise open the plain origin (the browser is
        launched by Windows, so its SameSite=Strict session cookie is sent).
      * port not listening -> start `dsh web --port <port> --no-open` in a
        hidden window, read the `dsh web: <token URL>` line from its output,
        then open that URL.

    State and logs live in %LOCALAPPDATA%\DeepSeekHarness:
      start.log          launcher decisions
      harness.log        server stdout
      harness.error.log  server stderr
      server.json        pid / port / token URL of the server this script started

    The script is intentionally ASCII-only: it is usually run by
    powershell.exe (Windows PowerShell 5.1), which misreads BOM-less UTF-8.
#>
[CmdletBinding()]
param(
    [string]$Uri = 'dsh://start',
    [int]$Port = 3080,
    [int]$TimeoutSeconds = 90,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'

$StateDir     = Join-Path $env:LOCALAPPDATA 'DeepSeekHarness'
$StartLog     = Join-Path $StateDir 'start.log'
$ServerOutLog = Join-Path $StateDir 'harness.log'
$ServerErrLog = Join-Path $StateDir 'harness.error.log'
$StateFile    = Join-Path $StateDir 'server.json'

New-Item -ItemType Directory -Path $StateDir -Force | Out-Null

function Write-StartLog {
    param([string]$Message)
    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $PID, $Message
    Add-Content -Path $StartLog -Value $line -Encoding UTF8
}

function Test-LocalPort {
    param([int]$PortNumber, [int]$TimeoutMs = 800)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $pending = $client.BeginConnect('127.0.0.1', $PortNumber, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne($TimeoutMs)) { return $false }
        $client.EndConnect($pending)
        return $true
    }
    catch { return $false }
    finally { $client.Close() }
}

function Get-LiveServer {
    param([int]$PortNumber)
    if (-not (Test-Path $StateFile)) { return $null }
    $saved = $null
    try { $saved = Get-Content $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
    if ($null -eq $saved) { return $null }
    if ([int]$saved.port -ne $PortNumber) { return $null }
    if (-not $saved.url) { return $null }
    $owner = Get-Process -Id ([int]$saved.pid) -ErrorAction SilentlyContinue
    if ($null -eq $owner) { return $null }
    return $saved
}

# Resolve the CLI to run, as a command line that cmd.exe can execute.
# Order: DSH_LAUNCH_COMMAND override, dsh on PATH, cached npx install, npx.
function Resolve-DshCommand {
    if ($env:DSH_LAUNCH_COMMAND) { return $env:DSH_LAUNCH_COMMAND }

    $shim = Get-Command 'dsh.cmd' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($shim) { return '"{0}"' -f $shim.Source }

    $shim = Get-Command 'dsh.exe' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($shim) { return '"{0}"' -f $shim.Source }

    $node = Get-Command 'node.exe' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $cacheRoot = Join-Path $env:LOCALAPPDATA 'npm-cache\_npx'
    if ($node -and (Test-Path $cacheRoot)) {
        $entry = Get-ChildItem -Path $cacheRoot -Directory -ErrorAction SilentlyContinue |
            ForEach-Object { Join-Path $_.FullName 'node_modules\@deepseek-ai\dsh\lib\bin.js' } |
            Where-Object { Test-Path $_ } |
            ForEach-Object { Get-Item $_ } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($entry) { return '"{0}" "{1}"' -f $node.Source, $entry.FullName }
    }

    return 'npx -y @deepseek-ai/dsh'
}

function Open-Target {
    param([string]$Target)
    if ($NoOpen) {
        Write-StartLog ('-NoOpen: would open {0}' -f $Target)
        return
    }
    try {
        Start-Process -FilePath $Target
        Write-StartLog ('opened {0}' -f $Target)
    }
    catch {
        Write-StartLog ('could not open {0}: {1}' -f $Target, $_.Exception.Message)
    }
}

function Read-LaunchUrl {
    if (-not (Test-Path $ServerOutLog)) { return $null }
    $text = $null
    try { $text = Get-Content $ServerOutLog -Raw -Encoding UTF8 -ErrorAction Stop } catch { return $null }
    if (-not $text) { return $null }
    $match = [regex]::Match($text, 'dsh web:\s+(https?://[^\s"'']+)')
    if ($match.Success) { return $match.Groups[1].Value }
    return $null
}

Write-StartLog ('invoked with {0} (port {1})' -f $Uri, $Port)

$origin = 'http://127.0.0.1:{0}/' -f $Port

if (Test-LocalPort -PortNumber $Port) {
    $live = Get-LiveServer -PortNumber $Port
    if ($live) {
        Write-StartLog ('port {0} already listening; reusing token URL from pid {1}' -f $Port, $live.pid)
        Open-Target -Target $live.url
    }
    else {
        Write-StartLog ('port {0} already listening, but this launcher did not start it; opening origin' -f $Port)
        Open-Target -Target $origin
    }
    return
}

$launcher = Resolve-DshCommand
$commandLine = '{0} web --port {1} --no-open' -f $launcher, $Port
Write-StartLog ('starting: {0}' -f $commandLine)

Remove-Item -Path $ServerOutLog, $ServerErrLog -Force -ErrorAction SilentlyContinue

$proc = Start-Process -FilePath $env:ComSpec `
    -ArgumentList ('/d /s /c "{0}"' -f $commandLine) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $ServerOutLog `
    -RedirectStandardError $ServerErrLog `
    -PassThru
Write-StartLog ('spawned pid {0}' -f $proc.Id)

$url = $null
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while (-not $url -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 300
    $url = Read-LaunchUrl
    if ($proc.HasExited -and -not $url) {
        Start-Sleep -Milliseconds 500
        $url = Read-LaunchUrl
        if (-not $url) {
            Write-StartLog ('server exited with code {0} before printing its URL' -f $proc.ExitCode)
            break
        }
    }
}

if (-not $url) {
    if (Test-LocalPort -PortNumber $Port) {
        Write-StartLog ('port {0} is now listening but no token URL was captured; opening origin' -f $Port)
        Open-Target -Target $origin
    }
    else {
        $detail = ''
        if (Test-Path $ServerErrLog) {
            $detail = (Get-Content $ServerErrLog -Raw -Encoding UTF8 -ErrorAction SilentlyContinue)
            if ($detail) { $detail = $detail.Trim() }
        }
        Write-StartLog ('could not start DeepSeek Harness: {0}' -f $detail)
        if (-not $NoOpen) { Start-Process -FilePath $StartLog }
    }
    return
}

$state = [pscustomobject]@{
    pid       = $proc.Id
    port      = $Port
    url       = $url
    startedAt = (Get-Date).ToString('o')
}
$state | ConvertTo-Json | Set-Content -Path $StateFile -Encoding UTF8
Write-StartLog ('server ready; token URL captured, saved to {0}' -f $StateFile)

Open-Target -Target $url
