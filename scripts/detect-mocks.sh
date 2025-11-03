#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# Define a list of forbidden keywords
FORBIDDEN_KEYWORDS=(
  "TODO: mock"
  "__mocks__"
  "fake"
  "stub"
  "MOCK_"
  "useMock"
)

# Initialize a flag to track if forbidden keywords are found
found_keyword=false

# 1. Search for general forbidden keywords, excluding package-lock.json
for keyword in "${FORBIDDEN_KEYWORDS[@]}"; do
  if git grep -i "$keyword" -- . ':!*package-lock.json' ':!scripts/detect-mocks.sh' ':!node_modules'; then
    echo "ERROR: Forbidden keyword '$keyword' found in the codebase."
    found_keyword=true
  fi
done

# 2. Search for "placeholder", but ignore legitimate UI props in TSX files and comments in test files
# This is a more specific search to avoid flagging UI code.
if git grep -i "placeholder" -- . ':!*package-lock.json' ':!scripts/detect-mocks.sh' ':!node_modules' \
  | grep -vE 'placeholder=|placeholderTextColor=' \
  | grep -vE '\.test\.ts'; then
  echo "ERROR: Forbidden keyword 'placeholder' found in logic files."
  found_keyword=true
fi


# If a forbidden keyword was found, exit with an error code
if [ "$found_keyword" = true ]; then
  echo "Mock, placeholder, or fake implementation found. Failing the build."
  exit 1
fi

echo "No mock or placeholder keywords found. Check passed."
exit 0
