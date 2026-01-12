# Secure MariaDB Installation

Run mariadb-secure-installation to secure the database

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
| `root_password` | string | No | - | Password for the MariaDB root user 🔒 Secure |
| `remove_anonymous_users` | boolean | No | true | Remove anonymous users |
| `allow_remote_root` | boolean | No | false | Allow root login from remote hosts |
| `remove_test_database` | boolean | No | true | Remove the test database |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Unnamed Command | Script | `secure-mariadb.sh` | - |

<!-- GENERATED_END:COMMANDS -->
