param(
  [string]$ApiKey = $env:UMLS_API_KEY,
  [string]$ClassificationPath = "iclassi/iclassi.json",
  [string]$MappingPath = "iclassi/iclassi_mapping.json",
  [string]$OutputPath = "iclassi/umls_concepts.json",
  [string]$UmlsVersion = "current",
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

foreach ($term in $SearchTerms) {
  $query = $term.Trim()
  if (-not $query) {
    continue
  }
  Write-Host "Searching UMLS for '$query'..."
  try {
    $searchResponse = Invoke-Umls -Path "search/$UmlsVersion" -Query @{
      string = $query
      searchType = "words"
      semanticGroups = "Disorders"
      pageSize = "25"
    }
    $matches = @($searchResponse.result.results | Where-Object { Is-Cui $_.ui })
    foreach ($match in $matches) {
      [void]$allCuis.Add($match.ui)
    }
    Write-Host "  Added $($matches.Count) CUI candidate(s) from search."
  } catch {
    Write-Warning "Search failed for '$query': $($_.Exception.Message)"
  }
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
        error = $_.Exception.Message
        mappingPreferredNames = $fallbackNames
        semanticTypes = @()
        definitions = @()
      }
      continue
    }
    Write-Warning "Failed to fetch ${cui}: $($_.Exception.Message)"
    $concepts[$cui] = [ordered]@{
      ui = $cui
      name = $null
      error = $_.Exception.Message
      semanticTypes = @()
      definitions = @()
    }
    continue
  }

  $concept = $conceptResponse.result
  $definitions = @()
  if ($concept.definitions -and $concept.definitions -ne "NONE") {
    try {
      $definitionResults = Invoke-UmlsPagedResults -Path "content/$UmlsVersion/CUI/$cui/definitions" -PageSize 100
      $definitions = @($definitionResults | ForEach-Object {
        [ordered]@{
          rootSource = $_.rootSource
          value = $_.value
        }
      })
    } catch {
      if ($_.Exception.Message -match 'UMLS authentication failed') {
        throw
      }
      $statusCode = Get-HttpStatusCode -ErrorRecord $_
      if ($statusCode -eq 404) {
        Write-Host "  No definitions endpoint for $cui."
      } else {
        Write-Warning "Failed to fetch definitions for ${cui}: $($_.Exception.Message)"
      }
    }
  }

  $atoms = @()
  if ($concept.atoms -and $concept.atoms -ne "NONE") {
    try {
      $atomResults = Invoke-UmlsPagedResults -Path "content/$UmlsVersion/CUI/$cui/atoms" -PageSize 100
      $atoms = @($atomResults | ForEach-Object {
        [ordered]@{
          name = $_.name
          aui = $_.ui
          vocabulary = $_.rootSource
          termType = $_.termType
          code = Get-UmlsCodeId -CodeUri $_.code
          codeUri = $_.code
          suppressible = $_.suppressible
          obsolete = $_.obsolete
          language = $_.language
        }
      })
    } catch {
      if ($_.Exception.Message -match 'UMLS authentication failed') {
        throw
      }
      Write-Warning "Failed to fetch atoms for ${cui}: $($_.Exception.Message)"
    }
  }

  $concepts[$cui] = [ordered]@{
    ui = $concept.ui
    name = $concept.name
    status = $concept.status
    semanticTypes = @($concept.semanticTypes | ForEach-Object { $_.name })
    atomCount = $concept.atomCount
    relationCount = $concept.relationCount
    attributeCount = $concept.attributeCount
    majorRevisionDate = $concept.majorRevisionDate
    dateAdded = $concept.dateAdded
    definitions = $definitions
    atoms = $atoms
  }
}

$serializableEntityConcepts = [ordered]@{}
foreach ($key in ($entityConcepts.Keys | Sort-Object)) {
  $serializableEntityConcepts[$key] = @($entityConcepts[$key] | Sort-Object)
}

$payload = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  umlsVersion = $UmlsVersion
  source = "Generated from $ClassificationPath and $MappingPath"
  conceptCount = $concepts.Count
  entityConcepts = $serializableEntityConcepts
  concepts = $concepts
}

$json = $payload | ConvertTo-Json -Depth 12
Set-Content -LiteralPath $OutputPath -Value $json -Encoding UTF8
Write-Host "Wrote $OutputPath with $($concepts.Count) UMLS concept(s)."
