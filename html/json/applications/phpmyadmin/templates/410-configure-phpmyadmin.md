# Configure phpMyAdmin

Configure phpMyAdmin permissions, symlink, cookie encryption key and MariaDB connection

**Execution Target:** lxc

## Capabilities

This template provides the following capabilities:

- Configuration management

## Used By Applications

This template is used by the following applications (usage examples):

- [phpmyadmin](../../../../phpmyadmin.md)

<!-- GENERATED_START:PARAMETERS -->
## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `db_host` | string | Yes | mariadb | Hostname or IP address of the MariaDB server ⚙️ Advanced |
| `db_port` | string | No | 3306 | Port number of the MariaDB server ⚙️ Advanced |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Unnamed Command | Script | `configure-phpmyadmin.sh` | Set permissions, create symlink, generate cookie encryption key and configure MariaDB connection |

<!-- GENERATED_END:COMMANDS -->
