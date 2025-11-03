#!/bin/bash
# Fail build if mock, placeholder, fake, or stub is found in key logic files

FORBIDDEN_KEYWORDS=("mock" "placeholder" "fake" "stub")
FORBIDDEN_FILES=(
  "src/"
  "app/"
  "*.ts"
  "*.tsx"
)
EXCLUDE_PATTERNS=(
  "*.test.ts"
  "*.spec.ts"
  "*.snap"
  "*/__mocks__/*"
  "*/node_modules/*"
  "*/.expo/*"
  "*/.next/*"
  "*/dist/*"
  "*/build/*"
  "*/.d.ts"
)

# Build exclude arguments for grep
GREP_EXCLUDES=()
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
  GREP_EXCLUDES+=("--exclude=$pattern")
done

# Search for forbidden keywords
errors_found=0
for keyword in "${FORBIDDEN_KEYWORDS[@]}"; do
  # We use git grep for speed and to respect .gitignore
  # Fallback to standard grep if not in a git repo
  if command -v git &> /dev/null && git rev-parse --is-inside-work-tree &> /dev/null; then
    output=$(git grep -i -n -E "$keyword" -- "${FORBIDDEN_FILES[@]}" ':(exclude)'"${EXCLUDE_PATTERNS[@]}")
  else
    output=$(grep -i -r -n -E "$keyword" "${FORBIDDEN_FILES[@]}" "${GREP_EXCLUDES[@]}")
  fi

  if [ -n "$output" ]; then
    echo "$output"
    errors_found=1
  fi
done

if [ $errors_found -ne 0 ]; then
  echo "ERROR: Forbidden keyword found in logic files." >&2
  echo "Mock, placeholder, or fake implementation found. Failing the build." >&2
  exit 1
fi

echo "✅ No mock or placeholder keywords found."
exit 0
