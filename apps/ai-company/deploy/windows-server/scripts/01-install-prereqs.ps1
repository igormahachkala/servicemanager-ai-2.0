<#
  01 - prerequisites: Git, Node.js LTS, NSSM. Ollama is ALREADY on this server - it is
  only checked, never reinstalled. Run elevated.
#>
param([string]$Proxy = '')
. "$PSScriptRoot\_common.ps1"
Assert-Admin

if ($Proxy) {
    $env:HTTP_PROXY = $Proxy; $env:HTTPS_PROXY = $Proxy
    Write-Warn2 "Using proxy $Proxy for this session"
}

if (-not (Get-ToolPath 'winget')) {
    throw 'winget is missing (Server Core or old build). Install Git, Node.js 22 LTS and NSSM manually, then rerun.'
}

$packages = @(
    @{ Cmd = 'git';  Id = 'Git.Git' },
    @{ Cmd = 'node'; Id = 'OpenJS.NodeJS.LTS' },
    @{ Cmd = 'nssm'; Id = 'NSSM.NSSM' }
)

foreach ($p in $packages) {
    Write-Step "Checking $($p.Cmd)"
    if (Get-ToolPath $p.Cmd) { Write-Ok "$($p.Cmd) already installed"; continue }
    winget install --id $p.Id -e --silent --accept-package-agreements --accept-source-agreements
    Update-SessionPath
    if (-not (Get-ToolPath $p.Cmd)) { throw "$($p.Cmd) still not on PATH after install - open a new PowerShell and rerun." }
    Write-Ok "$($p.Cmd) installed"
}

Write-Step 'Node version (Vite 8 needs >= 20.19)'
$nodeVer = (node -v).TrimStart('v')
$parts = $nodeVer.Split('.')
if ([int]$parts[0] -lt 20 -or ([int]$parts[0] -eq 20 -and [int]$parts[1] -lt 19)) {
    throw "Node $nodeVer is too old. Upgrade: winget upgrade OpenJS.NodeJS.LTS"
}
Write-Ok "node $nodeVer"

Write-Step 'Ollama (must already be running on 11434)'
$code = Test-Http 'http://127.0.0.1:11434/api/tags'
if ($code -eq 200) { Write-Ok 'Ollama answers on 127.0.0.1:11434' }
else { Write-Warn2 "Ollama does not answer (HTTP $code). Start it before 03/04 - see README, section Ollama." }

Write-Host "`nDone. Next: fill env\bridges.env, then 02-clone-and-build.ps1" -ForegroundColor Green
