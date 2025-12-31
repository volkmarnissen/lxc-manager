# Install Alpine build tools

Install alpine-sdk (build toolchain) and git for building APK packages

**Execution Target:** lxc

## Capabilities

This template provides the following capabilities:

- Executes command: `apk update 1>&2`
- Executes command: `apk add --no-cache alpine-sdk git 1>&2`

## Used By Applications

This template is used by the following applications (usage examples):

- [alpine-packages](../../../../alpine-packages.md)

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Update indexes | Command | `apk update 1>&2` | - |
| 2 | Install toolchain | Command | `apk add --no-cache alpine-sdk git 1>&2` | alpine-sdk includes abuild, build-base, and related tools |

<!-- GENERATED_END:COMMANDS -->
