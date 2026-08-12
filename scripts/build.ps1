<#
.SYNOPSIS
Builds the Beidar POS application using Wails, injecting Supabase secrets and version information via ldflags.

.DESCRIPTION
This script automates the build process. It reads the application version from wails.json
and the Supabase configuration from frontend/.env (or root .env) and injects them at build
time so the resulting executable can connect to the Cloud without requiring end-users to
configure environment variables.

.PARAMETER Installer
Creates an NSIS installer instead of just the raw executable. Defaults to true.
#>

param (
    [switch]$Installer = $true
)

$ErrorActionPreference = "Stop"

# Ensure we are in the project root
$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $rootDir

Write-Host "🚀 Starting Beidar Build Process..." -ForegroundColor Cyan

# 1. Read Version from wails.json
$version = "unknown"
if (Test-Path "wails.json") {
    $wailsData = Get-Content "wails.json" -Raw | ConvertFrom-Json
    if ($wailsData.info.productVersion) {
        $version = $wailsData.info.productVersion
    }
}
Write-Host "📦 Version: $version" -ForegroundColor Green

# 2. Extract Supabase Secrets from frontend/.env or .env
$supabaseUrl = ""
$supabaseKey = ""

function Get-EnvValue {
    param([string]$FilePath, [string]$Key)
    if (Test-Path $FilePath) {
        $content = Get-Content $FilePath
        foreach ($line in $content) {
            if ($line -match "^$Key=(.*)$") {
                return $matches[1].Trim("`"","'")
            }
        }
    }
    return ""
}

# Try frontend/.env first, then root .env
$supabaseUrl = Get-EnvValue "frontend\.env" "VITE_SUPABASE_URL"
if (-not $supabaseUrl) { $supabaseUrl = Get-EnvValue ".env" "VITE_SUPABASE_URL" }
if (-not $supabaseUrl) { $supabaseUrl = Get-EnvValue ".env" "SUPABASE_URL" }

$supabaseKey = Get-EnvValue "frontend\.env" "VITE_SUPABASE_ANON_KEY"
if (-not $supabaseKey) { $supabaseKey = Get-EnvValue ".env" "VITE_SUPABASE_ANON_KEY" }
if (-not $supabaseKey) { $supabaseKey = Get-EnvValue ".env" "SUPABASE_ANON_KEY" }

if (-not $supabaseUrl -or -not $supabaseKey) {
    Write-Host "⚠️ Warning: Supabase credentials not found in frontend/.env or .env" -ForegroundColor Yellow
} else {
    Write-Host "☁️ Found Supabase credentials to inject." -ForegroundColor Green
}

# 3. Construct ldflags
$ldflags = ""
if ($version -ne "unknown") {
    $ldflags += "-X 'beidar-desktop/pkg/updater.CurrentVersion=$version' "
    $ldflags += "-X 'beidar-desktop/pkg/crashreporter.AppVersion=$version' "
}
if ($supabaseUrl -and $supabaseKey) {
    $ldflags += "-X 'beidar-desktop/internal/integration.supabaseURL=$supabaseUrl' "
    $ldflags += "-X 'beidar-desktop/internal/integration.supabaseKey=$supabaseKey' "
}

$ldflags = $ldflags.Trim()

# 4. Build Command
$buildCmd = "wails build -clean -platform windows/amd64"
if ($Installer) {
    $buildCmd += " -nsis"
}
if ($ldflags) {
    $buildCmd += " -ldflags `"$ldflags`""
}

Write-Host "🔨 Executing: $buildCmd" -ForegroundColor Cyan

# Execute using Invoke-Expression
Invoke-Expression $buildCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
