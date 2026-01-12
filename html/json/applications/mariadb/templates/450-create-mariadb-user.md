# Create MariaDB User / Database

Create a MariaDB user and database with full permissions

**Execution Target:** lxc

## Capabilities

This template provides the following capabilities:

- Resource creation

<!-- GENERATED_START:PARAMETERS -->
## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `db_user` | string | Yes | - | Username for the MariaDB user |
| `db_password` | string | Yes | - | Password for the MariaDB user 🔒 Secure |
| `db_name` | string | Yes | - | Name of the database to create |
| `db_host` | string | No | % | Host from which the user can connect (use % for any host, localhost for local only) ⚙️ Advanced |
| `root_password` | string | No | - | MariaDB root password (required if root password was set during installation) 🔒 Secure |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Unnamed Command | Script | `create-mariadb-user.sh` | - |

<!-- GENERATED_END:COMMANDS -->
