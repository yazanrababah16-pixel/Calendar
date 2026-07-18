param(
  [string]$N8nUrl = "http://localhost:5678",
  [string]$Email = "admin@clinic.com",
  [string]$Password = "Admin123!"
)

Write-Host "=== N8N Setup Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if n8n is running
try {
  $health = Invoke-WebRequest -Uri "$N8nUrl/healthz" -UseBasicParsing -TimeoutSec 5
  Write-Host "✓ n8n is running (HTTP $($health.StatusCode))" -ForegroundColor Green
} catch {
  Write-Host "✗ n8n is not running at $N8nUrl" -ForegroundColor Red
  exit 1
}

# Step 1: Set up owner account
Write-Host ""
Write-Host "Setting up owner account..." -ForegroundColor Yellow

$ownerBody = @{
  email     = $Email
  firstName = "Admin"
  lastName  = "Clinic"
  password  = $Password
} | ConvertTo-Json

try {
  $response = Invoke-WebRequest -Uri "$N8nUrl/rest/owner/setup" -Method POST `
    -ContentType "application/json" -Body $ownerBody -UseBasicParsing -SessionVariable session -TimeoutSec 10
  $owner = $response.Content | ConvertFrom-Json
  $userId = $owner.data.id
  Write-Host "✓ Owner created: $userId" -ForegroundColor Green

  # Complete personalization
  $personalization = @{ personalizationAnswers = @{ companyIndustry = "medical"; companySize = "20" } } | ConvertTo-Json
  Invoke-WebRequest -Uri "$N8nUrl/rest/me" -Method PATCH -ContentType "application/json" `
    -Body $personalization -UseBasicParsing -WebSession $session -TimeoutSec 5 | Out-Null
  Write-Host "✓ Owner setup complete" -ForegroundColor Green
} catch {
  Write-Host "Owner setup may have already been done (or error): $_" -ForegroundColor Yellow
  # Try to get the owner ID from existing users
  try {
    $users = Invoke-WebRequest -Uri "$N8nUrl/rest/users" -UseBasicParsing -WebSession $session -TimeoutSec 5
    $userId = ($users.Content | ConvertFrom-Json).data[0].id
    Write-Host "✓ Found existing user: $userId" -ForegroundColor Green
  } catch {
    Write-Host "Could not determine user ID. Try importing manually." -ForegroundColor Red
    exit 1
  }
}

# Step 2: Import workflows
Write-Host ""
Write-Host "Importing workflows..." -ForegroundColor Yellow

$workflows = @(
  @{ file = "appointment-reminder.json" }
  @{ file = "follow-up.json" }
)

foreach ($wf in $workflows) {
  $localPath = Join-Path $PSScriptRoot "workflows" $wf.file
  if (-not (Test-Path $localPath)) {
    Write-Host "  ✗ $($wf.file) not found" -ForegroundColor Red
    continue
  }

  docker cp $localPath "docker-n8n-1:/tmp/$($wf.file)" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Failed to copy $($wf.file) to container" -ForegroundColor Red
    continue
  }

  $result = docker exec docker-n8n-1 sh -c "n8n import:workflow --input=/tmp/$($wf.file) --userId=$userId 2>&1"
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Imported $($wf.file)" -ForegroundColor Green
  } else {
    Write-Host "  ⚠ Import $($wf.file) had warnings (may still work)" -ForegroundColor Yellow
    $result | Select-String -NotMatch "Permissions|tracking|deprecation|credential" | ForEach-Object { Write-Host "    $_" }
  }
}

Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Cyan
Write-Host "Open http://localhost:5678 to manage workflows"
Write-Host "Webhook URLs:"
Write-Host "  POST http://localhost:5678/webhook/appointment-reminder"
Write-Host "  POST http://localhost:5678/webhook/follow-up"
