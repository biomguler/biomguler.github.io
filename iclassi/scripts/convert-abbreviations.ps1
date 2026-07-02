<#
.SYNOPSIS
Converts an abbreviation CSV export into the versioned i-CLASSi JSON schema.

.NOTES
Deprecated: this script is kept for old one-off abbreviation CSV conversions only.
The normal release workflow now uses iclassi/scripts/json_converter.sh, which creates
the versioned abbreviations.json together with the classification, mapping,
i-GWASdb, and data source JSON files.

.EXAMPLE
.\iclassi\scripts\convert-abbreviations.ps1 `
  -InputPath "C:\path\to\abbreviations.csv" `
  -VersionId "0.1.0-beta"

Expected CSV headers:
abbreviation,full_name,category,status,aliases

Separate multiple aliases with semicolons or vertical bars.
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$VersionId = "0.1.0-beta",
  [string]$OutputPath
)

if (-not (Test-Path -LiteralPath $InputPath)) {
  throw "Missing input CSV file: $InputPath"
}

if (-not $OutputPath) {
  $OutputPath = "iclassi/versions/$VersionId/abbreviations.json"
}

$rows = Import-Csv -LiteralPath $InputPath
$requiredHeaders = @("abbreviation", "full_name", "category", "status", "aliases")
$availableHeaders = @($rows | Select-Object -First 1 | ForEach-Object { $_.PSObject.Properties.Name })
$missingHeaders = @($requiredHeaders | Where-Object { $_ -notin $availableHeaders })

if ($missingHeaders.Count -gt 0) {
  throw "Missing required CSV header(s): $($missingHeaders -join ', ')"
}

$converted = @($rows | ForEach-Object {
  $abbreviation = "$($_.abbreviation)".Trim()
  $fullName = "$($_.full_name)".Trim()
  if (-not $abbreviation -or -not $fullName) {
    Write-Warning "Skipping row without both abbreviation and full_name."
    return
  }

  $aliases = @("$($_.aliases)" -split '[;|]' |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ } |
    Sort-Object -Unique)

  [ordered]@{
    abbreviation = $abbreviation
    full_name = $fullName
    category = "$($_.category)".Trim()
    status = "$($_.status)".Trim()
    aliases = $aliases
  }
})

$duplicates = @($converted |
  Group-Object abbreviation |
  Where-Object Count -gt 1)
if ($duplicates.Count -gt 0) {
  throw "Duplicate canonical abbreviation(s): $($duplicates.Name -join ', ')"
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$converted |
  Sort-Object abbreviation |
  ConvertTo-Json -Depth 5 |
  Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host "Wrote $OutputPath with $($converted.Count) abbreviation record(s)."
