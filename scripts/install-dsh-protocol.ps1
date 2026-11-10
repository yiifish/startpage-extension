<#
    Register (or remove) the per-user dsh:// URL protocol that the start
    page's DeepSeek Harness bookmark uses.

    Install:   pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-dsh-protocol.ps1
    Uninstall: pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-dsh-protocol.ps1 -Uninstall

    Registry location: HKCU\Software\Classes\dsh  (current user, no elevation).
    The handler runs scripts\start-dsh.ps1 from this checkout, so re-run this
    script after moving the checkout.

    ASCII-only on purpose: Windows PowerShell 5.1 misreads BOM-less UTF-8.
#>
[CmdletBinding()]
param(
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$KeyPath = 'HKCU:\Software\Classes\dsh'
$PowerShellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$ReadmeCommand = 'pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-dsh-protocol.ps1'

Write-Host ''

if ($Uninstall) {
    if (Test-Path $KeyPath) {
        Remove-Item -Path $KeyPath -Recurse -Force
        Write-Host 'dsh:// protocol removed (HKCU\Software\Classes\dsh).'
    }
    else {
        Write-Host 'dsh:// protocol was not registered; nothing to remove.'
    }
    Write-Host ''
    exit 0
}

if (-not (Test-Path $KeyPath)) {
    New-Item -Path $KeyPath -Force | Out-Null
}

$Launcher = Join-Path $PSScriptRoot 'start-dsh.ps1'
if (-not (Test-Path $Launcher)) {
    throw "launcher not found: $Launcher"
}
if (-not (Test-Path $PowerShellExe)) {
    throw "Windows PowerShell not found: $PowerShellExe"
}

New-Item -Path (Join-Path $KeyPath 'DefaultIcon') -Force | Out-Null
New-Item -Path (Join-Path $KeyPath 'shell\open\command') -Force | Out-Null

Set-ItemProperty -Path $KeyPath -Name '(default)' -Value 'URL:DeepSeek Harness Protocol'
Set-ItemProperty -Path $KeyPath -Name 'URL Protocol' -Value ''
Set-ItemProperty -Path $KeyPath -Name 'FriendlyTypeName' -Value 'DeepSeek Harness'
Set-ItemProperty -Path (Join-Path $KeyPath 'DefaultIcon') -Name '(default)' -Value ('"{0}",0' -f $PowerShellExe)
Set-ItemProperty -Path (Join-Path $KeyPath 'shell\open\command') -Name '(default)' -Value (
    '"{0}" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{1}" "%1"' -f $PowerShellExe, $Launcher
)

$handler = (Get-ItemProperty -Path (Join-Path $KeyPath 'shell\open\command')).'(default)'
Write-Host "dsh:// protocol registered:"
Write-Host "  HKCU\Software\Classes\dsh"
Write-Host "  handler: $handler"
Write-Host "  launcher: $Launcher"
Write-Host ''
Write-Host 'Open the bookmark once and allow the browser prompt; the choice is remembered.'
Write-Host ('Remove it with: {0} -Uninstall' -f $ReadmeCommand) -ForegroundColor DarkGray
Write-Host ''
