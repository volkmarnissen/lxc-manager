# Create and Enable Service

Create, enable and start a service. Supports both Alpine Linux (OpenRC) and Debian/Ubuntu (systemd). If the service already exists (e.g., mosquitto-openrc), it will be enabled and started without creating a new service.

**Execution Target:** lxc

## Capabilities

This template provides the following capabilities:

- Creating a system user for the service (if username/uid/gid provided)
- Creating service directories and setting ownership
- Creating service configuration file (OpenRC or systemd)
- Enabling and starting the service
- Configuring privileged port binding if needed

## Used By Applications

This template is used by the following applications (usage examples):

- [node-red](../../../node-red.md)

<!-- GENERATED_START:PARAMETERS -->
## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `command` | string | Yes | - | The command to run (also used as service name) |
| `username` | string | No | - | Optional username for the service. If not provided, the command name will be used as username. |
| `command_args` | string | No |  | Arguments for the command. Available variables: $HOME_DIR, $DATA_DIR, $SECURE_DIR |
| `uid` | string | No |  | Optional user ID (defaults to auto-assigned) |
| `group` | string | No |  | Optional group name (will be created if not exists) |
| `owned_paths` | string | No |  | Space-separated list of files/directories the user should own with rw access |
| `bind_privileged_port` | boolean | No | false | Allow service to bind to privileged ports (e.g., 80, 443) by setting CAP_NET_BIND_SERVICE capability ⚙️ Advanced |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:OUTPUTS -->
## Outputs

| Output ID | Default | Description |
|-----------|---------|-------------|
| `logfile_path` | - | - |

<!-- GENERATED_END:OUTPUTS -->

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Create and Enable Service | Script | `create-enable-service.sh` | Create user, service file, enable and start the service |

<!-- GENERATED_END:COMMANDS -->
