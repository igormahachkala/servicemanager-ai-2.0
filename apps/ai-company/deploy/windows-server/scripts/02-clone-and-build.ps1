<#
  02 - clone (or update) the repo and build the SPA. Rerun this to deploy a new version,
  then: Restart-Service ai-company-web
#>
param(
    [string]$RepoUrl = 'https://github.com/igormahachkala/servicemanager-ai-2.0.git',
    [string]$Branch = 'feat/memory-reconciliation',
    [string]$InstallRoot = 'C:\ai-company',
    [string]$Proxy = '',
    [switch]$StrictTests
)
. "$PSScriptRoot\_common.ps1"

if ($Proxy) { $env:HTTP_PROXY = $Proxy; $env:HTTPS_PROXY = $Proxy; git config --global http.proxy $Proxy }

$repoDir = Join-Path $InstallRoot 'repo'
$appDir = Join-Path $repoDir 'apps\ai-company'
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

Write-Step "Repository ($Branch)"
if (Test-Path (Join-Path $repoDir '.git')) {
    git -C $repoDir fetch --depth 50 origin $Branch
    if ($LASTEXITCODE -ne 0) { throw 'git fetch failed' }
    git -C $repoDir checkout -B $Branch "origin/$Branch"
    git -C $repoDir reset --hard "origin/$Branch"
} else {
    # Private repo: Git Credential Manager opens a browser sign-in once.
    git clone --depth 50 --branch $Branch $RepoUrl $repoDir
    if ($LASTEXITCODE -ne 0) { throw 'git clone failed (auth? network?)' }
}
Write-Ok ("HEAD " + (git -C $repoDir log -1 --format='%h %s'))

Write-Step 'Build env'
$buildEnv = Join-Path $KitRoot 'env\ai-company.build.env'
if (-not (Test-Path $buildEnv)) { throw "Missing $buildEnv" }
Copy-Item $buildEnv (Join-Path $appDir '.env.production.local') -Force
Write-Ok 'copied to apps\ai-company\.env.production.local'

Write-Step 'npm ci'
Push-Location $appDir
try {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }

    Write-Step 'Domain tests'
    npm run -s test:domain
    if ($LASTEXITCODE -ne 0) {
        # Suite is green on macOS/Linux; a few smoke tests stub POSIX tools and may
        # fail on Windows. Warn by default, block only with -StrictTests.
        if ($StrictTests) { throw 'Domain tests failed - not deploying this build.' }
        Write-Warn2 'Some domain tests failed on Windows - continuing (use -StrictTests to block).'
    }

    Write-Step 'Build (tsc -b && vite build)'
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
} finally { Pop-Location }

Write-Ok "dist ready: $appDir\dist"
Write-Host "`nFirst install: run 03-install-services.ps1 (elevated). Update: Restart-Service ai-company-web" -ForegroundColor Green
