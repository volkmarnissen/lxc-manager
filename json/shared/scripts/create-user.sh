#!/bin/sh
# Usage: create-user.sh <username> [uid] [gid]
#
# create-user.sh: Creates a user with specified username, optional UID, optional GID, and home directory (no password, no login).
# Supports both Alpine Linux (addgroup/adduser) and Debian/Ubuntu (groupadd/useradd).
#
# - Creates group and user if not present
# - Sets up home directory
# - UID and GID are optional; if not provided, the system will assign them automatically
#
# All output is sent to stderr. Script is POSIX-compliant and produces no output on stdout.
set -e
USERNAME="{{ username }}"
UID_VALUE="{{ uid }}"
GID_VALUE="{{ gid }}"

# Check that username is not empty
if [ -z "$USERNAME" ]; then
  echo "Error: Username must be set and not empty!" >&2
  exit 1
fi

# Detect system type (Alpine uses addgroup/adduser, Debian uses groupadd/useradd)
# Note: Debian/Ubuntu has both, so we check for useradd/groupadd first (preferred for scripts)
if command -v groupadd >/dev/null 2>&1 && command -v useradd >/dev/null 2>&1; then
  # Debian/Ubuntu (useradd/groupadd are standard for non-interactive use)
  SYSTEM_TYPE="debian"
  GROUPADD_CMD="groupadd"
  USERADD_CMD="useradd"
elif command -v addgroup >/dev/null 2>&1 && command -v adduser >/dev/null 2>&1; then
  # Alpine Linux (only has addgroup/adduser)
  SYSTEM_TYPE="alpine"
  GROUPADD_CMD="addgroup"
  USERADD_CMD="adduser"
else
  echo "Error: Neither Debian (groupadd/useradd) nor Alpine (addgroup/adduser) commands found!" >&2
  exit 1
fi

# 1. Create group if not exists
GROUP_CREATED=0
if ! getent group "$USERNAME" >/dev/null 2>&1; then
  GROUP_CREATED=1
  if [ -n "$GID_VALUE" ] && [ "$GID_VALUE" != "" ]; then
    # Check if GID is already in use
    if ! getent group "$GID_VALUE" >/dev/null 2>&1; then
      if [ "$SYSTEM_TYPE" = "alpine" ]; then
        $GROUPADD_CMD -g "$GID_VALUE" "$USERNAME" 1>&2
      else
        $GROUPADD_CMD -g "$GID_VALUE" "$USERNAME" 1>&2
      fi
    else
      # GID is in use, create group without specifying GID
      echo "Warning: GID $GID_VALUE is already in use, creating group with auto-assigned GID" >&2
      $GROUPADD_CMD "$USERNAME" 1>&2
    fi
  else
    # No GID specified, create group with auto-assigned GID
    $GROUPADD_CMD "$USERNAME" 1>&2
  fi
fi

# Get the actual GID of the group (may have been auto-assigned)
ACTUAL_GID=$(getent group "$USERNAME" | cut -d: -f3)

if [ "$GROUP_CREATED" -eq 1 ]; then
  echo "Group '$USERNAME' created successfully with GID:$ACTUAL_GID" >&2
fi

# 2. Create user if not exists
USER_CREATED=0
if ! id -u "$USERNAME" >/dev/null 2>&1; then
  if [ -n "$UID_VALUE" ] && [ "$UID_VALUE" != "" ]; then
    # UID specified, use it
    if [ "$SYSTEM_TYPE" = "alpine" ]; then
      # Alpine adduser: -D = don't assign password, -h = home dir, -s = shell, -G = group, -u = uid
      $USERADD_CMD -D -h "/home/$USERNAME" -s /sbin/nologin -G "$USERNAME" -u "$UID_VALUE" "$USERNAME" 1>&2
    else
      # Debian useradd: -u = uid, -g = group, -M = no home, -N = no group, -s = shell, -d = home dir
      $USERADD_CMD -u "$UID_VALUE" -g "$ACTUAL_GID" -M -N -s /usr/sbin/nologin -d "/home/$USERNAME" "$USERNAME" 1>&2
    fi
    ACTUAL_UID="$UID_VALUE"
  else
    # No UID specified, let system assign it
    if [ "$SYSTEM_TYPE" = "alpine" ]; then
      $USERADD_CMD -D -h "/home/$USERNAME" -s /sbin/nologin -G "$USERNAME" "$USERNAME" 1>&2
    else
      $USERADD_CMD -g "$ACTUAL_GID" -M -N -s /usr/sbin/nologin -d "/home/$USERNAME" "$USERNAME" 1>&2
    fi
    ACTUAL_UID=$(id -u "$USERNAME")
  fi
  # Create home directory and set permissions
  # Alpine adduser creates it by default, Debian useradd -M doesn't, so always create it
  mkdir -p "/home/$USERNAME" 1>&2
  chown "$ACTUAL_UID:$ACTUAL_GID" "/home/$USERNAME" 1>&2
  USER_CREATED=1
fi

# Get actual UID and GID (in case user already existed)
ACTUAL_UID=$(id -u "$USERNAME" 2>/dev/null || echo "")
ACTUAL_GID=$(id -g "$USERNAME" 2>/dev/null || echo "")

# Output result
if [ "$USER_CREATED" -eq 1 ]; then
  echo "User '$USERNAME' created successfully with UID:$ACTUAL_UID GID:$ACTUAL_GID" >&2
else
  echo "User '$USERNAME' already exists with UID:$ACTUAL_UID GID:$ACTUAL_GID" >&2
fi

