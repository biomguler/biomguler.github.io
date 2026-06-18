#!/usr/bin/env bash

# Builds the public UMLS concept cache used by i-CLASSi.
#
# Requirements:
#   - Bash
#   - curl
#   - jq
#
# Example:
#   bash ./scripts/build-umls-cache.sh \
#     --api-key "YOUR_UMLS_API_KEY" \
#     --classification-path "iclassi/versions/0.1.0-beta/iclassi.json" \
#     --mapping-path "iclassi/versions/0.1.0-beta/iclassi_mapping.json"

set -euo pipefail

api_key="${UMLS_API_KEY:-}"
classification_path="iclassi/iclassi.json"
mapping_path="iclassi/iclassi_mapping.json"
output_path="iclassi/umls_concepts.json"
umls_version="2026AA"
public_sources_csv="MSH,NCI,HPO,MEDLINEPLUS,ORPHANET,PDQ"
max_public_atoms=50
additional_cuis=()
delay_ms=150
debug_uri=false
stop_on_missing=false

usage() {
  cat <<'EOF'
Usage:
  bash ./scripts/build-umls-cache.sh [options]

Options:
  --api-key KEY                 UMLS API key. Defaults to UMLS_API_KEY.
  --classification-path PATH   Classification JSON input.
  --mapping-path PATH          Mapping JSON input.
  --output-path PATH           Generated cache JSON output.
  --umls-version VERSION       UMLS release, such as 2026AA.
  --public-sources CSV         Public source allowlist.
  --max-public-atoms NUMBER    Maximum public atoms per concept.
  --additional-cui CUI         Include an additional CUI. May be repeated.
  --delay-ms NUMBER            Delay between UMLS requests.
  --debug-uri                  Print request URLs with the API key redacted.
  --stop-on-missing-concept    Stop when a CUI returns HTTP 404.
  -h, --help                   Show this help.

Example:
  bash ./scripts/build-umls-cache.sh \
    --api-key "YOUR_UMLS_API_KEY" \
    --classification-path "iclassi/versions/0.1.0-beta/iclassi.json" \
    --mapping-path "iclassi/versions/0.1.0-beta/iclassi_mapping.json"

Safer API-key usage:
  export UMLS_API_KEY="YOUR_UMLS_API_KEY"
  bash ./scripts/build-umls-cache.sh
EOF
}

require_value() {
  if [[ $# -lt 2 || -z "${2:-}" ]]; then
    echo "Missing value for $1." >&2
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key)
      require_value "$@"
      api_key="$2"
      shift 2
      ;;
    --classification-path)
      require_value "$@"
      classification_path="$2"
      shift 2
      ;;
    --mapping-path)
      require_value "$@"
      mapping_path="$2"
      shift 2
      ;;
    --output-path)
      require_value "$@"
      output_path="$2"
      shift 2
      ;;
    --umls-version)
      require_value "$@"
      umls_version="$2"
      shift 2
      ;;
    --public-sources)
      require_value "$@"
      public_sources_csv="$2"
      shift 2
      ;;
    --max-public-atoms)
      require_value "$@"
      max_public_atoms="$2"
      shift 2
      ;;
    --additional-cui)
      require_value "$@"
      additional_cuis+=("$2")
      shift 2
      ;;
    --delay-ms)
      require_value "$@"
      delay_ms="$2"
      shift 2
      ;;
    --debug-uri)
      debug_uri=true
      shift
      ;;
    --stop-on-missing-concept)
      stop_on_missing=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command_name in curl jq; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 1
  fi
done

api_key="$(printf '%s' "$api_key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
if [[ -z "$api_key" ]]; then
  echo "Provide a UMLS API key with --api-key or set UMLS_API_KEY." >&2
  exit 1
fi

if [[ ! -f "$classification_path" ]]; then
  echo "Missing input file: $classification_path" >&2
  exit 1
fi
if [[ ! -f "$mapping_path" ]]; then
  echo "Missing input file: $mapping_path" >&2
  exit 1
fi
if ! [[ "$max_public_atoms" =~ ^[0-9]+$ ]]; then
  echo "--max-public-atoms must be a non-negative integer." >&2
  exit 2
fi
if ! [[ "$delay_ms" =~ ^[0-9]+$ ]]; then
  echo "--delay-ms must be a non-negative integer." >&2
  exit 2
fi

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
mkdir -p "$temp_dir/concepts"

public_sources_json="$(
  printf '%s' "$public_sources_csv" |
    jq -Rc 'split(",") | map(ascii_upcase | gsub("^\\s+|\\s+$"; "")) | map(select(length > 0)) | unique'
)"

url_encode() {
  jq -rn --arg value "$1" '$value | @uri'
}

sleep_between_requests() {
  if [[ "$delay_ms" -gt 0 ]]; then
    sleep "$(awk -v milliseconds="$delay_ms" 'BEGIN { printf "%.3f", milliseconds / 1000 }')"
  fi
}

umls_get() {
  local path="$1"
  shift
  local query=""
  local key
  local value

  while [[ $# -gt 0 ]]; do
    key="$1"
    value="$2"
    shift 2
    if [[ -n "$value" ]]; then
      query+="${query:+&}$(url_encode "$key")=$(url_encode "$value")"
    fi
  done
  local encoded_api_key
  encoded_api_key="$(url_encode "$api_key")"
  query+="${query:+&}apiKey=$encoded_api_key"

  local uri="https://uts-ws.nlm.nih.gov/rest/${path}?${query}"
  local response_file="$temp_dir/response.json"
  if [[ "$debug_uri" == true ]]; then
    printf '%s\n' "${uri/apiKey=$encoded_api_key/apiKey=REDACTED}"
  fi

  UML_STATUS="$(
    curl --silent --show-error \
      --output "$response_file" \
      --write-out '%{http_code}' \
      "$uri"
  )"
  UML_RESPONSE="$response_file"

  if [[ "$UML_STATUS" == "401" ]]; then
    echo "UMLS authentication failed with HTTP 401. Check that the API key is active and contains no extra characters." >&2
    exit 1
  fi
}

fetch_paged_results() {
  local path="$1"
  local output_file="$2"
  local page_number=1
  local page_count=1
  local page_file="$temp_dir/page.json"

  printf '[]\n' > "$output_file"
  while [[ "$page_number" -le "$page_count" ]]; do
    umls_get "$path" pageSize 100 pageNumber "$page_number"
    if [[ "$UML_STATUS" != "200" ]]; then
      return 1
    fi

    jq '.result // []' "$UML_RESPONSE" > "$page_file"
    jq -s '.[0] + .[1]' "$output_file" "$page_file" > "$output_file.next"
    mv "$output_file.next" "$output_file"
    page_count="$(jq -r '.pageCount // 1' "$UML_RESPONSE")"
    page_number=$((page_number + 1))
    sleep_between_requests
  done
}

is_cui() {
  [[ "$1" =~ ^C[0-9]{7}$ ]]
}

all_cuis_file="$temp_dir/all-cuis.txt"
entity_pairs_file="$temp_dir/entity-pairs.tsv"
preferred_names_file="$temp_dir/preferred-names.tsv"
: > "$all_cuis_file"
: > "$entity_pairs_file"
: > "$preferred_names_file"

jq -r '
  .[]
  | select(.Vocabulary == "UMLS CUI")
  | select((.Code // "") | test("^C[0-9]{7}$"))
  | [.["LNIC Code"], .Code, (.["Vocabulary Prefered Name"] // "")]
  | @tsv
' "$mapping_path" |
while IFS=$'\t' read -r lnic cui preferred_name; do
  printf '%s\n' "$cui" >> "$all_cuis_file"
  if [[ -n "$lnic" ]]; then
    printf '%s\t%s\n' "$lnic" "$cui" >> "$entity_pairs_file"
  fi
  if [[ -n "$preferred_name" ]]; then
    printf '%s\t%s\n' "$cui" "$preferred_name" >> "$preferred_names_file"
  fi
done

jq -r '
  .[]
  | . as $row
  | ($row["LNIC Code"] // "") as $lnic
  | to_entries[]
  | select(.key | test("UMLS|CUI"; "i"))
  | (.value // "" | tostring | scan("C[0-9]{7}")) as $cui
  | [$lnic, $cui]
  | @tsv
' "$classification_path" |
while IFS=$'\t' read -r lnic cui; do
  printf '%s\n' "$cui" >> "$all_cuis_file"
  if [[ -n "$lnic" ]]; then
    printf '%s\t%s\n' "$lnic" "$cui" >> "$entity_pairs_file"
  fi
done

for additional_cui in "${additional_cuis[@]}"; do
  additional_cui="$(printf '%s' "$additional_cui" | tr -d '[:space:]')"
  if is_cui "$additional_cui"; then
    printf '%s\n' "$additional_cui" >> "$all_cuis_file"
  else
    echo "WARNING: Skipping invalid additional CUI: $additional_cui" >&2
  fi
done

sort -u "$all_cuis_file" -o "$all_cuis_file"

jq -Rn '
  [inputs | select(length > 0) | split("\t") | {key: .[0], value: .[1]}]
  | group_by(.key)
  | map({key: .[0].key, value: (map(.value) | unique | sort)})
  | from_entries
' < "$entity_pairs_file" > "$temp_dir/entity-concepts.json"

jq -Rn '
  [inputs | select(length > 0) | split("\t") | {key: .[0], value: .[1]}]
  | group_by(.key)
  | map({key: .[0].key, value: (map(.value) | unique | sort)})
  | from_entries
' < "$preferred_names_file" > "$temp_dir/preferred-names.json"

echo "Validating UMLS API key..."
umls_get "content/$umls_version/CUI/C0009044"
if [[ "$UML_STATUS" != "200" ]]; then
  echo "UMLS API validation failed with HTTP $UML_STATUS." >&2
  cat "$UML_RESPONSE" >&2
  exit 1
fi
echo "UMLS API key accepted."

concept_total="$(grep -c . "$all_cuis_file" || true)"
concept_index=0

while IFS= read -r cui; do
  [[ -z "$cui" ]] && continue
  concept_index=$((concept_index + 1))
  echo "[$concept_index/$concept_total] Fetching $cui"

  umls_get "content/$umls_version/CUI/$cui"
  if [[ "$UML_STATUS" == "404" ]]; then
    if [[ "$stop_on_missing" == true ]]; then
      echo "UMLS CUI $cui was not found in UMLS version '$umls_version'." >&2
      exit 1
    fi
    fallback_name="$(jq -r --arg cui "$cui" '.[$cui][0] // empty' "$temp_dir/preferred-names.json")"
    echo "WARNING: UMLS CUI $cui was not found in UMLS version '$umls_version'. Keeping local mapping metadata." >&2
    jq -n \
      --arg ui "$cui" \
      --arg name "$fallback_name" \
      --arg umlsVersion "$umls_version" \
      '{
        ui: $ui,
        name: (if $name == "" then null else $name end),
        status: "not_found",
        notFound: true,
        umlsVersion: $umlsVersion,
        definitions: [],
        atoms: []
      }' > "$temp_dir/concepts/$cui.json"
    continue
  fi
  if [[ "$UML_STATUS" != "200" ]]; then
    echo "WARNING: Failed to fetch $cui: HTTP $UML_STATUS" >&2
    jq -n \
      --arg ui "$cui" \
      --arg umlsVersion "$umls_version" \
      '{ui: $ui, name: null, status: "unavailable", umlsVersion: $umlsVersion, definitions: [], atoms: []}' \
      > "$temp_dir/concepts/$cui.json"
    continue
  fi

  cp "$UML_RESPONSE" "$temp_dir/concept-response.json"
  sleep_between_requests
  printf '[]\n' > "$temp_dir/definitions.json"
  printf '[]\n' > "$temp_dir/atoms.json"

  definitions_uri="$(jq -r '.result.definitions // "NONE"' "$temp_dir/concept-response.json")"
  if [[ "$definitions_uri" != "NONE" ]]; then
    if fetch_paged_results "content/$umls_version/CUI/$cui/definitions" "$temp_dir/raw-definitions.json"; then
      skipped_definitions="$(
        jq -r --argjson sources "$public_sources_json" '
          [.[] | (.rootSource // "" | ascii_upcase)]
          | unique
          | map(select(. as $source | length > 0 and ($sources | index($source) | not)))
          | join(", ")
        ' "$temp_dir/raw-definitions.json"
      )"
      if [[ -n "$skipped_definitions" ]]; then
        echo "  Skipped non-public/restricted definition source(s) for $cui: $skipped_definitions"
      fi
      jq \
        --arg umlsVersion "$umls_version" \
        --argjson sources "$public_sources_json" '
          map(.rootSource = ((.rootSource // "") | ascii_upcase))
          | map(select(.rootSource as $source | $sources | index($source)))
          | unique_by([.rootSource, .value])
          | map({
              rootSource,
              sourceIdentifier,
              value,
              umlsVersion: $umlsVersion
            })
        ' "$temp_dir/raw-definitions.json" > "$temp_dir/definitions.json"
    else
      echo "WARNING: Failed to fetch definitions for $cui: HTTP $UML_STATUS" >&2
    fi
  fi

  atoms_uri="$(jq -r '.result.atoms // "NONE"' "$temp_dir/concept-response.json")"
  if [[ "$atoms_uri" != "NONE" && "$max_public_atoms" -gt 0 ]]; then
    if fetch_paged_results "content/$umls_version/CUI/$cui/atoms" "$temp_dir/raw-atoms.json"; then
      skipped_atoms="$(
        jq -r --argjson sources "$public_sources_json" '
          [.[] | (.rootSource // "" | ascii_upcase)]
          | unique
          | map(select(. as $source | length > 0 and ($sources | index($source) | not)))
          | join(", ")
        ' "$temp_dir/raw-atoms.json"
      )"
      if [[ -n "$skipped_atoms" ]]; then
        echo "  Skipped non-public/restricted atom source(s) for $cui: $skipped_atoms"
      fi
      jq \
        --arg cui "$cui" \
        --arg umlsVersion "$umls_version" \
        --argjson sources "$public_sources_json" \
        --argjson maxAtoms "$max_public_atoms" '
          map(.rootSource = ((.rootSource // "") | ascii_upcase))
          | map(select(.rootSource as $source | $sources | index($source)))
          | unique_by([.rootSource, .ui, .name])
          | .[:$maxAtoms]
          | map({
              cui: $cui,
              aui: (.ui // ""),
              name,
              rootSource,
              termType,
              sourceCode: (
                (.code // "" | split("/") | last) as $code
                | if $code == "" then null else $code end
              ),
              umlsVersion: $umlsVersion
            })
        ' "$temp_dir/raw-atoms.json" > "$temp_dir/atoms.json"
    else
      echo "WARNING: Failed to fetch public atoms for $cui: HTTP $UML_STATUS" >&2
    fi
  fi

  jq \
    --slurpfile definitions "$temp_dir/definitions.json" \
    --slurpfile atoms "$temp_dir/atoms.json" '
      .result
      | {
          ui,
          name,
          definitions: $definitions[0],
          atoms: $atoms[0]
        }
    ' "$temp_dir/concept-response.json" > "$temp_dir/concepts/$cui.json"
done < "$all_cuis_file"

if compgen -G "$temp_dir/concepts/*.json" >/dev/null; then
  jq -s 'map({key: .ui, value: .}) | from_entries' "$temp_dir"/concepts/*.json > "$temp_dir/concepts.json"
else
  printf '{}\n' > "$temp_dir/concepts.json"
fi

represented_sources="$(
  jq '
    [
      .[]
      | ((.definitions // []) + (.atoms // []))[]
      | .rootSource
      | select(. != null and . != "")
    ]
    | unique
    | sort
  ' "$temp_dir/concepts.json"
)"

mkdir -p "$(dirname "$output_path")"
jq -n \
  --arg generatedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
  --arg umlsVersion "$umls_version" \
  --arg source "Public UMLS cache generated from $classification_path and $mapping_path" \
  --arg policy "Public UMLS content is limited to selected CUI, AUI, names, term metadata, source codes, and source-attributed definitions from MSH, NCI, HPO, MEDLINEPLUS, ORPHANET, and PDQ. Category 3/restricted sources are excluded from the public cache." \
  --argjson publicSources "$public_sources_json" \
  --argjson maxPublicAtomsPerConcept "$max_public_atoms" \
  --argjson representedSources "$represented_sources" \
  --slurpfile entityConcepts "$temp_dir/entity-concepts.json" \
  --slurpfile concepts "$temp_dir/concepts.json" '
    {
      generatedAt: $generatedAt,
      umlsVersion: $umlsVersion,
      source: $source,
      publicContentPolicy: $policy,
      publicSources: $publicSources,
      maxPublicAtomsPerConcept: $maxPublicAtomsPerConcept,
      representedSources: $representedSources,
      conceptCount: ($concepts[0] | length),
      entityConcepts: $entityConcepts[0],
      concepts: $concepts[0]
    }
  ' > "$output_path.tmp"
mv "$output_path.tmp" "$output_path"

echo "Wrote $output_path with $(jq '.conceptCount' "$output_path") UMLS concept(s)."
