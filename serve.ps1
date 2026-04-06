<#
.SYNOPSIS
    Starts local dev servers: HTTP (desktop) + HTTPS (mobile).

.DESCRIPTION
    Runs two servers in parallel:
    - HTTP on port 3000 for quick desktop testing (no cert warnings)
    - HTTPS on a second port for mobile testing (gyro/tilt requires secure context)
    Uses a self-signed certificate for the HTTPS server.

.PARAMETER HttpPort
    HTTP port (default 3000).

.PARAMETER HttpsPort
    HTTPS port (default 3443).
#>
param(
    [int]$HttpPort = 3000,
    [int]$HttpsPort = 3443
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# --- Ensure a self-signed cert exists ---
$certDir = Join-Path $root '.certs'
$certFile = Join-Path $certDir 'cert.pem'
$keyFile  = Join-Path $certDir 'key.pem'

if (-not (Test-Path $certFile) -or -not (Test-Path $keyFile)) {
    Write-Host '🔐 Generating self-signed certificate...' -ForegroundColor Cyan

    if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
        Write-Error 'openssl is required but not found. Install OpenSSL or Git for Windows (which includes it).'
        return
    }

    New-Item -ItemType Directory -Path $certDir -Force | Out-Null

    openssl req -x509 -newkey rsa:2048 -nodes `
        -keyout $keyFile -out $certFile `
        -days 365 -subj '/CN=localhost' `
        -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' 2>&1 | Out-Null

    Write-Host "  Certificate saved to $certDir" -ForegroundColor Green
}

# --- Make sure .certs is git-ignored ---
$gitignore = Join-Path $root '.gitignore'
if (Test-Path $gitignore) {
    $content = Get-Content $gitignore -Raw
    if ($content -notmatch '\.certs') {
        Add-Content $gitignore "`n.certs/"
    }
} else {
    Set-Content $gitignore ".certs/`n"
}

# --- Find the local network IP so we can print a handy URL ---
$localIP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1).IPAddress

Write-Host ''
Write-Host '🚀 Starting dev servers...' -ForegroundColor Green
Write-Host "   HTTP:    http://localhost:$HttpPort  (desktop)" -ForegroundColor Yellow
Write-Host "   HTTPS:   https://localhost:$HttpsPort  (secure context)" -ForegroundColor Yellow
if ($localIP) {
    Write-Host "   Network: https://${localIP}:$HttpsPort  (use this on your phone)" -ForegroundColor Yellow
}
Write-Host ''
Write-Host '⚠️  Your phone will show a certificate warning — tap "Advanced" → "Proceed" to continue.' -ForegroundColor DarkYellow
Write-Host '   Press Ctrl+C to stop.' -ForegroundColor DarkGray
Write-Host ''

# --- Start both servers ---
$httpsJob = Start-Job -ScriptBlock {
    param($root, $port, $cert, $key)
    npx serve $root -l $port --ssl-cert $cert --ssl-key $key --cors
} -ArgumentList $root, $HttpsPort, $certFile, $keyFile

try {
    npx serve $root -l $HttpPort --cors
} finally {
    Stop-Job $httpsJob -ErrorAction SilentlyContinue
    Remove-Job $httpsJob -ErrorAction SilentlyContinue
}
