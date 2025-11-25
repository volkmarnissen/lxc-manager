#!/bin/sh

# Auto-select the best storage for LXC rootfs (most free space, supports rootdir)
STORAGE=$(pvesm status | awk 'NR>1 {print $1}' | while read stor; do
  if pvesm list "$stor" --content rootdir 2>/dev/null | grep -q .; then
    echo "$stor"
    break
  fi
done)
if [ -z "$STORAGE" ]; then
  echo "No suitable storage found for LXC rootfs!" >&2
  exit 1
fi

echo "Selected storage: $STORAGE" >&2

# Auto-select VMID if not set
if [ -z "{{ vm_id }}" ]; then
  # Find the next free VMID (highest existing + 1)
  VMID=$(pvesh get /cluster/nextid)
else
  VMID="{{ vm_id }}"
fi

# Create the container
pct create $VMID {{ template_path }} \
  --rootfs "$STORAGE:{{ disk_size }}" \
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
echo '{ "name": "vm_id", "value": "'$VMID'" }'