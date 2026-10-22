<# healthcheck - services, ports and the same-origin relays the browser uses. #>
param([int]$Port = 8080)
. "$PSScriptRoot\_common.ps1"
$fail = 0

Write-Step 'Services'
foreach ($n in 'ai-company-web', 'ai-company-gh-evidence', 'ai-company-connections', 'ai-company-state', 'ollama') {
    $s = Get-Service -Name $n -ErrorAction SilentlyContinue
    if (-not $s) { if ($n -ne 'ollama') { Write-Warn2 "$n not installed"; $fail++ } else { Write-Host '    --  ollama: not a service (tray app?) - checked via HTTP below' }; continue }
    if ($s.Status -eq 'Running') { Write-Ok "$n Running" } else { Write-Warn2 "$n $($s.Status)"; $fail++ }
}

Write-Step 'Endpoints'
$checks = @(
    @{ Name = 'Ollama direct';                Url = 'http://127.0.0.1:11434/api/tags' },
    @{ Name = 'Panel';                        Url = "http://127.0.0.1:$Port/" },
    @{ Name = 'Relay /runtime/ollama';        Url = "http://127.0.0.1:$Port/runtime/ollama/api/tags" },
    @{ Name = 'GitHub evidence (via relay)';  Url = "http://127.0.0.1:$Port/runtime/github-evidence/v1/health" },
    @{ Name = 'Connections (via relay)';      Url = "http://127.0.0.1:$Port/runtime/connections/v1/health" },
    @{ Name = 'Shared state (via relay)';     Url = "http://127.0.0.1:$Port/runtime/state/v1/health" }
)
foreach ($c in $checks) {
    $code = Test-Http $c.Url
    if ($code -ge 200 -and $code -lt 500) { Write-Ok "$($c.Name) -> HTTP $code" } else { Write-Warn2 "$($c.Name) -> HTTP $code ($($c.Url))"; $fail++ }
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } | Select-Object -First 1).IPAddress
Write-Host ''
if ($fail -eq 0) { Write-Host "ALL GREEN. Open from any office PC: http://${ip}:$Port" -ForegroundColor Green }
else { Write-Host "$fail problem(s). Logs: C:\ai-company\logs" -ForegroundColor Red; exit 1 }
