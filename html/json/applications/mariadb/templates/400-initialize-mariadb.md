# Initialize MariaDB

Initialize MariaDB data directory and prepare the database

**Execution Target:** lxc

## Capabilities

This template provides the following capabilities:

- See template implementation for details

## Used By Applications

This template is used by the following applications (usage examples):

- [mariadb](../../../../mariadb.md)

<!-- GENERATED_START:PARAMETERS -->
## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `datadir` | string | Yes | /var/lib/mysql | Directory where MariaDB stores its data files |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Initialize MariaDB | Script | `initialize-mariadb.sh` | Initialize the MariaDB data directory |

<!-- GENERATED_END:COMMANDS -->
