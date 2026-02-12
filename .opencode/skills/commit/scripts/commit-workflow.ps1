# Commit Message Workflow - PowerShell
# Non-interactive, AI-friendly. Lint/test/build checks ARE the verification gate.
# If checks pass -> commit proceeds automatically. No human prompts.
param(
    [Parameter(Mandatory = $true)]
    [string]$MessageFile,
    [ValidateSet("all", "staged")]
    [string]$Mode = "staged",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Label,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    Write-Host "   $Label" -ForegroundColor Gray
    & $Command
    if ($LASTEXITCODE -ne 0) {
        Write-Host "BLOCKED: $Label failed - commit aborted" -ForegroundColor Red
        exit 1
    }
    Write-Host "   OK" -ForegroundColor Green
}

Write-Host "Git Commit Workflow" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Safety: no reset/clean/force-push operations are used by this workflow." -ForegroundColor Gray

# 1. Verify Git Repository
Write-Host "`n1. Verifying git repository..." -ForegroundColor Yellow
try {
    $gitStatus = & git status --porcelain 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Not in a git repository" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# 2. Verify Message File Exists
Write-Host "`n2. Checking commit message file..." -ForegroundColor Yellow
if (-not (Test-Path $MessageFile)) {
    Write-Host "Error: Message file not found: $MessageFile" -ForegroundColor Red
    exit 1
}

$message = Get-Content $MessageFile -Raw -Encoding UTF8
if (-not $message) {
    Write-Host "Error: Message file is empty: $MessageFile" -ForegroundColor Red
    exit 1
}

$fileLen = (Get-Item $MessageFile).Length
$okMsg = '   OK (' + $fileLen + ' bytes)'
Write-Host $okMsg -ForegroundColor Green

# 3. Display Current Status
Write-Host "`n3. Current git status..." -ForegroundColor Yellow
$statusOutput = & git status --short
if (-not $statusOutput) {
    Write-Host "   No changes to commit" -ForegroundColor Yellow
    exit 0
}
Write-Host $statusOutput
$changeCount = @($statusOutput -split "`n").Count
Write-Host "   Total: $changeCount file(s)" -ForegroundColor Gray

# 4. Handle Staging Based on Mode
Write-Host "`n4. Staging changes (mode: $Mode)..." -ForegroundColor Yellow

if ($Mode -eq "all") {
    Write-Host "   Staging all changes"
    if (-not $DryRun) {
        & git add --all
        Write-Host "   OK" -ForegroundColor Green
    }
}
elseif ($Mode -eq "staged") {
    Write-Host "   Using already-staged changes only"
    $stagedStatus = & git diff --cached --name-only
    if (-not $stagedStatus) {
        Write-Host "   No staged changes found" -ForegroundColor Yellow
        exit 0
    }
}

# 5. Verification gate - OpenWhispr checks
Write-Host "`n5. Verification gate..." -ForegroundColor Yellow
$repoRoot = (& git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
    Write-Host "Error: Unable to resolve repo root" -ForegroundColor Red
    exit 1
}

Push-Location $repoRoot
Invoke-CheckedCommand "Lint (npm run lint)" { npm run lint }
Invoke-CheckedCommand "Tests (npm run test)" { npm run test }
Invoke-CheckedCommand "Renderer build (npm run build:renderer)" { npm run build:renderer }
Pop-Location

$stagedFiles = & git diff --cached --name-only
if ($stagedFiles -match '(^|[\\/])\.env($|\.|[\\/])') {
    Write-Host "BLOCKED: .env-like files are staged. Remove secrets before commit." -ForegroundColor Red
    exit 1
}

Write-Host "   Verification gate passed" -ForegroundColor Green

# 6. Commit message preview (log only, no prompt)
Write-Host "`n6. Commit message preview..." -ForegroundColor Yellow
$lines = $message -split "`n" | Select-Object -First 5
foreach ($line in $lines) {
    Write-Host "   $line" -ForegroundColor Gray
}
if (($message -split "`n").Count -gt 5) {
    Write-Host "   ..." -ForegroundColor Gray
}

# 7. Perform Commit
Write-Host "`n7. Creating local commit..." -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "   [DRY RUN] Would run: git commit -F $MessageFile"
}
else {
    try {
        & git commit -F $MessageFile
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Commit failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "   OK" -ForegroundColor Green
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
        exit 1
    }
}

# 8. Final Status
Write-Host "`n8. Final status..." -ForegroundColor Yellow
$lastCommit = & git log --oneline -1
Write-Host "   Last commit: $lastCommit" -ForegroundColor Green

$remainingChanges = & git status --short
if ($remainingChanges) {
    Write-Host "   Remaining changes:" -ForegroundColor Yellow
    Write-Host $remainingChanges
}
else {
    Write-Host "   Clean working tree" -ForegroundColor Green
}

Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "Done. Never pushes to origin." -ForegroundColor Cyan
