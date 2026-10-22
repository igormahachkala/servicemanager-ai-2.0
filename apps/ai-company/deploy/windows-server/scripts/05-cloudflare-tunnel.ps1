<#
  05 - publish the panel at https://<Hostname> through a Cloudflare Tunnel.
  No inbound ports: cloudflared on this server dials out to Cloudflare.

  BEFORE running (Cloudflare dashboard, see README section "Access from outside"):
    1. Zero Trust -> Access -> Applications: self-hosted app for <Hostname>,
       policy Allow -> Emails -> your address. Do this FIRST.
    2. Zero Trust -> Networks -> Tunnels -> Create (cloudflared), copy the token,
       Public hostname: <Hostname> -> Service HTTP -> localhost:8080

  The script refuses to finish quietly if the hostname answers without the
  Access login: an open panel on the internet controls the whole company.
#>
param(
    [Parameter(Mandatory = $true)][string]$Hostname,
    [Parameter(Mandatory = $true)][string]$TunnelToken,
    [string]$InstallRoot = 'C:\ai-company'
)
. "$PSScriptRoot\_common.ps1"
Assert-Admin

if ($Hostname -match '^https?://') { $Hostname = ($Hostname -replace '^https?://', '').TrimEnd('/') }

Write-Step 'cloudflared'
if (-not (Get-ToolPath 'cloudflared')) {
    winget install --id Cloudflare.cloudflared -e --silent --accept-package-agreements --accept-source-agreements
    Update-SessionPath
    if (-not (Get-ToolPath 'cloudflared')) {
        $guess = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
        if (Test-Path $guess) { $env:Path += ';' + (Split-Path $guess) } else { throw 'cloudflared not found after install - open a new PowerShell and rerun.' }
    }
}
Write-Ok (cloudflared --version)

Write-Step 'Tunnel service'
$svc = Get-Service -Name 'cloudflared' -ErrorAction SilentlyContinue
if ($svc) {
    Write-Warn2 'cloudflared service exists - reinstalling with the new token'
    cloudflared service uninstall | Out-Null
    Start-Sleep -Seconds 2
}
cloudflared service install $TunnelToken
if ($LASTEXITCODE -ne 0) { throw 'cloudflared service install failed (token?)' }
Start-Sleep -Seconds 5
Write-Ok ("cloudflared " + (Get-Service cloudflared).Status)

Write-Step "Allow host name $Hostname in the panel"
$envPath = Join-Path $KitRoot 'env\bridges.env'
if (-not (Test-Path $envPath)) { throw "Missing $envPath - run 03 first." }
$lines = @(Get-Content -LiteralPath $envPath -Encoding UTF8 | Where-Object { $_ -notmatch '^\s*AI_COMPANY_ALLOWED_HOSTS\s*=' })
$current = Read-EnvFile $envPath
$hosts = @()
if ($current['AI_COMPANY_ALLOWED_HOSTS']) { $hosts = $current['AI_COMPANY_ALLOWED_HOSTS'].Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ } }
if ($hosts -notcontains $Hostname) { $hosts += $Hostname }
$lines += "AI_COMPANY_ALLOWED_HOSTS=$($hosts -join ',')"
Set-Content -LiteralPath $envPath -Value $lines -Encoding UTF8
Write-Ok "AI_COMPANY_ALLOWED_HOSTS=$($hosts -join ',')"

$nssm = Get-ToolPath 'nssm'
$envPairs = @("AI_COMPANY_REPO_ROOT=$(Join-Path $InstallRoot 'repo')", 'NODE_ENV=production')
$all = Read-EnvFile $envPath
foreach ($k in $all.Keys) { $envPairs += "$k=$($all[$k])" }
& $nssm set ai-company-web AppEnvironmentExtra $envPairs | Out-Null
Restart-Service ai-company-web
Start-Sleep -Seconds 4
Write-Ok 'ai-company-web restarted'

Write-Step "Checking https://$Hostname from outside (DNS can take a minute)"
$url = "https://$Hostname/"
$verdict = $null
for ($i = 0; $i -lt 12 -and -not $verdict; $i++) {
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.AllowAutoRedirect = $false
        $req.Timeout = 10000
        $resp = $req.GetResponse()
        $code = [int]$resp.StatusCode
        $loc = $resp.Headers['Location']
        $resp.Close()
    } catch [System.Net.WebException] {
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            $loc = $_.Exception.Response.Headers['Location']
        } else { $code = 0; $loc = $null }
    }
    if ($code -ge 300 -and $code -lt 400 -and $loc -match 'cloudflareaccess\.com') { $verdict = 'protected' }
    elseif ($code -eq 200) { $verdict = 'OPEN' }
    elseif ($code -eq 403 -and $loc -eq $null) { $verdict = 'blocked-by-vite' }
    else { Start-Sleep -Seconds 10 }
}

switch ($verdict) {
    'protected' { Write-Host "`nOK: https://$Hostname asks for the Cloudflare Access login." -ForegroundColor Green }
    'OPEN' {
        Write-Host "`nDANGER: https://$Hostname answers WITHOUT a login - the panel is open to the internet." -ForegroundColor Red
        Write-Host 'Stopping the tunnel until an Access application protects this hostname.' -ForegroundColor Red
        Stop-Service cloudflared
        exit 1
    }
    'blocked-by-vite' { Write-Warn2 'Vite rejected the host name - check AI_COMPANY_ALLOWED_HOSTS and restart ai-company-web.'; exit 1 }
    default { Write-Warn2 "No answer from https://$Hostname yet (HTTP $code). Check the tunnel status in the dashboard and rerun the check: .\05-cloudflare-tunnel.ps1 is safe to rerun." }
}
