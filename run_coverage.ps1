# Beidar Go Coverage Reporting Script
param(
    [switch]$E2E
)

if ($E2E) {
    Write-Host "Running E2E coverage across the core business layers..." -ForegroundColor Cyan
    go test `
        '-coverpkg=./internal/handlers,./internal/network,./internal/repository,./internal/service,./internal/core/domain' `
        -coverprofile e2e.coverage.out `
        -timeout 180s `
        ./internal/e2e/...
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "`nE2E Coverage Summary (layers exercised by the harness):" -ForegroundColor Green
    go tool cover "-func=e2e.coverage.out"
    exit 0
}

Write-Host "Running Go Backend Tests with Coverage..." -ForegroundColor Cyan

# Run tests and generate profile
go test -coverprofile coverage.out ./internal/... ./pkg/...

if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests failed! Coverage report not generated." -ForegroundColor Red
    exit $LASTEXITCODE
}

# Generate HTML report
go tool cover "-html=coverage.out" -o coverage.html

# Display text summary
Write-Host "`nCoverage Summary:" -ForegroundColor Green
go tool cover "-func=coverage.out"

Write-Host "`nE2E coverage: run '.\run_coverage.ps1 -E2E'" -ForegroundColor Yellow
Write-Host "HTML coverage report generated at coverage.html" -ForegroundColor Green
