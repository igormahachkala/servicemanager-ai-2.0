<#
  bootstrap - download this kit from GitHub into C:\ai-company\kit and run
  scripts\install.ps1. One line from an elevated cmd/PowerShell or SSH:

  powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; & ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/igormahachkala/servicemanager-ai-2.0/feat/memory-reconciliation/apps/ai-company/deploy/windows-server/bootstrap.ps1'))) -Hostname ai.sma-tech.ru"
#>
param(
    [string]$Hostname = '',
    [string]$Branch = 'feat/memory-reconciliation',
    [string]$KitDir = 'C:\ai-company\kit',
    [string]$Proxy = '',
    [switch]$SkipModels
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$base = "https://raw.githubusercontent.com/igormahachkala/servicemanager-ai-2.0/$Branch/apps/ai-company/deploy/windows-server"
$files = @(
    'scripts/_common.ps1', 'scripts/install.ps1',
    'scripts/01-install-prereqs.ps1', 'scripts/02-clone-and-build.ps1', 'scripts/03-install-services.ps1',
    'scripts/04-pull-models.ps1', 'scripts/05-public-hostname.ps1',
    'scripts/healthcheck.ps1', 'scripts/uninstall-services.ps1',
    'env/ai-company.build.env', 'env/bridges.env.example', 'README.md'
)
Write-Host "Downloading the kit ($Branch) to $KitDir"
foreach ($f in $files) {
    $dst = Join-Path $KitDir ($f -replace '/', '\')
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    $iwr = @{ Uri = "$base/$f"; OutFile = $dst; UseBasicParsing = $true }
    if ($Proxy) { $iwr.Proxy = $Proxy }
    Invoke-WebRequest @iwr
}
# bridges.env (secrets) is never downloaded or overwritten.

& (Join-Path $KitDir 'scripts\install.ps1') -Hostname $Hostname -Branch $Branch -Proxy $Proxy -SkipModels:$SkipModels
