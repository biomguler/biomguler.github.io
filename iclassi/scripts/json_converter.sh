#!/usr/bin/env bash

# Convert the i-CLASSi raw files into a versioned JSON folder.
#
# Example:
#   bash iclassi/scripts/json_converter.sh iclassi/versions/raw \
#     -v "0.1.0-beta" \
#     --version-label "0.1.0-beta" \
#     --release-type "first release" \
#     --force
#
# Output:
#   iclassi/versions/0.1.0/iclassi.json
#   iclassi/versions/0.1.0/abbreviations.json
#   iclassi/versions/0.1.0/i-gwasdb.json
#   iclassi/versions/0.1.0/iclassi_mapping.json
#   iclassi/versions/0.1.0/data-sources.json

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash iclassi/scripts/json_converter.sh RAW_DIRECTORY -v VERSION [options]

Required:
  RAW_DIRECTORY          Folder containing four TSV files and data-sources.json.
  -v, --version VERSION  Destination version folder name, for example 0.1.0.

Options:
  -o, --output-root DIR  Parent directory for version folders.
                         Default: parent directory of RAW_DIRECTORY.
  --version-label LABEL  Display label. Default: VERSION.
  --release-type TYPE    Release type. Inferred from VERSION when omitted.
  -f, --force            Replace existing generated JSON files.
  --no-register          Do not add the generated version to versions.json.
  -h, --help             Show this help.

Accepted raw filenames:
  iclassi.txt
  abbreviations.txt or abbrevations.txt
  i-gwas.txt or i-gwasdb.txt
  iclassi_mapping.txt or iclassi-mapping.txt
  data-sources.json or data_sources.json

Example:
  bash iclassi/scripts/json_converter.sh iclassi/versions/raw \
    -v "0.1.0-beta" \
    --version-label "0.1.0-beta" \
    --release-type "first release" \
    --force
EOF
}

raw_directory=""
version=""
output_root=""
version_label=""
release_type=""
force=false
register_version=true

if [[ $# -gt 0 && "$1" != -* ]]; then
  raw_directory="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--version)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "Missing value for $1." >&2
        exit 2
      fi
      version="$2"
      shift 2
      ;;
    -o|--output-root)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "Missing value for $1." >&2
        exit 2
      fi
      output_root="$2"
      shift 2
      ;;
    --version-label)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "Missing value for $1." >&2
        exit 2
      fi
      version_label="$2"
      shift 2
      ;;
    --release-type)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "Missing value for $1." >&2
        exit 2
      fi
      release_type="$2"
      shift 2
      ;;
    -f|--force)
      force=true
      shift
      ;;
    --no-register)
      register_version=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$raw_directory" || -z "$version" ]]; then
  usage >&2
  exit 2
fi

if [[ ! -d "$raw_directory" ]]; then
  echo "Raw directory not found: $raw_directory" >&2
  exit 1
fi

if [[ "$version" == */* || "$version" == *\\* || "$version" == "." || "$version" == ".." ]]; then
  echo "Version must be a folder name, not a path: $version" >&2
  exit 2
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Required command not found: python3" >&2
  exit 1
fi

if [[ -z "$output_root" ]]; then
  output_root="$(dirname "$raw_directory")"
fi

if [[ -z "$version_label" ]]; then
  version_label="$version"
fi

if [[ -z "$release_type" ]]; then
  case "$version" in
    *prototype*)
      release_type="Demonstration subset"
      ;;
    *beta*)
      release_type="Beta release"
      ;;
    *)
      release_type="Stable release"
      ;;
  esac
fi

output_directory="$output_root/$version"

find_input() {
  local candidate
  for candidate in "$@"; do
    if [[ -f "$raw_directory/$candidate" ]]; then
      printf '%s\n' "$raw_directory/$candidate"
      return 0
    fi
  done
  return 1
}

iclassi_input="$(find_input "iclassi.txt")" || {
  echo "Missing raw file: iclassi.txt" >&2
  exit 1
}
abbreviations_input="$(find_input "abbreviations.txt" "abbrevations.txt")" || {
  echo "Missing raw file: abbreviations.txt or abbrevations.txt" >&2
  exit 1
}
gwas_input="$(find_input "i-gwas.txt" "i-gwasdb.txt")" || {
  echo "Missing raw file: i-gwas.txt or i-gwasdb.txt" >&2
  exit 1
}
mapping_input="$(find_input "iclassi_mapping.txt" "iclassi-mapping.txt")" || {
  echo "Missing raw file: iclassi_mapping.txt or iclassi-mapping.txt" >&2
  exit 1
}
data_sources_input="$(find_input "data-sources.json" "data_sources.json")" || {
  echo "Missing raw file: data-sources.json or data_sources.json" >&2
  exit 1
}

outputs=(
  "$output_directory/iclassi.json"
  "$output_directory/abbreviations.json"
  "$output_directory/i-gwasdb.json"
  "$output_directory/iclassi_mapping.json"
  "$output_directory/data-sources.json"
)

if [[ "$force" != true ]]; then
  for output in "${outputs[@]}"; do
    if [[ -e "$output" ]]; then
      echo "Output already exists: $output" >&2
      echo "Use --force to replace existing generated JSON files." >&2
      exit 1
    fi
  done
fi

mkdir -p "$output_directory"

python3 - \
  "$iclassi_input" \
  "$abbreviations_input" \
  "$gwas_input" \
  "$mapping_input" \
  "$data_sources_input" \
  "$version" \
  "$version_label" \
  "$release_type" \
  "$output_directory" <<'PY'
import csv
import json
import re
import sys
from pathlib import Path


iclassi_input = Path(sys.argv[1])
abbreviations_input = Path(sys.argv[2])
gwas_input = Path(sys.argv[3])
mapping_input = Path(sys.argv[4])
data_sources_input = Path(sys.argv[5])
version = sys.argv[6]
version_label = sys.argv[7]
release_type = sys.argv[8]
output_directory = Path(sys.argv[9])


def read_tsv(path):
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.reader(source, delimiter="\t", quotechar='"')
        rows = list(reader)

    if not rows:
        raise ValueError(f"{path}: input file is empty")

    headers = [header.strip() for header in rows[0]]
    if not headers or any(not header for header in headers):
        raise ValueError(f"{path}: header row contains an empty column name")
    if len(headers) != len(set(headers)):
        raise ValueError(f"{path}: header row contains duplicate column names")

    records = []
    for line_number, values in enumerate(rows[1:], start=2):
        if not values or all(not value.strip() for value in values):
            continue
        if len(values) != len(headers):
            raise ValueError(
                f"{path}:{line_number}: expected {len(headers)} columns, "
                f"found {len(values)}"
            )
        records.append({
            header: value.strip()
            for header, value in zip(headers, values)
        })
    return headers, records


def require_headers(path, headers, required_headers):
    missing = [header for header in required_headers if header not in headers]
    if missing:
        raise ValueError(
            f"{path}: missing required header(s): {', '.join(missing)}"
        )


def split_aliases(value):
    aliases = [
        alias.strip()
        for alias in re.split(r"[;|]", value or "")
        if alias.strip()
    ]
    return list(dict.fromkeys(aliases))


def write_json(path, records):
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    with temporary_path.open("w", encoding="utf-8", newline="\n") as output:
        json.dump(records, output, ensure_ascii=False, indent=2)
        output.write("\n")
    temporary_path.replace(path)


iclassi_headers, iclassi_records = read_tsv(iclassi_input)
require_headers(
    iclassi_input,
    iclassi_headers,
    ["LNIC Code", "Lineage-Nature", "Major Group", "Category",
     "Class-Family", "Entity-Type", "Subtype(s)"],
)

abbreviation_headers, abbreviation_rows = read_tsv(abbreviations_input)
require_headers(
    abbreviations_input,
    abbreviation_headers,
    ["abbreviation", "full_name", "category", "status", "aliases"],
)
abbreviation_records = []
seen_abbreviations = set()
for line_offset, row in enumerate(abbreviation_rows, start=2):
    abbreviation = row["abbreviation"]
    full_name = row["full_name"]
    if not abbreviation or not full_name:
        raise ValueError(
            f"{abbreviations_input}:{line_offset}: abbreviation and "
            "full_name are required"
        )
    if abbreviation in seen_abbreviations:
        raise ValueError(
            f"{abbreviations_input}:{line_offset}: duplicate abbreviation "
            f"{abbreviation!r}"
        )
    seen_abbreviations.add(abbreviation)
    abbreviation_records.append({
        "abbreviation": abbreviation,
        "full_name": full_name,
        "category": row["category"],
        "status": row["status"],
        "aliases": split_aliases(row["aliases"]),
    })

gwas_headers, gwas_records = read_tsv(gwas_input)
require_headers(
    gwas_input,
    gwas_headers,
    ["LNIC Code(s)", "CHR", "POS", "rsID", "P", "GWAS Catalog", "PUBMED"],
)

mapping_headers, mapping_records = read_tsv(mapping_input)
required_mapping_headers = [
    "Entry ID", "LNIC Code", "Entity-Type", "Vocabulary", "Code",
    "Mapping_type", "Version", "Mapping confidence",
]
require_headers(mapping_input, mapping_headers, required_mapping_headers)
preferred_name_headers = [
    "Vocabulary Preferred Name",
    "Vocabulary Prefered Name",
]
preferred_name_header = next(
    (header for header in preferred_name_headers if header in mapping_headers),
    None,
)
if preferred_name_header is None:
    raise ValueError(
        f"{mapping_input}: missing required header: "
        "Vocabulary Preferred Name"
    )
if not any(
    header.replace("\u00a0", " ") in {"Subtype (s)", "Subtype(s)"}
    for header in mapping_headers
):
    raise ValueError(
        f"{mapping_input}: missing required subtype header "
        "(Subtype(s) or Subtype (s))"
    )

# Preserve compatibility with the current Mapping page and UMLS cache scripts,
# which use the historical JSON property spelling "Prefered".
for record in mapping_records:
    record["Vocabulary Prefered Name"] = record.pop(preferred_name_header)

with data_sources_input.open("r", encoding="utf-8-sig") as source:
    data_sources_template = json.load(source)

if isinstance(data_sources_template, list):
    sources = data_sources_template
elif isinstance(data_sources_template, dict):
    sources = data_sources_template.get("sources")
else:
    sources = None

if not isinstance(sources, list):
    raise ValueError(
        f"{data_sources_input}: expected a JSON object with a sources array "
        "or a top-level array"
    )

data_sources = {
    "versionId": version,
    "versionLabel": version_label,
    "releaseType": release_type,
    "sources": sources,
}

write_json(output_directory / "iclassi.json", iclassi_records)
write_json(output_directory / "abbreviations.json", abbreviation_records)
write_json(output_directory / "i-gwasdb.json", gwas_records)
write_json(output_directory / "iclassi_mapping.json", mapping_records)
write_json(output_directory / "data-sources.json", data_sources)

print(f"  iclassi.json: {len(iclassi_records)} records")
print(f"  abbreviations.json: {len(abbreviation_records)} records")
print(f"  i-gwasdb.json: {len(gwas_records)} records")
print(f"  iclassi_mapping.json: {len(mapping_records)} records")
print(f"  data-sources.json: {len(sources)} sources")
PY

echo "Created version folder: $output_directory"

manifest_path="$(dirname "$output_root")/versions.json"
if [[ "$register_version" == true && -f "$manifest_path" ]]; then
  python3 - "$manifest_path" "$version" "$version_label" <<'PY'
import json
import sys
from pathlib import Path


manifest_path = Path(sys.argv[1])
version = sys.argv[2]
version_label = sys.argv[3]

with manifest_path.open("r", encoding="utf-8-sig") as source:
    manifest = json.load(source)

versions = manifest.setdefault("versions", [])
entry = {
    "id": version,
    "label": version_label,
    "path": f"versions/{version}/",
}

existing = next(
    (item for item in versions if item.get("id") == version),
    None,
)
if existing is None:
    versions.insert(0, entry)
    action = "Registered"
else:
    existing.update(entry)
    action = "Updated"

temporary_path = manifest_path.with_suffix(manifest_path.suffix + ".tmp")
with temporary_path.open("w", encoding="utf-8", newline="\n") as output:
    json.dump(manifest, output, ensure_ascii=False, indent=2)
    output.write("\n")
temporary_path.replace(manifest_path)

print(f"{action} {version} in {manifest_path}")
PY
elif [[ "$register_version" == true ]]; then
  echo "Version manifest not found at $manifest_path; registration skipped."
fi
