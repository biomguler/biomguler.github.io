# i-CLASSi Scripts

Use these scripts in this order when preparing a new i-CLASSi data release. Run them from the repository root:

`S:\Github\biomguler.github.io`

## Repository layout

- i-CLASSi maintenance scripts live in `iclassi/scripts/`.
- Versioned release data live in `iclassi/versions/<version>/`.
- The public UMLS cache is versioned with the release data and should be written beside `iclassi.json` and `iclassi_mapping.json`, for example `iclassi/versions/0.1.0-beta/umls_concepts.json`.

## 1. Build versioned JSON files

Preferred script:

```bash
bash iclassi/scripts/json_converter.sh iclassi/versions/raw \
  -v "0.1.0-beta" \
  --version-label "0.1.0-beta" \
  --release-type "first release" \
  --force
```

This reads the raw files in `iclassi/versions/raw` and creates these files in `iclassi/versions/<version>/`:

- `iclassi.json`
- `abbreviations.json`
- `i-gwasdb.json`
- `iclassi_mapping.json`
- `data-sources.json`

It also updates `iclassi/versions.json` unless `--no-register` is used.

## 2. Build the versioned public UMLS cache

Windows PowerShell:

```powershell
.\iclassi\scripts\build-umls-cache.ps1 `
  -ApiKey "YOUR_UMLS_API_KEY" `
  -ClassificationPath "iclassi/versions/0.1.0-beta/iclassi.json" `
  -MappingPath "iclassi/versions/0.1.0-beta/iclassi_mapping.json"
```

This writes `iclassi/versions/0.1.0-beta/umls_concepts.json` by default.

macOS, Linux, or Git Bash/WSL:

```bash
bash iclassi/scripts/build-umls-cache.sh \
  --api-key "YOUR_UMLS_API_KEY" \
  --classification-path "iclassi/versions/0.1.0-beta/iclassi.json" \
  --mapping-path "iclassi/versions/0.1.0-beta/iclassi_mapping.json"
```

This also writes `iclassi/versions/0.1.0-beta/umls_concepts.json` by default.

Both UMLS scripts do the same job. Keep the PowerShell version for Windows users and the Bash version for Unix-like environments. Use `-OutputPath` or `--output-path` only when you intentionally want to override the version-folder default.

## Deprecated

`convert-abbreviations.ps1` is an older helper for converting abbreviations only. It is no longer part of the normal workflow because `json_converter.sh` now creates the versioned `abbreviations.json` together with the other release files.