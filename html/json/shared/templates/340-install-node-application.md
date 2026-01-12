# Install Node Application

Install a Node.js application globally via npm

**Execution Target:** lxc

## Capabilities

This template provides the following capabilities:

- Package installation

## Used By Applications

This template is used by the following applications (usage examples):

- [node-red](../../../node-red.md)

<!-- GENERATED_START:PARAMETERS -->
## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `package` | string | Yes | - | Name of the npm package to install |
| `version` | string | No | latest | Version of the package to install ⚙️ Advanced |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:OUTPUTS -->
## Outputs

| Output ID | Default | Description |
|-----------|---------|-------------|
| `settings_path` | - | - |

<!-- GENERATED_END:OUTPUTS -->

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Unnamed Command | Script | `install-node-application.sh` | Install the npm package globally |

<!-- GENERATED_END:COMMANDS -->
