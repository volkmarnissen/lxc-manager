# Import Flow

Import a Node-RED flow from a JSON file or URL

**Execution Target:** host:node-red

## Capabilities

This template provides the following capabilities:

- See template implementation for details

<!-- GENERATED_START:PARAMETERS -->
## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `flow_source` | string | Yes | - | URL or path to the flow JSON file to import |
| `flow_password` | string | No | - | Password for encrypted credentials in the flow (optional) ⚙️ Advanced |
| `flow_password_confirm` | string | No | - | Confirm the password for encrypted credentials (optional) ⚙️ Advanced |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Import Flow | Script | `scripts/import-flow.sh` | - |

<!-- GENERATED_END:COMMANDS -->
