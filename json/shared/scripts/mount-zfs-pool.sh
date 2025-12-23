#!/bin/sh
#
# mount-zfs-pool.sh: Creates a subdirectory under a ZFS pool mountpoint on the Proxmox host.
#
# - Verifies that the ZFS pool exists and is mounted
# - Creates a subdirectory under the pool mountpoint
# - Sets permissions (uid/gid)
#
# The ZFS pool must already be mounted (which is always the case in Proxmox).
#
# All output is sent to stderr. Script is idempotent and can be run multiple times safely.

STORAGE_SELECTION="{{ storage_selection}}"
MOUNTPOINT="{{ mountpoint}}"
UID_VALUE="{{ uid}}"
GID_VALUE="{{ gid}}"

# Check that required parameters are not empty
if [ -z "$STORAGE_SELECTION" ] || [ -z "$MOUNTPOINT" ]; then
  echo "Error: Required parameters (storage_selection, mountpoint) must be set and not empty!" >&2
  exit 1
fi

# Parse storage selection: must be zfs:...
if ! echo "$STORAGE_SELECTION" | grep -q "^zfs:"; then
  echo "Error: Invalid storage selection format. Must start with 'zfs:'" >&2
  exit 1
fi

POOL_NAME=$(echo "$STORAGE_SELECTION" | sed 's/^zfs://')

# Check if zpool command is available
if ! command -v zpool >/dev/null 2>&1; then
  echo "Error: zpool command not found. ZFS tools are required." >&2
  exit 1
fi

# Check if zfs command is available
if ! command -v zfs >/dev/null 2>&1; then
  echo "Error: zfs command not found. ZFS tools are required." >&2
  exit 1
fi

# Verify that the ZFS pool exists
if ! zpool list "$POOL_NAME" >/dev/null 2>&1; then
  echo "Error: ZFS pool '$POOL_NAME' not found!" >&2
  exit 1
fi

# Get current mountpoint of the ZFS pool
POOL_MOUNTPOINT=$(zfs get -H -o value mountpoint "$POOL_NAME" 2>/dev/null || echo "")

# Verify pool is mounted (should always be in Proxmox)
if [ "$POOL_MOUNTPOINT" = "none" ] || [ "$POOL_MOUNTPOINT" = "-" ]; then
  echo "Error: ZFS pool '$POOL_NAME' is not mounted. In Proxmox, pools should always be mounted." >&2
  exit 1
fi

# Verify the pool mountpoint exists
if [ ! -d "$POOL_MOUNTPOINT" ]; then
  echo "Error: ZFS pool mountpoint '$POOL_MOUNTPOINT' does not exist!" >&2
  exit 1
fi

# Create subdirectory under pool mountpoint
# The mountpoint parameter specifies where it should be mounted in the container
# We create a directory under the pool mountpoint on the host
# Use the last component of the mountpoint path as directory name
# e.g., /mnt/backup -> backup, /mnt/zfs -> zfs
SUBDIR_NAME=$(echo "$MOUNTPOINT" | sed 's|^/||' | awk -F'/' '{print $NF}')
if [ -z "$SUBDIR_NAME" ] || [ "$SUBDIR_NAME" = "" ]; then
  # Fallback: use a default name if mountpoint is just "/"
  SUBDIR_NAME="container-share"
fi
CONTAINER_DIR="$POOL_MOUNTPOINT/$SUBDIR_NAME"

echo "Creating directory $CONTAINER_DIR under ZFS pool mountpoint..." >&2
mkdir -p "$CONTAINER_DIR" >&2

# Set permissions on the container directory if uid/gid are provided
if [ -n "$UID_VALUE" ] && [ -n "$GID_VALUE" ] && [ "$UID_VALUE" != "" ] && [ "$GID_VALUE" != "" ]; then
  chown "$UID_VALUE:$GID_VALUE" "$CONTAINER_DIR" >&2
fi

echo "Directory $CONTAINER_DIR successfully created under ZFS pool $POOL_NAME" >&2
echo '{ "id": "host_mountpoint", "value": "'$CONTAINER_DIR'" }'
exit 0

