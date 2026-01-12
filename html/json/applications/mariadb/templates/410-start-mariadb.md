# Start MariaDB Service

Start the MariaDB service

**Execution Target:** lxc

## Capabilities

This template provides the following capabilities:

- Executes command: `rc-service mariadb start >&2 && echo '[{"id": "mariadb_started", "value": "true"}]'`

## Used By Applications

This template is used by the following applications (usage examples):

- [mariadb](../../../../mariadb.md)

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Start MariaDB | Command | `rc-service mariadb start >&2 && echo '[{"id": "...` | - |

<!-- GENERATED_END:COMMANDS -->
