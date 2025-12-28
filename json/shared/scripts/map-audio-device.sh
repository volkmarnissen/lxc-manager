#!/bin/sh
# Map audio device to LXC container
# Requires: audio_card in format card0, card1, etc.
# Library: usb-device-common.sh (automatically prepended)
exec >&2

# Check required parameters
if [ -z "{{ audio_card }}" ] || [ "{{ audio_card }}" = "" ]; then
  echo "Error: audio_card parameter is required (format: card0, card1, etc.)" >&2
  exit 1
fi

# Extract card number from audio_card parameter
AUDIO_CARD="{{ audio_card }}"
CARD_NUMBER=$(echo "$AUDIO_CARD" | sed 's/card//')

# Validate card number
if [ -z "$CARD_NUMBER" ] || ! echo "$CARD_NUMBER" | grep -qE '^[0-9]+$'; then
  echo "Error: Invalid audio_card format. Expected format: card0, card1, etc." >&2
  exit 1
fi

# Verify card exists
if [ ! -e "/sys/class/sound/$AUDIO_CARD" ]; then
  echo "Error: Audio card $AUDIO_CARD does not exist" >&2
  exit 1
fi

# Find all audio devices for this card
AUDIO_DEVICES=""
# Control device
if [ -e "/dev/snd/controlC$CARD_NUMBER" ]; then
  AUDIO_DEVICES="$AUDIO_DEVICES /dev/snd/controlC$CARD_NUMBER"
fi
# PCM devices (playback and capture)
for PCM_DEV in /dev/snd/pcmC${CARD_NUMBER}D*p /dev/snd/pcmC${CARD_NUMBER}D*c; do
  if [ -e "$PCM_DEV" ]; then
    AUDIO_DEVICES="$AUDIO_DEVICES $PCM_DEV"
  fi
done
# Timer device (shared, only map once)
if [ -e "/dev/snd/timer" ] && ! echo "$AUDIO_DEVICES" | grep -q "/dev/snd/timer"; then
  AUDIO_DEVICES="$AUDIO_DEVICES /dev/snd/timer"
fi

if [ -z "$AUDIO_DEVICES" ]; then
  echo "Error: Could not find audio devices for card $AUDIO_CARD" >&2
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

# Remove existing devX: entries for this card (but keep other entries)
# We identify entries by checking if they contain /dev/snd/controlC$CARD_NUMBER
sed -i "/dev[0-9]*:.*\/dev\/snd\/controlC$CARD_NUMBER/d" "$CONFIG_FILE" 2>/dev/null || true

# Map each audio device
for DEVICE in $AUDIO_DEVICES; do
  DEV_INDEX=$(get_next_dev_index "$CONFIG_FILE")
  add_cgroup_allow "$CONFIG_FILE" "$DEVICE"
  echo "$DEV_INDEX: $DEVICE,uid=$CONTAINER_UID,gid=$CONTAINER_GID,mode=0666" >> "$CONFIG_FILE"
done

# Determine if this is a USB device and map USB bus if needed
# Check if device is USB by navigating from /sys/class/sound/cardX/device
USB_BUS_PATH=""
if [ -e "/sys/class/sound/$AUDIO_CARD/device" ]; then
  if find_vendor_product_from_class_device "sound" "$AUDIO_CARD"; then
    # Try to find USB device
    if find_usb_device_by_vendor_product "$VENDOR_ID" "$PRODUCT_ID" "$AUDIO_CARD" "sound/card*"; then
      USB_BUS_PATH=$(get_usb_bus_path "$USB_BUS" "$USB_DEVICE")
      if [ -n "$USB_BUS_PATH" ] && [ -e "$USB_BUS_PATH" ]; then
        # Map USB bus device using library function
        map_usb_bus_device "$CONFIG_FILE" "$USB_BUS_PATH" "$CONTAINER_UID" "$CONTAINER_GID"
        set_device_permissions "$USB_BUS_PATH" "$CONTAINER_UID" "$CONTAINER_GID" "0664"
      fi
    fi
  fi
fi

# Set permissions for all devices using library function
for DEVICE in $AUDIO_DEVICES; do
  set_device_permissions "$DEVICE" "$CONTAINER_UID" "$CONTAINER_GID" "0666"
done

# Create udev rule for USB devices only (PCI devices don't need udev rules)
if [ -n "$USB_BUS_PATH" ] && command -v udevadm >/dev/null 2>&1; then
  SYSFS_PATH=$(find_usb_sysfs_path "$USB_BUS" "$USB_DEVICE")
  if [ -n "$SYSFS_PATH" ] && get_vendor_product_id "$SYSFS_PATH"; then
    MAPPED_UID=$((CONTAINER_UID + 100000))
    MAPPED_GID=$((CONTAINER_GID + 100000))
    RULE_FILE="/etc/udev/rules.d/99-lxc-audio-{{ vm_id }}-${VENDOR_ID}-${PRODUCT_ID}.rules"
    create_udev_rule "$RULE_FILE" "$VENDOR_ID" "$PRODUCT_ID" "sound" "$MAPPED_UID" "$MAPPED_GID" "0666"
    # Reload and trigger udev rules
    udevadm control --reload-rules >&2
    udevadm trigger --subsystem-match=sound --attr-match=idVendor="$VENDOR_ID" --attr-match=idProduct="$PRODUCT_ID" >&2
    udevadm trigger --subsystem-match=usb --attr-match=idVendor="$VENDOR_ID" --attr-match=idProduct="$PRODUCT_ID" >&2
  fi
fi

exit 0
