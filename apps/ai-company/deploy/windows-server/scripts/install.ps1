<#
  install - the whole office-server setup in one run (elevated PowerShell,
  works over SSH): 01 prerequisites -> bridges.env -> 02 build -> 03 services
  -> 04 models -> healthcheck -> 05 public host name (when -Hostname is given).
  Safe to rerun: every step skips what is already in place.
#>
param(
    [string]$Hostname = '',
    [string]$Branch = 'feat/memory-reconciliation',
    [string]$Proxy = '',
    [switch]$SkipModels
)
. "$PSScriptRoot\_common.ps1"
Assert-Admin

# Steps signal failure by throwing ($ErrorActionPreference = Stop). Native
# tools inside them may leave a non-zero $LASTEXITCODE on a handled warning
# (e.g. a Windows-only test failure in 02), so that is not treated as failure.
function Invoke-Step([string]$Title, [scriptblock]$Body) {
    Write-Host "`n################ $Title ################" -ForegroundColor Magenta
    & $Body
}

Invoke-Step '01 prerequisites' { & "$PSScriptRoot\01-install-prereqs.ps1" -Proxy $Proxy }
Update-SessionPath

$envPath = Join-Path $KitRoot 'env\bridges.env'
if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $KitRoot 'env\bridges.env.example') $envPath
    Write-Ok 'env\bridges.env created from the example (GITHUB_TOKEN empty - fine for analysis tasks)'
}

Invoke-Step '02 clone and build' { & "$PSScriptRoot\02-clone-and-build.ps1" -Branch $Branch -Proxy $Proxy }
Invoke-Step '03 services' { & "$PSScriptRoot\03-install-services.ps1" }
if (-not $SkipModels) { Invoke-Step '04 models' { & "$PSScriptRoot\04-pull-models.ps1" -Proxy $Proxy } }
if ($Hostname) { Invoke-Step '05 public host name' { & "$PSScriptRoot\05-public-hostname.ps1" -Hostname $Hostname } }
Invoke-Step 'healthcheck' { & "$PSScriptRoot\healthcheck.ps1" }
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nInstalled, but the healthcheck reports problems (see above). Logs: C:\ai-company\logs" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nAI Company is installed." -ForegroundColor Green
if ($Hostname) { Write-Host "Open https://$Hostname" -ForegroundColor Green }
