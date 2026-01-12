# MariaDB

MariaDB database server

## Installation Templates

The following templates are executed in order during installation:

| Template | Description | Status |
|----------|-------------|--------|
| [set-parameters.json](json/applications/mariadb/templates/set-parameters.md) | Set application-specific parameters for MariaDB | ✓ Executed |
| [010-get-latest-os-template.json](json/shared/templates/010-get-latest-os-template.md) | Download latest operating system template for Proxmox | ✓ Executed |
| [100-create-configure-lxc.json](json/shared/templates/100-create-configure-lxc.md) | Creates LXC container and applies optional configurations (templates 101-199) | ✓ Executed |
| └─ [104-lxc-static-ip-prefix.json](json/shared/templates/104-lxc-static-ip-prefix.md) | Optional step: Derive static IPv4/IPv6 from prefixes and VMID, emit... | <span style="color: #ffa500; font-weight: bold;">⚙️ Conditional (requires parameters)</span> |
| └─ [105-set-static-ip-for-lxc.json](json/shared/templates/105-set-static-ip-for-lxc.md) | Edit LXC network settings for a container with static IPs | <span style="color: #ff6b6b; font-weight: bold;">⏭️ All Commands Skipped</span> |
| └─ [106-update-etc-hosts-on-ve.json](json/shared/templates/106-update-etc-hosts-on-ve.md) | Optional template to update /etc/hosts with hostname and static IP ... | <span style="color: #ff6b6b; font-weight: bold;">⏭️ All Commands Skipped</span> |
| └─ [110-map-serial.json](json/shared/templates/110-map-serial.md) | Map serial device to VM | <span style="color: #ff6b6b; font-weight: bold;">⏭️ All Commands Skipped</span> |
| └─ [120-mount-disk-on-host.json](json/shared/templates/120-mount-disk-on-host.md) | Mounts a block device (by UUID) on the Proxmox host | ✓ Executed |
| └─ [121-mount-zfs-pool-on-host.json](json/shared/templates/121-mount-zfs-pool-on-host.md) | Creates a subdirectory under a ZFS pool mountpoint on the Proxmox host | <span style="color: #ffa500; font-weight: bold;">⚙️ Conditional (requires parameters)</span> |
| └─ [160-bind-multiple-volumes-to-lxc.json](json/shared/templates/160-bind-multiple-volumes-to-lxc.md) | Binds multiple host directories to an LXC container | <span style="color: #ffa500; font-weight: bold;">⚙️ Conditional (requires parameters)</span> |
| └─ [170-set-environment-variables-in-lxc.json](json/shared/templates/170-set-environment-variables-in-lxc.md) | Sets environment variables in an LXC container configuration | <span style="color: #ffa500; font-weight: bold;">⚙️ Conditional (requires parameters)</span> |
| [200-start-lxc.json](json/shared/templates/200-start-lxc.md) | Start existing LXC container on Proxmox host | ✓ Executed |
| [210-wait-for-container-ready.json](json/shared/templates/210-wait-for-container-ready.md) | Wait until LXC container is ready (network + apk available) | ✓ Executed |
| [330-install-packages.json](json/shared/templates/330-install-packages.md) | Install packages inside the LXC container | ✓ Executed |
| [400-initialize-mariadb.json](json/applications/mariadb/templates/400-initialize-mariadb.md) | Initialize MariaDB data directory and prepare the database | ✓ Executed |
| [430-configure-mariadb.json](json/applications/mariadb/templates/430-configure-mariadb.md) | Configure MariaDB bind address and other settings | ✓ Executed |
| [410-start-mariadb.json](json/applications/mariadb/templates/410-start-mariadb.md) | Start the MariaDB service | ✓ Executed |
| [420-secure-mariadb.json](json/applications/mariadb/templates/420-secure-mariadb.md) | Run mariadb-secure-installation to secure the database | ✓ Executed |
| [440-enable-mariadb.json](json/applications/mariadb/templates/440-enable-mariadb.md) | Add MariaDB to OpenRC default runlevel | ✓ Executed |

<!-- GENERATED_START:PARAMETERS -->
## Parameters

The following parameters can be configured for this application:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `hostname` | string | Yes | mariadb | Hostname for the MariaDB container |
| `datadir` | string | No | /var/lib/mysql | Directory where MariaDB stores its data files ⚙️ Advanced |
| `root_password` | string | No | - | Password for the MariaDB root user. If not set, Unix socket authentication will be used. 🔒 Secure |
| `bind_address` | string | No | 0.0.0.0 | IP address to bind to. Use 0.0.0.0 to accept connections from all interfaces (required for remote access, e.g., from phpMyAdmin) ⚙️ Advanced |
| `allow_remote_root` | boolean | No | true | Allow root user to connect from remote hosts (not recommended for security) ⚙️ Advanced |
| `remove_anonymous_users` | boolean | No | true | Remove anonymous users created for socket authentication ⚙️ Advanced |
| `remove_test_database` | boolean | No | true | Remove the default test database |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:COMMANDS -->
## Installation Commands

The following commands are executed during installation (in order):

| # | Command | Description | Status |
|---|---------|-------------|--------|
| 1 | `Set Parameters` | - | ✓ Executed |
| 2 | `Latest OS Template` | - | ✓ Executed |
| 3 | `Configure subuid/subgid` | - | ✓ Executed |
| 4 | `Create LXC container` | - | ✓ Executed |
| 5 | `Compute Static IPs (skipped)` | Skipped: all required parameters missing | ⏭️ Skipped |
| 6 | `lxc-static-ip (skipped)` | Skipped: all required parameters missing | ⏭️ Skipped |
| 7 | `lxc-update-etc-hosts (skipped)` | Skipped: all required parameters missing | ⏭️ Skipped |
| 8 | `Map Serial Device (skipped)` | Skipped: all required parameters missing | ⏭️ Skipped |
| 9 | `Mount Disk on Host` | Executes the script to mount the disk by UUID on the host. | ✓ Executed |
| 10 | `Mount ZFS Pool on Host` | Executes the script to create a subdirectory under the ZFS pool mountpoint on the host. | ✓ Executed |
| 11 | `Bind Multiple Volumes to LXC` | Executes the script to bind multiple volumes in the container. | ✓ Executed |
| 12 | `Env Variables in LXC (skipped)` | Skipped: all required parameters missing | ⏭️ Skipped |
| 13 | `Start LXC Container` | - | ✓ Executed |
| 14 | `Wait for Container` | Poll host until the LXC container reports readiness (network up, apk reachable) | ✓ Executed |
| 15 | `Install Packages` | Install packages using the appropriate package manager (apk for Alpine, apt for Debian/Ubuntu) | ✓ Executed |
| 16 | `Initialize MariaDB` | Initialize the MariaDB data directory | ✓ Executed |
| 17 | `Configure MariaDB` | - | ✓ Executed |
| 18 | `Start MariaDB` | - | ✓ Executed |
| 19 | `Secure MariaDB Installation` | - | ✓ Executed |
| 20 | `Enable MariaDB Service` | - | ✓ Executed |

<!-- GENERATED_END:COMMANDS -->

## Features

This application provides the following features (documented in individual template files):

- See [set-parameters.json](json/applications/mariadb/templates/set-parameters.md) for details
- See [010-get-latest-os-template.json](json/shared/templates/010-get-latest-os-template.md) for details
- See [100-create-configure-lxc.json](json/shared/templates/100-create-configure-lxc.md) for details
- See [200-start-lxc.json](json/shared/templates/200-start-lxc.md) for details
- See [210-wait-for-container-ready.json](json/shared/templates/210-wait-for-container-ready.md) for details
- See [330-install-packages.json](json/shared/templates/330-install-packages.md) for details
- See [400-initialize-mariadb.json](json/applications/mariadb/templates/400-initialize-mariadb.md) for details
- See [430-configure-mariadb.json](json/applications/mariadb/templates/430-configure-mariadb.md) for details
- See [410-start-mariadb.json](json/applications/mariadb/templates/410-start-mariadb.md) for details
- See [420-secure-mariadb.json](json/applications/mariadb/templates/420-secure-mariadb.md) for details
- See [440-enable-mariadb.json](json/applications/mariadb/templates/440-enable-mariadb.md) for details
