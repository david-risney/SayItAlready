<#
.SYNOPSIS
  Bumps the app version across all files that reference it.

.DESCRIPTION
  Updates:
    - js/version.js          (APP_VERSION export — home-screen.js reads this at runtime)
    - sw.js                  (CACHE_NAME with version-derived cache key)

.PARAMETER Version
  Semantic version string, e.g. "1.2.0"

.EXAMPLE
  .\scripts\bump-version.ps1 1.2.0
#>
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version
)

$root = Split-Path $PSScriptRoot -Parent
$ErrorActionPreference = 'Stop'

# 1. js/version.js
$versionFile = Join-Path $root 'js/version.js'
$content = Get-Content $versionFile -Raw
$content = $content -replace "APP_VERSION = '[^']+'", "APP_VERSION = '$Version'"
Set-Content $versionFile $content -NoNewline
Write-Host "  js/version.js -> $Version"

# 2. sw.js  (CACHE_NAME = 'sayitalready-v<major>.<minor>.<patch>')
$swFile = Join-Path $root 'sw.js'
$content = Get-Content $swFile -Raw
$content = $content -replace "CACHE_NAME = '[^']+'", "CACHE_NAME = 'sayitalready-v$Version'"
Set-Content $swFile $content -NoNewline
Write-Host "  sw.js -> sayitalready-v$Version"

Write-Host "`nVersion bumped to $Version" -ForegroundColor Green
