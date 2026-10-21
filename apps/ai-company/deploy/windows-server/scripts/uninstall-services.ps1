<# Remove the AI Company services (keeps repo, logs, models). #>
. "$PSScriptRoot\_common.ps1"
Assert-Admin
$nssm = Get-ToolPath 'nssm'
foreach ($n in 'ai-company-web', 'ai-company-gh-evidence', 'ai-company-connections') {
    if (Get-Service -Name $n -ErrorAction SilentlyContinue) {
        & $nssm stop $n confirm | Out-Null
        & $nssm remove $n confirm | Out-Null
        Write-Ok "$n removed"
    }
}
