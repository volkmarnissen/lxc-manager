#!/bin/sh
#
# bind-host.sh: Binds a host directory to an LXC container as a bind mount.
#
# - Stops the container if running
# - Finds the next free mountpoint (mpX)
# - Adds the bind mount to the container config (pct set)
# - Restarts the container if it was running before
#
# This script can be used for both regular disk mounts and ZFS pool subdirectories.
#
# All output is sent to stderr. Script is idempotent and can be run multiple times safely.

VMID="{{ vm_id}}"
HOST_PATH="{{ host_path}}"
CONTAINER_PATH="{{ container_path}}"

# Check that required parameters are not empty
if [ -z "$VMID" ] || [ -z "$HOST_PATH" ] || [ -z "$CONTAINER_PATH" ]; then
  echo "Error: Required parameters (vm_id, host_path, container_path) must be set and not empty!" >&2
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

# Check if the desired mount (host and container path) is already present in the container config
if pct config "$VMID" | grep -q "mp[0-9]*: $HOST_PATH,mp=$CONTAINER_PATH"; then
  echo "Mount $HOST_PATH -> $CONTAINER_PATH is already mapped in container $VMID, skipping." >&2
  exit 0
fi

# Only stop the container if the mount does not exist yet
WAS_RUNNING=0
if container_running; then
  WAS_RUNNING=1
  pct stop "$VMID" 1>&2
fi

# Find next free mpX
USED=$(pct config "$VMID" | grep '^mp' | cut -d: -f1 | sed 's/mp//')
for i in $(seq 0 9); do
  if ! echo "$USED" | grep -qw "$i"; then
    MP="mp$i"
    break
  fi
done

# Set up bind-mount in container only if not already present
if ! pct config "$VMID" | grep -q "^$MP:"; then
  MOUNT_OPTIONS="$HOST_PATH,mp=$CONTAINER_PATH"
  if ! pct set "$VMID" -$MP "$MOUNT_OPTIONS" 1>&2; then
    echo "Error: Failed to set mount point $MP in container $VMID" >&2
    exit 1
  fi
fi

# Restart container if it was running before
if [ "$WAS_RUNNING" -eq 1 ]; then
  if ! pct start "$VMID" 1>&2; then
    echo "Error: Failed to restart container $VMID" >&2
    exit 1
  fi
fi

echo "Host path $HOST_PATH successfully bound to container $VMID at $CONTAINER_PATH" >&2
exit 0

