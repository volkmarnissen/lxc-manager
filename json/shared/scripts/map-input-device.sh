#!/bin/sh
# Map input device (keyboard/mouse) to LXC container
# Requires: usb_bus_device in format bus:device
# Library: usb-device-common.sh (automatically prepended)
exec >&2

# Check required parameters
if [ -z "{{ usb_bus_device }}" ] || [ "{{ usb_bus_device }}" = "" ]; then
  echo "Error: usb_bus_device parameter is required (format: bus:device)" >&2
  exit 1
fi

# Parse USB bus:device using library function
if ! parse_usb_bus_device "{{ usb_bus_device }}"; then
  exit 1
fi

# Get USB bus path using library function
USB_BUS_PATH=$(get_usb_bus_path "$USB_BUS" "$USB_DEVICE")
if [ -z "$USB_BUS_PATH" ] || [ ! -e "$USB_BUS_PATH" ]; then
  echo "Error: USB bus path $USB_BUS_PATH does not exist" >&2
  exit 1
fi

# Find input devices associated with this USB bus/device
SYSFS_BASE="/sys/bus/usb/devices"
SYSFS_PATTERN="$USB_BUS-$USB_DEVICE"
INPUT_DEVICES=""

# Search in sysfs for input devices (check base path and all interface paths)
SYSFS_BASE_PATH="$SYSFS_BASE/$SYSFS_PATTERN"
if [ -d "$SYSFS_BASE_PATH" ]; then
  # Check for input/input*/event* pattern
  for INPUT_DIR in "$SYSFS_BASE_PATH"/input/input*/event*; do
    [ ! -d "$INPUT_DIR" ] && continue
    EVENT_NAME=$(basename "$INPUT_DIR")
    if [ -e "/dev/input/$EVENT_NAME" ]; then
      INPUT_DEVICES="$INPUT_DEVICES /dev/input/$EVENT_NAME"
    fi
  done
fi

# Try interface paths if not found
if [ -z "$INPUT_DEVICES" ]; then
  for SYSFS_PATH in $SYSFS_BASE/$SYSFS_PATTERN:*; do
    [ ! -d "$SYSFS_PATH" ] && continue
    for INPUT_DIR in "$SYSFS_PATH"/input/input*/event*; do
      [ ! -d "$INPUT_DIR" ] && continue
      EVENT_NAME=$(basename "$INPUT_DIR")
      if [ -e "/dev/input/$EVENT_NAME" ]; then
        INPUT_DEVICES="$INPUT_DEVICES /dev/input/$EVENT_NAME"
      fi
    done
  done
fi

# Also check /sys/class/input/event* for devices linked to this USB device
if [ -z "$INPUT_DEVICES" ]; then
  for EVENT_DEV in /sys/class/input/event*; do
    [ ! -e "$EVENT_DEV/device" ] && continue
    EVENT_NAME=$(basename "$EVENT_DEV")
    # Check if this event device is linked to our USB device by checking sysfs
    # Navigate from /sys/class/input/eventX/device to find USB device
    if find_vendor_product_from_class_device "input" "$EVENT_NAME"; then
      # Check if vendor/product matches our USB device
      SYSFS_PATH=$(find_usb_sysfs_path "$USB_BUS" "$USB_DEVICE")
      if [ -n "$SYSFS_PATH" ]; then
        SYSFS_VENDOR=$(cat "$SYSFS_PATH/idVendor" 2>/dev/null | tr -d '\n\r' || echo "")
        SYSFS_PRODUCT=$(cat "$SYSFS_PATH/idProduct" 2>/dev/null | tr -d '\n\r' || echo "")
        if [ "$SYSFS_VENDOR" = "$VENDOR_ID" ] && [ "$SYSFS_PRODUCT" = "$PRODUCT_ID" ]; then
          if [ -e "/dev/input/$EVENT_NAME" ]; then
            INPUT_DEVICES="$INPUT_DEVICES /dev/input/$EVENT_NAME"
          fi
        fi
      fi
    fi
  done
fi

if [ -z "$INPUT_DEVICES" ]; then
  echo "Error: Could not find input device for USB bus $USB_BUS device $USB_DEVICE" >&2
  exit 1
fi

# Get container UID/GID (default 1000)
UID_VALUE="{{ uid }}"
GID_VALUE="{{ gid }}"
CONTAINER_UID="${UID_VALUE:-1000}"
CONTAINER_GID="${GID_VALUE:-1000}"

CONFIG_FILE="/etc/pve/lxc/{{ vm_id }}.conf"

# Check container is stopped using library function
if ! check_container_stopped "{{ vm_id }}"; then
  echo "Error: Container {{ vm_id }} is running. Please stop it before mapping devices." >&2
  exit 1
fi

# Remove existing devX: entries (but keep other entries)
sed -i '/^dev[0-9]*:/d' "$CONFIG_FILE"

# Map each input device
for DEVICE in $INPUT_DEVICES; do
  DEV_INDEX=$(get_next_dev_index "$CONFIG_FILE")
  add_cgroup_allow "$CONFIG_FILE" "$DEVICE"
  echo "$DEV_INDEX: $DEVICE,uid=$CONTAINER_UID,gid=$CONTAINER_GID,mode=0666" >> "$CONFIG_FILE"
done

# Map USB bus device using library function (once)
map_usb_bus_device "$CONFIG_FILE" "$USB_BUS_PATH" "$CONTAINER_UID" "$CONTAINER_GID"

# Set permissions for all devices using library function
for DEVICE in $INPUT_DEVICES; do
  set_device_permissions "$DEVICE" "$CONTAINER_UID" "$CONTAINER_GID" "0666"
done
set_device_permissions "$USB_BUS_PATH" "$CONTAINER_UID" "$CONTAINER_GID" "0664"

# Create udev rule using library function
if command -v udevadm >/dev/null 2>&1; then
  SYSFS_PATH=$(find_usb_sysfs_path "$USB_BUS" "$USB_DEVICE")
  if [ -n "$SYSFS_PATH" ] && get_vendor_product_id "$SYSFS_PATH"; then
    MAPPED_UID=$((CONTAINER_UID + 100000))
    MAPPED_GID=$((CONTAINER_GID + 100000))
    RULE_FILE="/etc/udev/rules.d/99-lxc-input-{{ vm_id }}-${VENDOR_ID}-${PRODUCT_ID}.rules"
    create_udev_rule "$RULE_FILE" "$VENDOR_ID" "$PRODUCT_ID" "input" "$MAPPED_UID" "$MAPPED_GID" "0666"
  fi
fi

exit 0

