#!/bin/sh

# Name of the local storage
STORAGE="local"
# Template keyword
OSTYPE={{ ostype }}

# Find the latest OSTYPE template from the list of available templates
TEMPLATE=$(pveam available | awk -v OSTYPE="$OSTYPE" 'index($2, OSTYPE)==1 {print $2}' | sort -V | tail -n 1)
if [ -z "$TEMPLATE" ]; then
  echo "No $OSTYPE template found!" >&2
  exit 1
fi

# Check if the template is already present in local storage
if pveam list $STORAGE | grep -q "$TEMPLATE"; then
  echo "Template $TEMPLATE is already present in local storage." >&2
else
  echo "Downloading $TEMPLATE..." >&2
  if ! pveam download $STORAGE "$TEMPLATE" >&2; then
    echo "Error: Failed to download template $TEMPLATE" >&2
    exit 1
  fi
fi

# Verify template is now available
template_path=$(pveam list $STORAGE | awk -v T="$TEMPLATE" '$1 ~ T {print $1}')
if [ -z "$template_path" ]; then
  echo "Error: Template $TEMPLATE not found in storage $STORAGE after download" >&2
  exit 1
fi

# Output the template path in JSON format
echo '[{ "id": "template_path", "value": "'$template_path'"} ,{"id": "ostype", "value": "'$OSTYPE'" }]'