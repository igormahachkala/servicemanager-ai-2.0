<#
  05 - let the panel answer to its public name (https://<Hostname>, served by the
  VPS through the WireGuard tunnel, see deploy/vps-tunnel/README.md).
  Vite rejects unknown host names (DNS-rebinding guard), so the name is added to
  AI_COMPANY_ALLOWED_HOSTS and ai-company-web is restarted. Safe to rerun.
#>
param(
    [Parameter(Mandatory = $true)][string]$Hostname,
    [string]$InstallRoot = 'C:\ai-company',
    [string]$OfficeLinuxIp = ''
)
. "$PSScriptRoot\_common.ps1"
Assert-Admin

$Hostname = ($Hostname -replace '^https?://', '').TrimEnd('/')

Write-Step "Allow host name $Hostname"
$envPath = Join-Path $KitRoot 'env\bridges.env'
if (-not (Test-Path $envPath)) { throw "Missing $envPath - run 03 first." }
$current = Read-EnvFile $envPath
$hosts = @()
if ($current['AI_COMPANY_ALLOWED_HOSTS']) { $hosts = @($current['AI_COMPANY_ALLOWED_HOSTS'].Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
if ($hosts -notcontains $Hostname) { $hosts += $Hostname }
$lines = @(Get-Content -LiteralPath $envPath -Encoding UTF8 | Where-Object { $_ -notmatch '^\s*AI_COMPANY_ALLOWED_HOSTS\s*=' })
$lines += "AI_COMPANY_ALLOWED_HOSTS=$($hosts -join ',')"
Set-Content -LiteralPath $envPath -Value $lines -Encoding UTF8
Write-Ok "AI_COMPANY_ALLOWED_HOSTS=$($hosts -join ',')"

Write-Step 'Apply to ai-company-web'
$nssm = Get-ToolPath 'nssm'
if (-not $nssm) { throw 'nssm not on PATH - run 01/03 first.' }
$envPairs = @("AI_COMPANY_REPO_ROOT=$(Join-Path $InstallRoot 'repo')", 'NODE_ENV=production')
$all = Read-EnvFile $envPath
foreach ($k in $all.Keys) { $envPairs += "$k=$($all[$k])" }
& $nssm set ai-company-web AppEnvironmentExtra $envPairs | Out-Null
Restart-Service ai-company-web
Start-Sleep -Seconds 4
Write-Ok ("ai-company-web " + (Get-Service ai-company-web).Status)

Write-Step 'Local check with the public Host header'
try {
    # Windows PowerShell 5.1 refuses a Host entry in -Headers; HttpWebRequest has a Host property.
    $req = [System.Net.HttpWebRequest]::Create('http://127.0.0.1:8080/')
    $req.Host = $Hostname
    $req.Timeout = 10000
    $resp = $req.GetResponse()
    Write-Ok "HTTP $([int]$resp.StatusCode) for Host: $Hostname"
    $resp.Close()
} catch {
    Write-Warn2 "Host check failed: $($_.Exception.Message)"
}

if ($OfficeLinuxIp) {
    Write-Step "Firewall: TCP 8080 also from the office Linux $OfficeLinuxIp"
    $ruleName = 'AI Company web 8080 (office Linux tunnel)'
    if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort 8080 -RemoteAddress $OfficeLinuxIp -Action Allow -Profile Any | Out-Null
    }
    Write-Ok 'rule present'
}

Write-Host "`nDone. Open https://$Hostname (login + password from the VPS step)." -ForegroundColor Green
