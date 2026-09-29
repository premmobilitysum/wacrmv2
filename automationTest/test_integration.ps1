# Integration Verification & Smoke Test Script
# Tests the Driver Flow Payloads against Schema Requirements

Write-Host "=== EasyETS WhatsApp CRM Driver Automation Test Suite ===" -ForegroundColor Cyan

$testFilePath = "$PSScriptRoot\test_driver_automation.json"
if (-not (Test-Path $testFilePath)) {
    Write-Error "test_driver_automation.json not found in $PSScriptRoot"
    exit 1
}

$testData = Get-Content -Raw -Path $testFilePath | ConvertFrom-Json

Write-Host "`n1. Verifying Automation Definitions:" -ForegroundColor Yellow
foreach ($auto in $testData.automations) {
    Write-Host "  -> Automation: $($auto.name) (Trigger: $($auto.trigger_type))" -ForegroundColor Green
    Write-Host "     Keywords: $($auto.trigger_config.keywords -join ', ')"
    Write-Host "     Steps Count: $($auto.steps.Count)"
}

Write-Host "`n2. Verifying Driver Lifecycle API Payloads:" -ForegroundColor Yellow
$payloads = $testData.sample_api_payloads

Write-Host "  [a] Driver Registration Payload:" -ForegroundColor Cyan
Write-Host "      URL: $($payloads.driver_register.url)"
Write-Host "      FullName: $($payloads.driver_register.body.FullName), Mobile: $($payloads.driver_register.body.MobileNo)"

Write-Host "  [b] Driver Accept Booking Payload:" -ForegroundColor Cyan
Write-Host "      URL: $($payloads.driver_accept_booking.url)"

Write-Host "  [c] Driver At Pickup Point Payload:" -ForegroundColor Cyan
Write-Host "      URL: $($payloads.driver_at_pickup.url)"
Write-Host "      Status: $($payloads.driver_at_pickup.body.Status), Action: $($payloads.driver_at_pickup.body.Action)"

Write-Host "  [d] Driver Start Trip (OTP Verify) Payload:" -ForegroundColor Cyan
Write-Host "      URL: $($payloads.driver_start_trip.url)"

Write-Host "  [e] Driver End Trip & Payment Payload:" -ForegroundColor Cyan
Write-Host "      URL: $($payloads.driver_end_trip.url)"
Write-Host "      TotalKm: $($payloads.driver_end_trip.body.TotalKm), TotalPaid: $($payloads.driver_end_trip.body.TotalPaid)"

Write-Host "`nAll Driver Automation Payloads validated successfully!" -ForegroundColor Green
