<#
.SYNOPSIS
Builds the public UMLS concept cache used by i-CLASSi.

.EXAMPLE
.\scripts\build-umls-cache.ps1 `
  -ApiKey "YOUR_UMLS_API_KEY" `
  -ClassificationPath "iclassi/versions/0.1.0-beta/iclassi.json" `
  -MappingPath "iclassi/versions/0.1.0-beta/iclassi_mapping.json"

Builds the cache from the i-CLASSi 0.1.0 beta classification and mapping files.
#>

param(
  [string]$ApiKey = $env:UMLS_API_KEY,
  [string]$ClassificationPath = "iclassi/iclassi.json",
  [string]$MappingPath = "iclassi/iclassi_mapping.json",
  [string]$OutputPath = "iclassi/umls_concepts.json",
  [string]$UmlsVersion = "2026AA",
  [string[]]$PublicUmlsSources = @("MSH", "NCI", "HPO", "MEDLINEPLUS", "ORPHANET", "PDQ"),
  [int]$MaxPublicAtomsPerConcept = 50,
  [string[]]$AdditionalCuis = @(),
  [string[]]$SearchTerms = @(),
  [int]$DelayMilliseconds = 150,
  [switch]$DebugUri,
  [switch]$StopOnMissingConcept
)

if (-not $ApiKey) {
  throw "Provide a UMLS API key with -ApiKey or set the UMLS_API_KEY environment variable."
}
$ApiKey = $ApiKey.Trim()

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing input file: $Path"
  }
  return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
}

function Is-Cui {
  param([string]$Value)
  return $Value -match '^C\d{7}$'
}

function Add-EntityCui {
  param(
    [hashtable]$EntityConcepts,
    [string]$Lnic,
    [string]$Cui
  )
  if (-not $Lnic -or -not (Is-Cui $Cui)) {
    return
  }
  if (-not $EntityConcepts.ContainsKey($Lnic)) {
    $EntityConcepts[$Lnic] = [System.Collections.Generic.List[string]]::new()
  }
  if (-not $EntityConcepts[$Lnic].Contains($Cui)) {
    $EntityConcepts[$Lnic].Add($Cui)
  }
}

function Get-HttpStatusCode {
  param($ErrorRecord)
  if ($ErrorRecord.Exception.Response) {
    return [int]$ErrorRecord.Exception.Response.StatusCode
  }
  return $null
}

function Invoke-Umls {
  param(
    [string]$Path,
    [hashtable]$Query = @{}
  )

  $queryParts = [System.Collections.Generic.List[string]]::new()
  foreach ($item in $Query.GetEnumerator()) {
    if ($null -ne $item.Value -and "$($item.Value)" -ne "") {
      $queryParts.Add(("{0}={1}" -f [uri]::EscapeDataString($item.Key), [uri]::EscapeDataString("$($item.Value)")))
    }
  }
  $queryParts.Add(("apiKey={0}" -f [uri]::EscapeDataString($ApiKey)))
  $uri = "https://uts-ws.nlm.nih.gov/rest/$($Path)?$($queryParts -join '&')"
  if ($DebugUri) {
    Write-Host ($uri -replace 'apiKey=[^&]+', 'apiKey=REDACTED')
  }
  try {
    return Invoke-RestMethod -Uri $uri -Method Get
  } catch {
    $statusCode = $null
    if ($_.Exception.Response) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($statusCode -eq 401) {
      throw "UMLS authentication failed with HTTP 401. Check that the API key is copied from your UTS profile, active, and passed without placeholder text or extra characters."
    }
    throw
  }
}

function Invoke-UmlsPagedResults {
  param(
    [string]$Path,
    [hashtable]$Query = @{},
    [int]$PageSize = 100
  )

  $allResults = @()
  $pageNumber = 1
  $pageCount = 1
  do {
    $pagedQuery = @{}
    foreach ($item in $Query.GetEnumerator()) {
      $pagedQuery[$item.Key] = $item.Value
    }
    $pagedQuery["pageSize"] = "$PageSize"
    $pagedQuery["pageNumber"] = "$pageNumber"

    $response = Invoke-Umls -Path $Path -Query $pagedQuery
    if ($response.result) {
      $allResults += @($response.result)
    }
    if ($response.pageCount) {
      $pageCount = [int]$response.pageCount
    }
    $pageNumber++
    Start-Sleep -Milliseconds $DelayMilliseconds
  } while ($pageNumber -le $pageCount)

  return $allResults
}

function Get-UmlsCodeId {
  param([string]$CodeUri)
  if (-not $CodeUri) {
    return $null
  }
  $lastSegment = ($CodeUri -split '/')[-1]
  return [uri]::UnescapeDataString($lastSegment)
}

function Normalize-SourceList {
  param([string[]]$Sources)
  return @($Sources | ForEach-Object { $_.Trim().ToUpperInvariant() } | Where-Object { $_ } | Sort-Object -Unique)
}

$PublicUmlsSources = Normalize-SourceList -Sources $PublicUmlsSources
$publicUmlsSourceSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$PublicUmlsSources)

function Test-PublicUmlsSource {
  param(
    [string]$RootSource,
    [System.Collections.Generic.HashSet[string]]$PublicSourceSet
  )

  if (-not $RootSource) {
    return $false
  }
  return $PublicSourceSet.Contains($RootSource)
}

function Get-UmlsDefinitions {
  param(
    [string]$Cui,
    [string]$UmlsVersion,
    [System.Collections.Generic.HashSet[string]]$PublicSourceSet
  )

  $definitions = [System.Collections.Generic.List[object]]::new()
  $seenDefinitions = [System.Collections.Generic.HashSet[string]]::new()
  $skippedSources = @{}

  try {
    $definitionResults = Invoke-UmlsPagedResults -Path "content/$UmlsVersion/CUI/$Cui/definitions" -PageSize 100
    foreach ($definition in $definitionResults) {
      $rootSource = "$($definition.rootSource)".Trim().ToUpperInvariant()
      if (-not $rootSource) {
        continue
      }
      if (-not (Test-PublicUmlsSource -RootSource $rootSource -PublicSourceSet $PublicSourceSet)) {
        $skippedSources[$rootSource] = "not in public UMLS source allowlist"
        continue
      }
      $definitionKey = "$rootSource|$($definition.value)"
      if ($seenDefinitions.Contains($definitionKey)) {
        continue
      }
      $definitions.Add([ordered]@{
        rootSource = $rootSource
        sourceIdentifier = $definition.sourceIdentifier
        value = $definition.value
        umlsVersion = $UmlsVersion
      })
      [void]$seenDefinitions.Add($definitionKey)
    }
    if ($skippedSources.Count -gt 0) {
      $skippedSummary = @($skippedSources.GetEnumerator() |
        Sort-Object Name |
        ForEach-Object { "$($_.Key) ($($_.Value))" }) -join ', '
      Write-Host "  Skipped non-public/restricted definition source(s) for ${Cui}: $skippedSummary"
    }
  } catch {
    if ($_.Exception.Message -match 'UMLS authentication failed') {
      throw
    }
    $statusCode = Get-HttpStatusCode -ErrorRecord $_
    if ($statusCode -eq 404) {
      Write-Host "  No definitions endpoint for $Cui."
    } else {
      Write-Warning "Failed to fetch definitions for ${Cui}: $($_.Exception.Message)"
    }
  }

  return [object[]]$definitions.ToArray()
}

function Get-UmlsPublicAtoms {
  param(
    [string]$Cui,
    [string]$UmlsVersion,
    [System.Collections.Generic.HashSet[string]]$PublicSourceSet,
    [int]$MaxAtoms
  )

  $atoms = [System.Collections.Generic.List[object]]::new()
  $seenAtoms = [System.Collections.Generic.HashSet[string]]::new()
  $skippedSources = @{}

  try {
    $atomResults = Invoke-UmlsPagedResults -Path "content/$UmlsVersion/CUI/$Cui/atoms" -PageSize 100
    foreach ($atom in $atomResults) {
      if ($atoms.Count -ge $MaxAtoms) {
        break
      }
      $rootSource = "$($atom.rootSource)".Trim().ToUpperInvariant()
      if (-not (Test-PublicUmlsSource -RootSource $rootSource -PublicSourceSet $PublicSourceSet)) {
        if ($rootSource) {
          $skippedSources[$rootSource] = "not in public UMLS source allowlist"
        }
        continue
      }
      $aui = "$($atom.ui)".Trim()
      $atomKey = "$rootSource|$aui|$($atom.name)"
      if ($seenAtoms.Contains($atomKey)) {
        continue
      }
      $atoms.Add([ordered]@{
        cui = $Cui
        aui = $aui
        name = $atom.name
        rootSource = $rootSource
        termType = $atom.termType
        sourceCode = Get-UmlsCodeId -CodeUri $atom.code
        umlsVersion = $UmlsVersion
      })
      [void]$seenAtoms.Add($atomKey)
    }
    if ($skippedSources.Count -gt 0) {
      $skippedSummary = @($skippedSources.GetEnumerator() |
        Sort-Object Name |
        ForEach-Object { "$($_.Key) ($($_.Value))" }) -join ', '
      Write-Host "  Skipped non-public/restricted atom source(s) for ${Cui}: $skippedSummary"
    }
  } catch {
    if ($_.Exception.Message -match 'UMLS authentication failed') {
      throw
    }
    $statusCode = Get-HttpStatusCode -ErrorRecord $_
    if ($statusCode -eq 404) {
      Write-Host "  No atoms endpoint for $Cui."
    } else {
      Write-Warning "Failed to fetch public atoms for ${Cui}: $($_.Exception.Message)"
    }
  }

  return [object[]]$atoms.ToArray()
}

Write-Host "Validating UMLS API key..."
$null = Invoke-Umls -Path "content/$UmlsVersion/CUI/C0009044"
Write-Host "UMLS API key accepted."

$classificationRows = Read-JsonFile -Path $ClassificationPath
$mappingRows = Read-JsonFile -Path $MappingPath

$entityConcepts = @{}
$cuiPreferredNames = @{}
$allCuis = [System.Collections.Generic.HashSet[string]]::new()

foreach ($row in $mappingRows) {
  if ($row.Vocabulary -eq "UMLS CUI" -and (Is-Cui $row.Code)) {
    [void]$allCuis.Add($row.Code)
    Add-EntityCui -EntityConcepts $entityConcepts -Lnic $row.'LNIC Code' -Cui $row.Code
    if (-not $cuiPreferredNames.ContainsKey($row.Code)) {
      $cuiPreferredNames[$row.Code] = [System.Collections.Generic.List[string]]::new()
    }
    $preferredName = $row.'Vocabulary Prefered Name'
    if ($preferredName -and -not $cuiPreferredNames[$row.Code].Contains($preferredName)) {
      $cuiPreferredNames[$row.Code].Add($preferredName)
    }
  }
}

foreach ($row in $classificationRows) {
  $lnic = $row.'LNIC Code'
  foreach ($property in $row.PSObject.Properties) {
    if ($property.Name -match 'UMLS|CUI') {
      $tokens = "$($property.Value)" -split '[,;|\s]+'
      foreach ($token in $tokens) {
        $candidate = $token.Trim()
        if (Is-Cui $candidate) {
          [void]$allCuis.Add($candidate)
          Add-EntityCui -EntityConcepts $entityConcepts -Lnic $lnic -Cui $candidate
        }
      }
    }
  }
}

foreach ($cui in $AdditionalCuis) {
  $candidate = $cui.Trim()
  if (Is-Cui $candidate) {
    [void]$allCuis.Add($candidate)
  } else {
    Write-Warning "Skipping invalid additional CUI: $cui"
  }
}

if ($SearchTerms.Count -gt 0) {
  Write-Warning "-SearchTerms is ignored for the UMLS definition cache. Add reviewed CUIs through the mapping file or -AdditionalCuis."
}

$concepts = @{}
$index = 0
foreach ($cui in ($allCuis | Sort-Object)) {
  $index++
  Write-Host "[$index/$($allCuis.Count)] Fetching $cui"
  $conceptResponse = $null
  try {
    $conceptResponse = Invoke-Umls -Path "content/$UmlsVersion/CUI/$cui"
    Start-Sleep -Milliseconds $DelayMilliseconds
  } catch {
    if ($_.Exception.Message -match 'UMLS authentication failed') {
      throw
    }
    $statusCode = Get-HttpStatusCode -ErrorRecord $_
    if ($statusCode -eq 404) {
      $fallbackNames = @()
      if ($cuiPreferredNames.ContainsKey($cui)) {
        $fallbackNames = @($cuiPreferredNames[$cui] | Sort-Object)
      }
      $fallbackName = if ($fallbackNames.Count -gt 0) { $fallbackNames[0] } else { $null }
      $message = "UMLS CUI $cui was not found in UMLS version '$UmlsVersion'."
      if ($StopOnMissingConcept) {
        throw "$message Check whether the CUI is retired, version-specific, or mistyped."
      }
      Write-Warning "$message Keeping the mapped CUI with local mapping metadata."
      $concepts[$cui] = [ordered]@{
        ui = $cui
        name = $fallbackName
        status = "not_found"
        notFound = $true
        umlsVersion = $UmlsVersion
        definitions = [object[]]@()
        atoms = [object[]]@()
      }
      continue
    }
    Write-Warning "Failed to fetch ${cui}: $($_.Exception.Message)"
    $concepts[$cui] = [ordered]@{
      ui = $cui
      name = $null
      status = "unavailable"
      umlsVersion = $UmlsVersion
      definitions = [object[]]@()
      atoms = [object[]]@()
    }
    continue
  }

  $concept = $conceptResponse.result
  $definitions = [object[]]@()
  if ($concept.definitions -and $concept.definitions -ne "NONE") {
    $definitions = [object[]]@(Get-UmlsDefinitions -Cui $cui -UmlsVersion $UmlsVersion `
      -PublicSourceSet $publicUmlsSourceSet)
  }

  $atoms = [object[]]@()
  if ($concept.atoms -and $concept.atoms -ne "NONE" -and $MaxPublicAtomsPerConcept -gt 0) {
    $atoms = [object[]]@(Get-UmlsPublicAtoms -Cui $cui -UmlsVersion $UmlsVersion `
      -PublicSourceSet $publicUmlsSourceSet `
      -MaxAtoms $MaxPublicAtomsPerConcept)
  }

  $concepts[$cui] = [ordered]@{
    ui = $concept.ui
    name = $concept.name
    definitions = [object[]]@($definitions)
    atoms = [object[]]@($atoms)
  }
}

$serializableEntityConcepts = [ordered]@{}
foreach ($key in ($entityConcepts.Keys | Sort-Object)) {
  $serializableEntityConcepts[$key] = @($entityConcepts[$key] | Sort-Object)
}

$payload = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  umlsVersion = $UmlsVersion
  source = "Public UMLS cache generated from $ClassificationPath and $MappingPath"
  publicContentPolicy = "Public UMLS content is limited to selected CUI, AUI, names, term metadata, source codes, and source-attributed definitions from MSH, NCI, HPO, MEDLINEPLUS, ORPHANET, and PDQ. Category 3/restricted sources are excluded from the public cache."
  publicSources = $PublicUmlsSources
  maxPublicAtomsPerConcept = $MaxPublicAtomsPerConcept
  representedSources = @($concepts.Values |
    ForEach-Object { @($_.definitions) + @($_.atoms) } |
    ForEach-Object { $_.rootSource } |
    Where-Object { $_ } |
    Sort-Object -Unique)
  conceptCount = $concepts.Count
  entityConcepts = $serializableEntityConcepts
  concepts = $concepts
}

$json = $payload | ConvertTo-Json -Depth 12
Set-Content -LiteralPath $OutputPath -Value $json -Encoding UTF8
Write-Host "Wrote $OutputPath with $($concepts.Count) UMLS concept(s)."
