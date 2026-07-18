# Beidar Go Coverage Reporting Script
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

Write-Host "`nHTML coverage report generated at coverage.html" -ForegroundColor Green
