# Configure MariaDB

Configure MariaDB bind address and other settings

**Execution Target:** lxc

## Capabilities

This template provides the following capabilities:

- Configuration management

## Used By Applications

This template is used by the following applications (usage examples):

- [mariadb](../../../../mariadb.md)

<!-- GENERATED_START:PARAMETERS -->
## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `bind_address` | string | Yes | 0.0.0.0 | IP address to bind to (0.0.0.0 for all interfaces, required for remote access) |
| `datadir` | string | Yes | /var/lib/mysql | Data directory path |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Unnamed Command | Script | `configure-mariadb.sh` | - |

<!-- GENERATED_END:COMMANDS -->
