#!/bin/sh
#
# bind-multiple-volumes-to-lxc.sh: Binds multiple host directories to an LXC container.
#
# - Parses volumes (key=value format, one per line)
# - For each volume, creates a bind mount from <host_path>/<key> to /<value> in the container
#
# All output is sent to stderr. Script is idempotent and can be run multiple times safely.

VMID="{{ vm_id}}"
HOST_PATH="{{ host_path}}"
VOLUMES="{{ volumes}}"

# Check that required parameters are not empty
if [ -z "$VMID" ] || [ -z "$HOST_PATH" ]; then
  echo "Error: Required parameters (vm_id, host_path) must be set and not empty!" >&2
  exit 1
fi

if [ -z "$VOLUMES" ]; then
  echo "Error: Required parameter 'volumes' must be set and not empty!" >&2
  exit 1
fi

# Verify that the host path exists
if [ ! -d "$HOST_PATH" ]; then
  echo "Error: Host path '$HOST_PATH' does not exist!" >&2
  exit 1
fi

# Helper function: Is container running?
container_running() {
  pct status "$VMID" 2>/dev/null | grep -q 'status: running'
}

# Helper function: Find next free mpX
find_next_mp() {
  USED=$(pct config "$VMID" | grep '^mp' | cut -d: -f1 | sed 's/mp//')
  for i in $(seq 0 9); do
    if ! echo "$USED" | grep -qw "$i"; then
      echo "mp$i"
      return 0
    fi
  done
  echo ""
}

# Check if container needs to be stopped
WAS_RUNNING=0
if container_running; then
  WAS_RUNNING=1
fi

# Track if we need to stop the container
NEEDS_STOP=0

# Process volumes: split by newlines and process each line
# Use a temporary file to avoid subshell issues
TMPFILE=$(mktemp)
echo "$VOLUMES" > "$TMPFILE"

VOLUME_COUNT=0
while IFS= read -r line <&3; do
  # Skip empty lines
  [ -z "$line" ] && continue
  
  # Parse key=value format
  VOLUME_KEY=$(echo "$line" | cut -d'=' -f1)
  VOLUME_VALUE=$(echo "$line" | cut -d'=' -f2-)
  
  # Skip if key or value is empty
  [ -z "$VOLUME_KEY" ] && continue
  [ -z "$VOLUME_VALUE" ] && continue
  
  # Construct paths
  SOURCE_PATH="$HOST_PATH/$VOLUME_KEY"
  CONTAINER_PATH="/$VOLUME_VALUE"
  
  # Create source directory if it doesn't exist
  if [ ! -d "$SOURCE_PATH" ]; then
    mkdir -p "$SOURCE_PATH" >&2
  fi
  
  # Check if mount already exists
  if pct config "$VMID" | grep -q "mp[0-9]*: $SOURCE_PATH,mp=$CONTAINER_PATH"; then
    echo "Mount $SOURCE_PATH -> $CONTAINER_PATH already exists, skipping." >&2
    continue
  fi
  
  # Stop container if needed (only once, before first mount)
  if [ "$NEEDS_STOP" -eq 0 ] && container_running; then
    pct stop "$VMID" >&2
    NEEDS_STOP=1
  fi
  
  # Find next free mountpoint
  MP=$(find_next_mp)
  if [ -z "$MP" ]; then
    echo "Error: No free mountpoint available (mp0-mp9 all in use)" >&2
    rm -f "$TMPFILE"
    exit 1
  fi
  
  # Set up bind mount
  MOUNT_OPTIONS="$SOURCE_PATH,mp=$CONTAINER_PATH"
  if ! pct set "$VMID" -$MP "$MOUNT_OPTIONS" >&2; then
    echo "Error: Failed to set mount point $MP in container $VMID" >&2
    rm -f "$TMPFILE"
    exit 1
  fi
  
  echo "Bound $SOURCE_PATH to $CONTAINER_PATH in container $VMID" >&2
  VOLUME_COUNT=$((VOLUME_COUNT + 1))
done 3< "$TMPFILE"
rm -f "$TMPFILE"

# Restart container if it was running before
if [ "$WAS_RUNNING" -eq 1 ]; then
  # Container was running and we may have stopped it, restart it
  if ! pct start "$VMID" >&2; then
    echo "Error: Failed to restart container $VMID" >&2
    exit 1
  fi
fi

echo "Successfully processed volumes for container $VMID" >&2
exit 0

