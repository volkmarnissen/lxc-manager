#!/bin/sh


# Auto-select the best storage for LXC rootfs
# Prefer local-zfs if available, otherwise use storage with most free space (supports rootdir)

# First, check if local-zfs exists and supports rootdir
PREFERRED_STORAGE=""
if pvesm list "local-zfs" --content rootdir 2>/dev/null | grep -q .; then
  PREFERRED_STORAGE="local-zfs"
  echo "Using preferred storage: local-zfs" >&2
fi

# If local-zfs is not available, find storage with most free space
if [ -z "$PREFERRED_STORAGE" ]; then
  ROOTFS_RESULT=$(pvesm status | awk 'NR>1 {print $1, $6}' | while read stor free; do
    if pvesm list "$stor" --content rootdir 2>/dev/null | grep -q .; then
      if pvesm status --storage "$stor" | grep -q zfs; then
        echo "$free $stor size"
      else
        echo "$free $stor normal"
      fi
    fi
  done | sort -nr | head -n1)

  set -- $ROOTFS_RESULT
  PREFERRED_STORAGE=$2
fi

if [ -z "$PREFERRED_STORAGE" ]; then
  echo "No suitable storage found for LXC rootfs!" >&2
  exit 1
fi

stor="$PREFERRED_STORAGE"

ROOTFS="$stor:$(({{ disk_size }} * 1024))"
echo "Rootfs: $ROOTFS" >&2

# Auto-select VMID if not set
if [ -z "{{ vm_id }}" ]; then
  # Find the next free VMID (highest existing + 1)
  VMID=$(pvesh get /cluster/nextid)
else
  VMID="{{ vm_id }}"
fi

# Check that template_path is set
TEMPLATE_PATH="{{ template_path }}"
if [ -z "$TEMPLATE_PATH" ] || [ "$TEMPLATE_PATH" = "" ]; then
  echo "Error: template_path parameter is empty or not set!" >&2
  echo "Please ensure that 010-get-latest-os-template.json template is executed before 100-create-configure-lxc.json" >&2
  exit 1
fi

# Create the container
pct create "$VMID" "$TEMPLATE_PATH" \
  --rootfs "$ROOTFS" \
  --hostname "{{ hostname }}" \
  --memory "{{ memory }}" \
  --net0 name=eth0,bridge="{{ bridge }}",ip=dhcp \
  --ostype "{{ ostype }}" \
  --unprivileged 1 >&2
RC=$? 
if [ $RC -ne 0 ]; then
  echo "Failed to create LXC container!" >&2
  exit $RC
fi
echo "LXC container $VMID ({{ hostname }}) created." >&2

# Configure UID/GID mapping if uid and gid are provided
UID_VALUE="{{ uid }}"
GID_VALUE="{{ gid }}"
if [ -n "$UID_VALUE" ] && [ -n "$GID_VALUE" ] && [ "$UID_VALUE" != "" ] && [ "$GID_VALUE" != "" ]; then
  CONFIG_FILE="/etc/pve/lxc/${VMID}.conf"
  
  # Check if mapping is already configured
  if ! grep -q "^lxc\.idmap = u $UID_VALUE $UID_VALUE 1" "$CONFIG_FILE" 2>/dev/null; then
    # Calculate the default mapping range based on VMID
    # Proxmox default: Host UID = Container UID + 100000 + (VMID * 65536)
    HOST_UID_BASE=$((100000 + VMID * 65536))
    
    # Remove existing lxc.idmap entries if present
    sed -i '/^lxc\.idmap =/d' "$CONFIG_FILE" >&2
    
    # Map UIDs 0 to (UID_VALUE-1) to host range
    if [ "$UID_VALUE" -gt 0 ]; then
      BEFORE_COUNT=$UID_VALUE
      echo "lxc.idmap = u 0 $HOST_UID_BASE $BEFORE_COUNT" >> "$CONFIG_FILE" 2>&1
      echo "lxc.idmap = g 0 $HOST_UID_BASE $BEFORE_COUNT" >> "$CONFIG_FILE" 2>&1
    fi
    
    # Map the specific UID/GID directly (1:1 mapping)
    echo "lxc.idmap = u $UID_VALUE $UID_VALUE 1" >> "$CONFIG_FILE" 2>&1
    echo "lxc.idmap = g $GID_VALUE $GID_VALUE 1" >> "$CONFIG_FILE" 2>&1
    
    # Map remaining UIDs (UID_VALUE+1) to 65535 to host range
    AFTER_START=$((HOST_UID_BASE + UID_VALUE + 1))
    AFTER_COUNT=$((65536 - UID_VALUE - 1))
    if [ "$AFTER_COUNT" -gt 0 ]; then
      AFTER_CONTAINER_START=$((UID_VALUE + 1))
      echo "lxc.idmap = u $AFTER_CONTAINER_START $AFTER_START $AFTER_COUNT" >> "$CONFIG_FILE" 2>&1
      echo "lxc.idmap = g $AFTER_CONTAINER_START $AFTER_START $AFTER_COUNT" >> "$CONFIG_FILE" 2>&1
    fi
    
    echo "Configured UID/GID mapping for container $VMID:" >&2
    echo "  UID $UID_VALUE in container -> UID $UID_VALUE on host" >&2
    echo "  GID $GID_VALUE in container -> GID $GID_VALUE on host" >&2
    
    # Update /etc/subuid and /etc/subgid if needed
    if ! grep -q "^root:${UID_VALUE}:1" /etc/subuid 2>/dev/null; then
      echo "Adding root:${UID_VALUE}:1 to /etc/subuid" >&2
      echo "root:${UID_VALUE}:1" >> /etc/subuid 2>&1
    fi
    
    if ! grep -q "^root:${GID_VALUE}:1" /etc/subgid 2>/dev/null; then
      echo "Adding root:${GID_VALUE}:1 to /etc/subgid" >&2
      echo "root:${GID_VALUE}:1" >> /etc/subgid 2>&1
    fi
  else
    echo "UID mapping for $UID_VALUE already configured, skipping." >&2
  fi
fi

echo '{ "id": "vm_id", "value": "'$VMID'" }'