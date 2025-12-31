# Enable MariaDB Service

Add MariaDB to OpenRC default runlevel

**Execution Target:** lxc

## Capabilities

This template provides the following capabilities:

- Executes command: `rc-update add mariadb default >&2 && echo '[{"id": "mariadb_enabled", "value": "true"}]'`

## Used By Applications

This template is used by the following applications (usage examples):

- [mariadb](../../../../mariadb.md)

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Unnamed Command | Command | `rc-update add mariadb default >&2 && echo '[{"i...` | - |

<!-- GENERATED_END:COMMANDS -->
