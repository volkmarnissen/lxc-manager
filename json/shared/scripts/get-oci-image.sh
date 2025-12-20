#!/bin/sh

# OCI image reference (e.g., docker://alpine:latest, oci://ghcr.io/owner/repo:latest, oci://registry.example.com/image:tag)
OCI_IMAGE="{{ oci_image }}"
STORAGE="{{ storage }}"

if [ -z "$OCI_IMAGE" ]; then
  echo "Error: oci_image parameter is required!" >&2
  exit 1
fi

# Extract image name without protocol for searching
# Remove protocol prefix (docker://, oci://) to get the image reference
IMAGE_REF=$(echo "$OCI_IMAGE" | sed 's|^[^:]*://||')
# Extract base image name (without tag) for partial matching
BASE_IMAGE=$(echo "$IMAGE_REF" | cut -d: -f1)
# Extract tag (if present)
IMAGE_TAG=$(echo "$IMAGE_REF" | cut -d: -f2)

# Check if this is a "latest" tag - if so, always download to get the newest version
# (similar to how get-latest-os-template.sh works)
IS_LATEST=false
if [ "$IMAGE_TAG" = "latest" ] || [ -z "$IMAGE_TAG" ]; then
  IS_LATEST=true
  echo "Detected 'latest' tag - will download to ensure newest version" >&2
fi

# For "latest" tags, check registry API first to see if we need to download
# For specific tags, check if already downloaded locally first
if [ "$IS_LATEST" = "true" ]; then
  # Detect registry type from OCI_IMAGE
  REGISTRY_TYPE=""
  if echo "$OCI_IMAGE" | grep -qi "^docker://"; then
    REGISTRY_TYPE="docker"
  elif echo "$OCI_IMAGE" | grep -qi "^oci://ghcr.io"; then
    REGISTRY_TYPE="ghcr"
  elif echo "$OCI_IMAGE" | grep -qi "ghcr.io"; then
    REGISTRY_TYPE="ghcr"
  fi
  
  # Try to get the current "latest" digest from registry API
  LATEST_DIGEST=""
  if command -v curl >/dev/null 2>&1; then
    if [ "$REGISTRY_TYPE" = "docker" ]; then
      # Docker Hub API
      REPO_NAME="$BASE_IMAGE"
      # Check if this is a library image (official Docker images)
      # Docker Hub API format: library/<image> for official images
      if ! echo "$REPO_NAME" | grep -q '/'; then
        REPO_NAME="library/$REPO_NAME"
      fi
      
      API_URL="https://hub.docker.com/v2/repositories/$REPO_NAME/tags/latest/"
      echo "Checking Docker Hub API for latest version of $BASE_IMAGE..." >&2
      API_RESPONSE=$(curl -s "$API_URL" 2>/dev/null)
      
      if [ -n "$API_RESPONSE" ] && echo "$API_RESPONSE" | grep -q '"digest"'; then
        # Extract digest from API response
        LATEST_DIGEST=$(echo "$API_RESPONSE" | grep -o '"digest":"[^"]*"' | head -n1 | cut -d'"' -f4)
        if [ -n "$LATEST_DIGEST" ]; then
          echo "Found latest digest on Docker Hub: ${LATEST_DIGEST:0:12}..." >&2
        fi
      fi
    elif [ "$REGISTRY_TYPE" = "ghcr" ]; then
      # GitHub Container Registry (ghcr.io) uses OCI Distribution API
      # Extract repo name (e.g., "owner/repo" from "ghcr.io/owner/repo:latest")
      REPO_NAME="$BASE_IMAGE"
      # Remove "ghcr.io/" prefix if present
      REPO_NAME=$(echo "$REPO_NAME" | sed 's|^ghcr\.io/||')
      
      API_URL="https://ghcr.io/v2/$REPO_NAME/manifests/latest"
      echo "Checking GitHub Container Registry API for latest version of $REPO_NAME..." >&2
      # Use HEAD request to get manifest digest from Docker-Content-Digest header
      API_HEADERS=$(curl -s -I "$API_URL" 2>/dev/null)
      
      if [ -n "$API_HEADERS" ]; then
        # Extract digest from Docker-Content-Digest header
        LATEST_DIGEST=$(echo "$API_HEADERS" | grep -i "docker-content-digest:" | cut -d' ' -f2 | tr -d '\r')
        if [ -n "$LATEST_DIGEST" ]; then
          echo "Found latest digest on GitHub Container Registry: ${LATEST_DIGEST:0:12}..." >&2
        fi
      fi
    else
      echo "Unknown registry type, skipping API check..." >&2
    fi
  fi
  
  # Check if we have any version of this image locally
  EXISTING_LOCAL=$(pveam list "$STORAGE" --content images 2>/dev/null | grep -i "$BASE_IMAGE" | tail -n1)
  NEED_DOWNLOAD=true
  TEMPLATE_PATH=""
  
  if [ -n "$EXISTING_LOCAL" ]; then
    if [ -n "$LATEST_DIGEST" ]; then
      # Check if local image matches the latest digest
      # Note: Proxmox might store images with digest in the name, so we check if digest is mentioned
      if echo "$EXISTING_LOCAL" | grep -q "$LATEST_DIGEST"; then
        echo "Local image already matches latest digest, using existing image." >&2
        TEMPLATE_PATH=$(echo "$EXISTING_LOCAL" | awk '{print $1}')
        NEED_DOWNLOAD=false
      else
        echo "Local image digest differs from latest, downloading new version..." >&2
      fi
    else
      echo "Could not determine latest digest from API, downloading to ensure latest version..." >&2
    fi
  else
    echo "No local image found, downloading latest version..." >&2
  fi
  
  # Download if needed
  if [ "$NEED_DOWNLOAD" = "true" ]; then
    echo "Downloading OCI image $OCI_IMAGE to get latest version..." >&2
    # Download OCI image using pveam (this will get the current "latest" from the registry)
    if ! pveam download "$STORAGE" "$OCI_IMAGE" >&2; then
      echo "Error: Failed to download OCI image $OCI_IMAGE" >&2
      exit 1
    fi
    
    # Wait a moment for the image to be registered
    sleep 2
    
    # Find the most recently downloaded image matching the base image name
    # OCI images are stored with digest/version, not as "latest"
    TEMPLATE_PATH=$(pveam list "$STORAGE" --content images 2>/dev/null | grep -i "$BASE_IMAGE" | tail -n1 | awk '{print $1}')
    
    if [ -z "$TEMPLATE_PATH" ]; then
      # Fallback: get the most recently added image
      TEMPLATE_PATH=$(pveam list "$STORAGE" --content images 2>/dev/null | tail -n1 | awk '{print $1}')
      echo "Warning: Could not find image matching $BASE_IMAGE, using most recent image: $TEMPLATE_PATH" >&2
    else
      echo "Using downloaded image: $TEMPLATE_PATH" >&2
    fi
  fi
else
  # For specific tags, check if already downloaded
  # First try exact match
  EXISTING_IMAGE=$(pveam list "$STORAGE" --content images 2>/dev/null | grep -i "$IMAGE_REF" | head -n1)
  
  # If not found with exact match, try base image name (for cases where stored name differs)
  if [ -z "$EXISTING_IMAGE" ]; then
    EXISTING_IMAGE=$(pveam list "$STORAGE" --content images 2>/dev/null | grep -i "$BASE_IMAGE" | grep -i "$IMAGE_TAG" | head -n1)
  fi
  
  if [ -n "$EXISTING_IMAGE" ]; then
    echo "OCI image matching $OCI_IMAGE is already present in storage $STORAGE." >&2
    TEMPLATE_PATH=$(echo "$EXISTING_IMAGE" | awk '{print $1}')
  else
    echo "Downloading OCI image $OCI_IMAGE..." >&2
    # Download OCI image using pveam
    if ! pveam download "$STORAGE" "$OCI_IMAGE" >&2; then
      echo "Error: Failed to download OCI image $OCI_IMAGE" >&2
      exit 1
    fi
    
    # Wait a moment for the image to be registered
    sleep 2
    
    # Get the downloaded image path - try multiple search strategies
    # First try exact match
    TEMPLATE_PATH=$(pveam list "$STORAGE" --content images 2>/dev/null | grep -i "$IMAGE_REF" | awk '{print $1}' | head -n1)
    
    # If not found, try base image name with tag
    if [ -z "$TEMPLATE_PATH" ]; then
      TEMPLATE_PATH=$(pveam list "$STORAGE" --content images 2>/dev/null | grep -i "$BASE_IMAGE" | grep -i "$IMAGE_TAG" | awk '{print $1}' | head -n1)
    fi
    
    # If still not found, try to get the most recently added image
    if [ -z "$TEMPLATE_PATH" ]; then
      TEMPLATE_PATH=$(pveam list "$STORAGE" --content images 2>/dev/null | tail -n1 | awk '{print $1}')
      echo "Warning: Could not find exact match for $OCI_IMAGE, using most recent image: $TEMPLATE_PATH" >&2
    fi
  fi
fi

if [ -z "$TEMPLATE_PATH" ]; then
  echo "Error: OCI image not found in storage $STORAGE after download" >&2
  echo "Available images:" >&2
  pveam list "$STORAGE" --content images >&2
  exit 1
fi

# Try to detect ostype from image name (fallback to alpine if not detectable)
OSTYPE="alpine"
if echo "$OCI_IMAGE" | grep -qi "debian"; then
  OSTYPE="debian"
elif echo "$OCI_IMAGE" | grep -qi "ubuntu"; then
  OSTYPE="ubuntu"
elif echo "$OCI_IMAGE" | grep -qi "alpine"; then
  OSTYPE="alpine"
elif echo "$OCI_IMAGE" | grep -qi "fedora"; then
  OSTYPE="fedora"
elif echo "$OCI_IMAGE" | grep -qi "centos"; then
  OSTYPE="centos"
fi

# Output the template path and ostype in JSON format
echo '[{ "id": "template_path", "value": "'$TEMPLATE_PATH'"}, {"id": "ostype", "value": "'$OSTYPE'"}]'

