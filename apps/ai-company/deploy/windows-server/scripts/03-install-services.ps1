<#
  03 - Windows services via NSSM (auto-start, restart on crash, logs in C:\ai-company\logs):
    ai-company-web          vite preview on 0.0.0.0:<Port> - serves dist + relays /runtime/*
                            (/runtime/ollama strips Origin so Ollama accepts LAN browsers)
    ai-company-gh-evidence  github-evidence-bridge on 127.0.0.1:17320
    ai-company-connections  connections-bridge on 127.0.0.1:17321
    ai-company-state        state-bridge on 127.0.0.1:17322 - shared company state,
                            file in C:\ai-company\state (daily copies kept 14 days)
  Ollama is not wrapped here unless -InstallOllamaService is given (see README).
#>
param(
    [string]$InstallRoot = 'C:\ai-company',
    [int]$Port = 8080,
    [switch]$InstallOllamaService
)
. "$PSScriptRoot\_common.ps1"
Assert-Admin

$appDir = Join-Path $InstallRoot 'repo\apps\ai-company'
$logDir = Join-Path $InstallRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
if (-not (Test-Path (Join-Path $appDir 'dist\index.html'))) { throw 'dist not found - run 02-clone-and-build.ps1 first.' }

$nssm = Get-ToolPath 'nssm'
$node = Get-ToolPath 'node'
if (-not $nssm -or -not $node) { throw 'nssm/node not on PATH - run 01-install-prereqs.ps1.' }

$bridgesEnvPath = Join-Path $KitRoot 'env\bridges.env'
if (-not (Test-Path $bridgesEnvPath)) { throw "Create $bridgesEnvPath from bridges.env.example first." }
$bridgesEnv = Read-EnvFile $bridgesEnvPath
if (-not $bridgesEnv['GITHUB_TOKEN']) { Write-Warn2 'GITHUB_TOKEN is empty - evidence bridge will start but cannot read PRs.' }
$envPairs = @("AI_COMPANY_REPO_ROOT=$(Join-Path $InstallRoot 'repo')", 'NODE_ENV=production')
if (-not $bridgesEnv['AI_COMPANY_STATE_DIR']) { $envPairs += "AI_COMPANY_STATE_DIR=$(Join-Path $InstallRoot 'state')" }
foreach ($k in $bridgesEnv.Keys) { $envPairs += "$k=$($bridgesEnv[$k])" }

function Install-NssmService([string]$Name, [string]$Exe, [string]$Arguments, [string]$Dir, [string[]]$Env) {
    Write-Step "Service $Name"
    $existing = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($existing) {
        & $nssm stop $Name confirm | Out-Null
        & $nssm remove $Name confirm | Out-Null
    }
    & $nssm install $Name $Exe $Arguments | Out-Null
    & $nssm set $Name AppDirectory $Dir | Out-Null
    & $nssm set $Name Start SERVICE_AUTO_START | Out-Null
    & $nssm set $Name AppStdout (Join-Path $logDir "$Name.out.log") | Out-Null
    & $nssm set $Name AppStderr (Join-Path $logDir "$Name.err.log") | Out-Null
    & $nssm set $Name AppRotateFiles 1 | Out-Null
    & $nssm set $Name AppRotateBytes 10485760 | Out-Null
    & $nssm set $Name AppExit Default Restart | Out-Null
    & $nssm set $Name AppRestartDelay 5000 | Out-Null
    if ($Env -and $Env.Count -gt 0) { & $nssm set $Name AppEnvironmentExtra $Env | Out-Null }
    & $nssm start $Name | Out-Null
    Start-Sleep -Seconds 2
    $s = (Get-Service -Name $Name).Status
    if ($s -eq 'Running') { Write-Ok "$Name running" } else { Write-Warn2 "$Name status: $s - see $logDir\$Name.err.log" }
}

$tsx = Join-Path $appDir 'node_modules\tsx\dist\cli.mjs'
$vite = Join-Path $appDir 'node_modules\vite\bin\vite.js'

if ($InstallOllamaService) {
    $ollama = Get-ToolPath 'ollama'
    if (-not $ollama) { throw 'ollama.exe not on PATH' }
    Write-Warn2 'Quit the Ollama tray app first, or the service fails to bind 11434.'
    Install-NssmService 'ollama' $ollama 'serve' $InstallRoot @('OLLAMA_HOST=127.0.0.1:11434', 'OLLAMA_KEEP_ALIVE=30m', 'OLLAMA_MAX_LOADED_MODELS=2')
}

Install-NssmService 'ai-company-gh-evidence' $node "`"$tsx`" tools\github-evidence-bridge\src\index.ts run" $appDir $envPairs
Install-NssmService 'ai-company-state' $node "`"$tsx`" tools\state-bridge\src\index.ts run" $appDir $envPairs
Install-NssmService 'ai-company-connections' $node "`"$tsx`" tools\connections-bridge\src\index.ts run" $appDir $envPairs
Install-NssmService 'ai-company-web' $node "`"$vite`" preview --host 0.0.0.0 --port $Port --strictPort" $appDir $envPairs

Write-Step "Firewall: inbound TCP $Port (Private/Domain profiles only)"
$ruleName = "AI Company web $Port"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private,Domain | Out-Null
}
Write-Ok 'rule present'

Write-Host "`nNext: 04-pull-models.ps1, then healthcheck.ps1" -ForegroundColor Green
