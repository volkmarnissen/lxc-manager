#!/bin/sh
#
# bind-volumes.sh: Creates a volumes directory on the Proxmox host for container-specific data.
#
# - Creates the directory structure: <mountpoint>/volumes/<hostname>
# - Sets permissions (uid/gid) if provided
#
# This directory is not bound to any container and remains on the host.
# It can be used for Docker volumes or other host-specific data.
#
# All output is sent to stderr. Script is idempotent and can be run multiple times safely.

MOUNTPOINT="{{ mountpoint}}"
HOSTNAME="{{ hostname}}"
UID_VALUE="{{ uid}}"
GID_VALUE="{{ gid}}"

# Check that required parameters are not empty
if [ -z "$MOUNTPOINT" ] || [ -z "$HOSTNAME" ]; then
  echo "Error: Required parameters (mountpoint, hostname) must be set and not empty!" >&2
  exit 1
fi

# Construct the volumes path
VOLUMES_PATH="$MOUNTPOINT/volumes/$HOSTNAME"

# Create the volumes directory
mkdir -p "$VOLUMES_PATH" >&2

# Set permissions if uid/gid are provided
if [ -n "$UID_VALUE" ] && [ -n "$GID_VALUE" ] && [ "$UID_VALUE" != "" ] && [ "$GID_VALUE" != "" ]; then
  chown "$UID_VALUE:$GID_VALUE" "$VOLUMES_PATH" >&2
fi

echo "Volumes directory $VOLUMES_PATH successfully created" >&2
echo '{ "id": "host_path", "value": "'$VOLUMES_PATH'" }'
exit 0



