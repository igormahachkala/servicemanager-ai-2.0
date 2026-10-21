<#
  04 - make sure the working models are present. Pulls ONLY what is missing; never
  deletes the models already on this server.
    qwen3-coder:30b   primary analysis / code model (default in build.env)
    qwen3.6:latest    MoE dispatcher (classification, executor choice)
    nomic-embed-text  embeddings for memory
#>
param(
    [string[]]$Models = @('qwen3-coder:30b', 'qwen3.6:latest', 'nomic-embed-text'),
    [string]$Proxy = ''
)
. "$PSScriptRoot\_common.ps1"
if ($Proxy) { $env:HTTPS_PROXY = $Proxy; $env:HTTP_PROXY = $Proxy }

if ((Test-Http 'http://127.0.0.1:11434/api/tags') -ne 200) { throw 'Ollama is not answering on 127.0.0.1:11434.' }

$tags = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 10
$present = @($tags.models | ForEach-Object { $_.name })
Write-Step ("Installed now: " + ($present -join ', '))

foreach ($m in $Models) {
    $name = if ($m.Contains(':')) { $m } else { "${m}:latest" }
    if ($present -contains $name) { Write-Ok "$name present"; continue }
    Write-Step "Pulling $name"
    ollama pull $name
    if ($LASTEXITCODE -ne 0) { Write-Warn2 "pull $name failed (network/proxy?)" } else { Write-Ok "$name pulled" }
}

Write-Step 'Smoke: one short generation on qwen3-coder:30b'
$body = @{ model = 'qwen3-coder:30b'; prompt = 'Reply with the single word: ready'; stream = $false; options = @{ temperature = 0 } } | ConvertTo-Json
$sw = [Diagnostics.Stopwatch]::StartNew()
try {
    $r = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/generate' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 600
    Write-Ok ("answer '" + $r.response.Trim() + "' in " + [int]$sw.Elapsed.TotalSeconds + 's (first call includes model load)')
} catch { Write-Warn2 "generation failed: $($_.Exception.Message)" }
