Write-Host "=== Core Tool Package Install ===" -ForegroundColor Cyan

$uv = Get-Command uv -ErrorAction SilentlyContinue
if (-not $uv) {
    Write-Host "Installing uv via WinGet..." -ForegroundColor Yellow
    winget install astral-sh.uv --accept-package-agreements --accept-source-agreements
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";" + $env:PATH
    $uv = Get-Command uv -ErrorAction SilentlyContinue
    if (-not $uv) {
        Write-Host "uv install failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "uv OK" -ForegroundColor Green

$venvPath = Join-Path $PSScriptRoot ".venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "Creating venv (Python 3.12)..." -ForegroundColor Yellow
    uv venv $venvPath --python 3.12
} else {
    Write-Host "venv exists" -ForegroundColor Green
}

& "$venvPath\Scripts\Activate.ps1"

$reqFile = Join-Path $PSScriptRoot "requirements-core.txt"
Write-Host "Installing packages..." -ForegroundColor Yellow
uv pip install -r $reqFile

Write-Host "`n=== Verify ===" -ForegroundColor Cyan
$packages = @("docx", "openpyxl", "pptx", "pypdf", "fitz", "reportlab", "PIL", "matplotlib", "qrcode", "markitdown")
$names = @("python-docx", "openpyxl", "python-pptx", "pypdf", "PyMuPDF", "reportlab", "pillow", "matplotlib", "qrcode", "markitdown")
$ok = 0; $fail = 0
for ($i = 0; $i -lt $packages.Count; $i++) {
    $r = python -c "import $($packages[$i])" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK: $($names[$i])" -ForegroundColor Green
        $ok++
    } else {
        Write-Host "  FAIL: $($names[$i])" -ForegroundColor Red
        $fail++
    }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "venv: $venvPath"
Write-Host "Packages: $ok/$($ok+$fail) OK"