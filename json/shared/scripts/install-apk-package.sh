#!/bin/sh
# Install packages inside LXC container (runs inside the container)
# Supports both Alpine Linux (apk) and Debian/Ubuntu (apt)
# Automatically detects OS type from /etc/os-release
# Inputs (templated):
#   {{ packages }}  (space-separated list, e.g. "openssh curl")
#   {{ ostype }}   (optional fallback - "alpine", "debian", or "ubuntu")
set -eu
PACKAGES="{{ packages }}"

# Auto-detect OS type from /etc/os-release
# Falls back to {{ ostype }} parameter if os-release is not available
if [ -f /etc/os-release ]; then
  # Source the file to get ID variable
  . /etc/os-release
  OSTYPE="$ID"
else
  # Fallback to template parameter
  OSTYPE="{{ ostype }}"
  if [ -z "$OSTYPE" ] || [ "$OSTYPE" = "" ]; then
    OSTYPE="alpine"
  fi
fi

if [ -z "$PACKAGES" ]; then
  echo "Missing packages" >&2
  exit 2
fi

case "$OSTYPE" in
  alpine)
    # Ensure apk is available and index up-to-date
    if ! command -v apk  >&2; then
      echo "Error: apk not found (not an Alpine Linux environment)" >&2
      exit 1
    fi
    apk update  >&2
    # shellcheck disable=SC2086
    apk add --no-cache $PACKAGES >&2
    ;;
  debian|ubuntu)
    # Ensure apt is available
    if ! command -v apt-get  >&2; then
      echo "Error: apt-get not found (not a Debian/Ubuntu environment)" >&2
      exit 1
    fi
    # Update package index
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq >&2
    # shellcheck disable=SC2086
    apt-get install -y --no-install-recommends $PACKAGES >&2
    ;;
  *)
    echo "Error: Unsupported ostype: $OSTYPE" >&2
    exit 3
    ;;
esac

# No output requested; exit success
exit 0

