# Configure Lighttpd

Configure lighttpd to enable FastCGI support and set HTTP port

**Execution Target:** lxc

## Capabilities

This template provides the following capabilities:

- Configuration management

## Used By Applications

This template is used by the following applications (usage examples):

- [phpmyadmin](../../../../phpmyadmin.md)

<!-- GENERATED_START:PARAMETERS -->
## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `http_port` | string | Yes | - | Port number for lighttpd HTTP server |

<!-- GENERATED_END:PARAMETERS -->

<!-- GENERATED_START:COMMANDS -->
## Commands

This template executes the following commands in order:

| # | Command | Type | Details | Description |
|---|---------|------|---------|-------------|
| 1 | Unnamed Command | Script | `configure-lighttpd.sh` | Enable mod_fastcgi in lighttpd configuration and set server port |

<!-- GENERATED_END:COMMANDS -->
