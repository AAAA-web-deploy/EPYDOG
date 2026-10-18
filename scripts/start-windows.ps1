$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host 'Eepy Dog Ethereum Next.js starter' -ForegroundColor Green
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required: https://nodejs.org/' }
if (!(Test-Path 'node_modules')) { npm install; if ($LASTEXITCODE -ne 0) { throw 'npm install failed' } }
npm run check:assets
if ($LASTEXITCODE -ne 0) { throw 'Missing media files' }
npm run dev
