# phpMyAdmin

phpMyAdmin - web-based MySQL/MariaDB administration tool

## Installation Templates

The following templates are executed in order during installation:

| Template | Description | Status |
|----------|-------------|--------|
| [set-parameters.json](json/applications/phpmyadmin/templates/set-parameters.md) | Set application-specific parameters for phpMyAdmin | ✓ Executed |
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
| [320-enable-community-packages.json](json/applications/phpmyadmin/templates/320-enable-community-packages.md) | Enable Alpine Linux community repository for additional packages | ✓ Executed |
| [330-install-packages.json](json/shared/templates/330-install-packages.md) | Install packages inside the LXC container | ✓ Executed |
| [400-configure-lighttpd.json](json/applications/phpmyadmin/templates/400-configure-lighttpd.md) | Configure lighttpd to enable FastCGI support and set HTTP port | ✓ Executed |
| [410-configure-phpmyadmin.json](json/applications/phpmyadmin/templates/410-configure-phpmyadmin.md) | Configure phpMyAdmin permissions, symlink, cookie encryption key and MariaDB ... | ✓ Executed |
| [420-start-services.json](json/applications/phpmyadmin/templates/420-start-services.md) | Start and enable lighttpd service | ✓ Executed |

<!-- GENERATED_START:PARAMETERS -->
## Parameters

The following parameters can be configured for this application:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `hostname` | string | Yes | phpmyadmin | Hostname for the phpMyAdmin container |
| `http_port` | string | No | 80 | Port number for lighttpd HTTP server (default: 80) ⚙️ Advanced |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:COMMANDS -->
## Installation Commands

The following commands are executed during installation (in order):

| # | Command | Description | Status |
|---|---------|-------------|--------|
| 1 | `MyPhpAdmin Parameters` | - | ✓ Executed |
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
| 15 | `Enable Community Packages` | Enable community repository in /etc/apk/repositories | ✓ Executed |
| 16 | `Install Packages` | Install packages using the appropriate package manager (apk for Alpine, apt for Debian/Ubuntu) | ✓ Executed |
| 17 | `Configure Lighttpd` | Enable mod_fastcgi in lighttpd configuration and set server port | ✓ Executed |
| 18 | `Configure phpMyAdmin` | Set permissions, create symlink, generate cookie encryption key and configure MariaDB connection | ✓ Executed |
| 19 | `Start lighttpd service` | Start and enable lighttpd service | ✓ Executed |

<!-- GENERATED_END:COMMANDS -->

## Features

This application provides the following features (documented in individual template files):

- See [set-parameters.json](json/applications/phpmyadmin/templates/set-parameters.md) for details
- See [010-get-latest-os-template.json](json/shared/templates/010-get-latest-os-template.md) for details
- See [100-create-configure-lxc.json](json/shared/templates/100-create-configure-lxc.md) for details
- See [200-start-lxc.json](json/shared/templates/200-start-lxc.md) for details
- See [210-wait-for-container-ready.json](json/shared/templates/210-wait-for-container-ready.md) for details
- See [320-enable-community-packages.json](json/applications/phpmyadmin/templates/320-enable-community-packages.md) for details
- See [330-install-packages.json](json/shared/templates/330-install-packages.md) for details
- See [400-configure-lighttpd.json](json/applications/phpmyadmin/templates/400-configure-lighttpd.md) for details
- See [410-configure-phpmyadmin.json](json/applications/phpmyadmin/templates/410-configure-phpmyadmin.md) for details
- See [420-start-services.json](json/applications/phpmyadmin/templates/420-start-services.md) for details
