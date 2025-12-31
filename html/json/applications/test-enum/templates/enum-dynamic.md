# Dynamic Enum

Parameter with enum values resolved via template

**Execution Target:** ve

## Capabilities

This template provides the following capabilities:

- Executes command: `echo '[{"id":"enumValues","value":[{"name":"eth0","value":"eth0"},{"name":"eth1","value":"eth1"}]}]'`

## Used By Applications

This template is used by the following applications (usage examples):

- [test-enum](../../../../test-enum.md)

<!-- GENERATED_START:PARAMETERS -->
## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `iface` | enum | No | - |  |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:OUTPUTS -->
## Outputs

| Output ID | Default | Description |
|-----------|---------|-------------|
| `undefined` | - | - |

<!-- GENERATED_END:OUTPUTS -->

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Emit enumValues | Command | `echo '[{"id":"enumValues","value":[{"name":"eth...` | - |

<!-- GENERATED_END:COMMANDS -->
