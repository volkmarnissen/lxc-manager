# Install/Configure Samba

Install and configure Samba with multiple shares. By default, creates Samba shares for all volumes from 'Bind Multiple Volumes to LXC' (160). Optionally, additional shares can be configured.

Shares are created from volumes in key=value format, where the container path /<value> becomes the Samba share with name <key>.

**Execution Target:** lxc

## Capabilities

This template provides the following capabilities:

- Installing Samba packages (supports Alpine Linux apk and Debian/Ubuntu apt)
- Creating Samba user with specified credentials
- Creating shares for all volumes from 'Bind Multiple Volumes to LXC' (160)
- Optionally configuring additional custom shares
- Enabling and starting Samba service

## Used By Applications

This template is used by the following applications (usage examples):

- [macbckpsrv](../../../macbckpsrv.md)

<!-- GENERATED_START:PARAMETERS -->
## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `username` | string | Yes | - | The username for Samba access. |
| `password` | string | Yes | - | The password for the Samba user. 🔒 Secure |
| `volumes` | string | No | - | Volume mappings from 'Bind Multiple Volumes to LXC' (160) in key=value format, one per line. Each volume will be automatically shared via Samba with share name <key> at container path /<value>. Example:
data=/timemachine
logs=/var/log/myapp

If not provided, no automatic shares will be created. ⚙️ Advanced |
| `additional_shares` | string | No |  | Additional Samba shares in share_name=path format, one per line. These are shares that are not part of the volumes from template 160. Example:
backup=/mnt/backup
public=/var/www/public

If not provided, no additional shares will be created. ⚙️ Advanced |
| `uid` | string | Yes | - | UID for setting permissions on Samba share directories. Should match the UID from 'Bind Multiple Volumes to LXC' (160) if volumes are used. |
| `gid` | string | Yes | - | GID for setting permissions on Samba share directories. Should match the GID from 'Bind Multiple Volumes to LXC' (160) if volumes are used. |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Unnamed Command | Script | `install-samba.sh` | Install and configure Samba with multiple shares for volumes and optional additional shares. |

<!-- GENERATED_END:COMMANDS -->
