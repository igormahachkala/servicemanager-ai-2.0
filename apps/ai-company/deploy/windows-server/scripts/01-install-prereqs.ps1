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

# winget is tried first; over SSH or on Server builds it is often missing or
# fails (msstore agreements, no user session). Every tool then has a direct
# download from its official source.
$hasWinget = [bool](Get-ToolPath 'winget')
$binDir = 'C:\ai-company\bin'
New-Item -ItemType Directory -Force -Path $binDir | Out-Null
$tmp = Join-Path $env:TEMP 'ai-company-setup'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Try-Winget([string]$Id) {
    if (-not $hasWinget) { return $false }
    try {
        winget install --id $Id -e --silent --accept-package-agreements --accept-source-agreements --disable-interactivity 2>&1 | Out-Host
    } catch { return $false }
    Update-SessionPath
    return $true
}

function Install-NodeDirect {
    $index = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $lts = $index | Where-Object { $_.lts -and ([int]($_.version.TrimStart('v').Split('.')[0]) -ge 22) } | Select-Object -First 1
    if (-not $lts) { $lts = $index | Where-Object { $_.lts } | Select-Object -First 1 }
    $v = $lts.version
    $msi = Join-Path $tmp "node-$v-x64.msi"
    Write-Host "    downloading Node $v"
    Invoke-WebRequest "https://nodejs.org/dist/$v/node-$v-x64.msi" -OutFile $msi -UseBasicParsing
    $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait -PassThru
    if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { throw "Node MSI exit code $($p.ExitCode)" }
    Add-MachinePath 'C:\Program Files\nodejs'
}

function Install-GitDirect {
    $rel = Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest' -Headers @{ 'User-Agent' = 'ai-company-setup' }
    $asset = $rel.assets | Where-Object { $_.name -match '^Git-[\d.]+-64-bit\.exe$' } | Select-Object -First 1
    if (-not $asset) { throw 'Git for Windows installer not found in the latest release' }
    $exe = Join-Path $tmp $asset.name
    Write-Host "    downloading $($asset.name)"
    Invoke-WebRequest $asset.browser_download_url -OutFile $exe -UseBasicParsing
    $p = Start-Process $exe -ArgumentList '/VERYSILENT /NORESTART /NOCANCEL /SP- /SUPPRESSMSGBOXES' -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "Git installer exit code $($p.ExitCode)" }
    Add-MachinePath 'C:\Program Files\Git\cmd'
}

function Install-NssmDirect {
    $zip = Join-Path $tmp 'nssm-2.24.zip'
    Write-Host '    downloading NSSM 2.24'
    Invoke-WebRequest 'https://nssm.cc/release/nssm-2.24.zip' -OutFile $zip -UseBasicParsing
    $dst = Join-Path $tmp 'nssm'
    if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
    Expand-Archive $zip -DestinationPath $dst -Force
    Copy-Item (Join-Path $dst 'nssm-2.24\win64\nssm.exe') (Join-Path $binDir 'nssm.exe') -Force
    Add-MachinePath $binDir
}

$packages = @(
    @{ Cmd = 'git';  Id = 'Git.Git';           Direct = ${function:Install-GitDirect} },
    @{ Cmd = 'node'; Id = 'OpenJS.NodeJS.LTS'; Direct = ${function:Install-NodeDirect} },
    @{ Cmd = 'nssm'; Id = 'NSSM.NSSM';         Direct = ${function:Install-NssmDirect} }
)

foreach ($p in $packages) {
    Write-Step "Checking $($p.Cmd)"
    if (Get-ToolPath $p.Cmd) { Write-Ok "$($p.Cmd) already installed"; continue }
    [void](Try-Winget $p.Id)
    if (-not (Get-ToolPath $p.Cmd)) {
        if ($hasWinget) { Write-Warn2 "winget did not install $($p.Cmd) - downloading directly" }
        & $p.Direct
    }
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
