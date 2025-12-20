
#!/bin/sh
# Installs Samba, configures a share for the given mountpoint, and enables access for the specified user.
# Supports both Alpine Linux (apk) and Debian/Ubuntu (apt-get/apt).
# All output is sent to stderr. No output on stdout.

set -e

MOUNTPOINT="{{ mountpoint }}"
USERNAME="{{ username }}"
PASSWORD="{{ password }}"

# Check that all parameters are not empty
if [ -z "$MOUNTPOINT" ] || [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  echo "Error: All parameters (mountpoint, username, password) must be set and not empty!" >&2
  exit 1
fi

# 1. Install samba and avahi (for macOS Time Machine Bonjour discovery) (detect package manager)
if command -v apk >/dev/null 2>&1; then
  # Alpine Linux
  # Ensure samba-libs is installed (contains VFS modules like fruit and streams_xattr)
  if ! apk add --no-cache samba samba-libs avahi dbus 1>&2; then
    echo "Error: Failed to install Samba, Samba-libs, Avahi, or DBus" >&2
    exit 1
  fi
  # Check if VFS modules are available (required for Time Machine)
  # Modules might be in different locations depending on Alpine version
  VFS_DIRS="/usr/lib/samba/vfs /usr/lib64/samba/vfs /usr/lib/x86_64-linux-gnu/samba/vfs"
  MODULES_FOUND=0
  for VFS_DIR in $VFS_DIRS; do
    if [ -d "$VFS_DIR" ]; then
      if [ -f "$VFS_DIR/fruit.so" ] && [ -f "$VFS_DIR/streams_xattr.so" ]; then
        MODULES_FOUND=1
        echo "Found Samba VFS modules in $VFS_DIR" >&2
        break
      fi
    fi
  done
  if [ "$MODULES_FOUND" -eq 0 ]; then
    echo "Warning: Samba VFS modules (fruit.so or streams_xattr.so) not found in standard locations" >&2
    echo "Warning: macOS Time Machine may not work properly without these modules" >&2
    echo "Warning: Checked directories: $VFS_DIRS" >&2
  fi
elif command -v apt-get >/dev/null 2>&1; then
  # Debian/Ubuntu
  if ! DEBIAN_FRONTEND=noninteractive apt-get update 1>&2; then
    echo "Error: Failed to update package list" >&2
    exit 1
  fi
  if ! DEBIAN_FRONTEND=noninteractive apt-get install -y samba avahi-daemon 1>&2; then
    echo "Error: Failed to install Samba or Avahi" >&2
    exit 1
  fi
elif command -v apt >/dev/null 2>&1; then
  # Debian/Ubuntu (newer versions use apt instead of apt-get)
  if ! DEBIAN_FRONTEND=noninteractive apt update 1>&2; then
    echo "Error: Failed to update package list" >&2
    exit 1
  fi
  if ! DEBIAN_FRONTEND=noninteractive apt install -y samba avahi-daemon 1>&2; then
    echo "Error: Failed to install Samba or Avahi" >&2
    exit 1
  fi
else
  echo "Error: No supported package manager found (apk, apt-get, or apt)" >&2
  exit 1
fi


# 2. Check if user exists (must be created beforehand)
if ! id "$USERNAME" >/dev/null 2>&1; then
  echo "Error: User $USERNAME does not exist. Please create the user before running this script." >&2
  exit 1
fi

# 3. Set samba password for user
if ! printf "%s\n%s\n" "$PASSWORD" "$PASSWORD" | smbpasswd -a -s "$USERNAME" 1>&2; then
  echo "Error: Failed to set Samba password for user $USERNAME" >&2
  exit 1
fi

# 4. Ensure mountpoint exists
if [ ! -d "$MOUNTPOINT" ]; then
  echo "Error: Mountpoint $MOUNTPOINT does not exist!" >&2
  exit 1
fi

# Note: Extended attributes (xattr) support is required for macOS Time Machine
# This is typically supported on ZFS, ext4, XFS, and other modern filesystems

# 5. Configure global Samba settings for macOS Time Machine (only once)
# Check if our global settings marker is already present to avoid duplicates
GLOBAL_MARKER="fruit:model = MacSamba"
if ! grep -q "$GLOBAL_MARKER" /etc/samba/smb.conf 2>/dev/null; then
  # Backup original smb.conf
  if [ -f /etc/samba/smb.conf ] && [ ! -f /etc/samba/smb.conf.orig ]; then
    cp /etc/samba/smb.conf /etc/samba/smb.conf.orig 1>&2
  fi
  
  # Define global settings once (used in both branches below)
  GLOBAL_SETTINGS_BLOCK="  workgroup = WORKGROUP
  server role = standalone server
  security = user
  wide links = yes
  unix extensions = no
  vfs object = acl_xattr catia fruit streams_xattr
  fruit:nfc_aces = no
  fruit:aapl = yes
  fruit:model = MacSamba
  fruit:posix_rename = yes
  fruit:metadata = stream
  fruit:delete_empty_adfiles = yes
  fruit:veto_appledouble = no
  spotlight = yes"
  
  # Find [global] section and add settings after it, or add [global] section if not exists
  if grep -q '^\[global\]' /etc/samba/smb.conf 2>/dev/null; then
    # [global] exists, add our settings after it using sed
    # Convert newlines to \n for sed
    GLOBAL_SETTINGS_SED=$(echo "$GLOBAL_SETTINGS_BLOCK" | sed 's/$/\\/')
    sed -i "/^\[global\]/a\\
$GLOBAL_SETTINGS_SED
" /etc/samba/smb.conf 1>&2
  else
    # [global] doesn't exist, add it at the beginning
    cat > /tmp/samba_global.conf <<GLOBAL_EOF
[global]
$GLOBAL_SETTINGS_BLOCK

GLOBAL_EOF
    cat /tmp/samba_global.conf /etc/samba/smb.conf > /tmp/smb.conf.new 1>&2
    mv /tmp/smb.conf.new /etc/samba/smb.conf 1>&2
    rm -f /tmp/samba_global.conf 1>&2
  fi
fi

# 6. Create share config in conf.d directory
SHARE_NAME=$(basename "$MOUNTPOINT")
CONF_DIR="/etc/samba/conf.d"
CONF_FILE="$CONF_DIR/$SHARE_NAME.conf"

mkdir -p "$CONF_DIR"

cat > "$CONF_FILE" <<EOF
[$SHARE_NAME]
  path = $MOUNTPOINT
  available = yes
  writable = yes
  guest ok = no
  valid users = $USERNAME
  vfs objects = catia fruit streams_xattr
  fruit:time machine = yes
  force user = $USERNAME
  force group = $USERNAME
EOF

# 7. Ensure include = /etc/samba/conf.d/*.conf in main smb.conf
# Check if include line already exists (handle wildcards in grep)
if ! grep -q 'include.*conf\.d' /etc/samba/smb.conf 2>/dev/null; then
  # Add include line with proper newline
  echo "" >> /etc/samba/smb.conf
  echo "include = /etc/samba/conf.d/*.conf" >> /etc/samba/smb.conf
fi

# 8. Configure Avahi for macOS Time Machine Bonjour discovery
AVAHI_SERVICE_DIR="/etc/avahi/services"
mkdir -p "$AVAHI_SERVICE_DIR"

# Get hostname for avahi service
HOSTNAME=$(hostname 2>/dev/null || echo "timemachine")

cat > "$AVAHI_SERVICE_DIR/samba.service" <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
   <name replace-wildcards="yes">%h</name>
   <service>
      <type>_smb._tcp</type>
      <port>445</port>
   </service>
   <service>
      <type>_device-info._tcp</type>
      <port>0</port>
      <txt-record>model=RackMac</txt-record>
   </service>
   <service>
      <type>_adisk._tcp</type>
      <txt-record>sys=waMa=0,adVF=0x100</txt-record>
      <txt-record>dk0=adVN=$SHARE_NAME,adVF=0x82</txt-record>
   </service>
</service-group>
EOF

# 9. Start DBus (required by Avahi on Alpine)
if command -v dbus-daemon >/dev/null 2>&1 && [ ! -S /var/run/dbus/system_bus_socket ]; then
  if command -v rc-service >/dev/null 2>&1; then
    # Try to start dbus via OpenRC
    rc-service dbus start >/dev/null 2>&1 || true
  elif command -v service >/dev/null 2>&1; then
    # Try to start dbus via sysvinit/systemd
    service dbus start >/dev/null 2>&1 || true
  fi
fi

# 10. Enable and start/restart Avahi (restart to reload service files)
if command -v rc-service >/dev/null 2>&1; then
  # Alpine Linux with OpenRC
  rc-update add avahi-daemon default >/dev/null 2>&1 || true
  rc-service avahi-daemon restart >/dev/null 2>&1 || rc-service avahi-daemon start >/dev/null 2>&1 || true
elif command -v systemctl >/dev/null 2>&1; then
  # Debian/Ubuntu with systemd
  systemctl enable avahi-daemon >/dev/null 2>&1 || true
  systemctl restart avahi-daemon >/dev/null 2>&1 || systemctl start avahi-daemon >/dev/null 2>&1 || true
elif command -v service >/dev/null 2>&1; then
  # Fallback for sysvinit
  service avahi-daemon enable >/dev/null 2>&1 || true
  service avahi-daemon restart >/dev/null 2>&1 || service avahi-daemon start >/dev/null 2>&1 || true
fi

# Verify Avahi is running
if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet avahi-daemon 2>/dev/null; then
    echo "Warning: Avahi daemon may not be running. Time Machine discovery may not work." >&2
  fi
fi

# 11. Restart samba
RESTARTED=0
if command -v rc-service >/dev/null 2>&1; then
  if rc-service samba restart 1>&2; then
    RESTARTED=1
  fi
fi

if [ "$RESTARTED" -eq 0 ]; then
  if command -v service >/dev/null 2>&1; then
    if service samba restart 1>&2; then
      RESTARTED=1
    fi
  fi
fi

if [ "$RESTARTED" -eq 0 ]; then
  echo "Error: Failed to restart Samba service (rc-service and service commands failed)" >&2
  exit 1
fi

# Verify Samba configuration
if command -v testparm >/dev/null 2>&1; then
  if ! testparm -s >/dev/null 2>&1; then
    echo "Warning: Samba configuration test failed. Please check the configuration." >&2
  fi
fi

# Verify share is accessible
if command -v smbclient >/dev/null 2>&1; then
  echo "Samba share '$SHARE_NAME' configured at $MOUNTPOINT" >&2
else
  echo "Samba share '$SHARE_NAME' configured at $MOUNTPOINT" >&2
fi

echo "Configuration file: $CONF_FILE" >&2
echo "Note: If macOS Time Machine still shows 'necessary features not supported'," >&2
echo "      this may be an Alpine Linux compatibility issue. Consider using Debian/Ubuntu." >&2
