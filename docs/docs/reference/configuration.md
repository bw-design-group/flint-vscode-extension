---
title: flint.config.json Reference
description: Complete reference for the flint.config.json workspace configuration file, including file locations, schema, local overrides, and merge rules.
sidebar_label: flint.config.json
---

`flint.config.json` tells Flint where your Ignition projects live on disk and which gateways they belong to. It is the single source of truth for the [Project Browser](/features/project-browser), gateway navigation, environment switching, and gateway-connected features.

You normally do not write this file by hand: the Setup Wizard (**Flint: Get Started**) scaffolds it for you. This page documents the full format for when you need to edit it directly or check it into version control for your team.

:::info Prerequisites
Works offline. The configuration file itself requires no gateway connection — gateway entries only take effect when the corresponding gateway is reachable.
:::

## File locations

Flint resolves the configuration file in this priority order (first match wins):

| Priority | Location |
|---|---|
| 1 | Path set in the `flint.configPath` VS Code setting |
| 2 | `flint.config.json` (workspace root) |
| 3 | `.flint/config.json` |
| 4 | `.flint-config.json` |
| 5 | `.vscode/flint.config.json` |

Open the active file at any time with **Flint: Open Configuration File** (`flint.openConfig`).

<!-- SCREENSHOT: flint.config.json open in the editor with schema validation tooltips visible -->

## Local overrides: flint.local.json

Per-developer values (local hostnames, personal usernames, token file paths) belong in a local override file, which should be gitignored. Flint looks for it in this order:

| Priority | Location |
|---|---|
| 1 | Path set in the `flint.localConfigPath` VS Code setting |
| 2 | `flint.local.json` (workspace root) |
| 3 | `.flint/config.local.json` |

### Merge rules

The local file is merged onto the base configuration:

- **Objects deep-merge**, with local values winning on conflicts. You can override a single environment's `host` without repeating the rest of the gateway definition.
- **Arrays are replaced wholesale.** A local `project-paths` or `projects` array completely replaces the base array — it is not appended.
- **`schemaVersion` always comes from the base file** and cannot be overridden locally.

:::warning
Because arrays are replaced rather than merged, a local file that sets `project-paths` hides every path defined in the shared config. Only include arrays in `flint.local.json` when you intend to replace them entirely.
:::

## Schema

Top-level structure (required fields marked *):

| Field | Type | Description |
|---|---|---|
| `schemaVersion`* | `"0.1"` \| `"0.2"` | Configuration format version. Use `"0.2"`. |
| `project-paths`* | `string[]` | Directories to scan for Ignition projects. Absolute, or relative to the config file. Each subfolder containing a `project.json` is treated as a project. |
| `gateways`* | `object` | Map of gateway ID → gateway configuration. |
| `settings` | `object` | Optional extension behavior settings. |

### Gateway configuration

Each entry under `gateways` supports two shapes. The **multi-environment shape is recommended**; the single-environment shape exists for backward compatibility.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Gateway identifier (typically matches the key). |
| `environments` | `object` | Map of environment name (e.g. `local`, `staging`, `prod`) → environment configuration. Recommended. |
| `defaultEnvironment` | `string` | Environment selected by default when this gateway is active. |
| `host` | `string` | Host name or IP (legacy single-environment shape; required if `environments` is absent). |
| `port` | `integer` | Port, 1–65535 (legacy shape). |
| `ssl` | `boolean` | Use HTTPS (legacy shape). |
| `username` | `string` | Username for gateway authentication. |
| `ignoreSSLErrors` | `boolean` | Skip SSL certificate validation. Default `false`. |
| `ignitionVersion` | `string` | Gateway Ignition version, matching `^\d+\.\d+(\.\d+)?$` (e.g. `"8.1.44"`, `"8.3.1"`). |
| `projects` | `string[]` | Project names hosted on this gateway. Links projects found in `project-paths` to this gateway. |
| `enabled` | `boolean` | Whether the gateway appears in pickers. Default `true`. |
| `modules` | `object` | Module integrations for this gateway (see below). |

Either `host` or `environments` must be present.

### Per-environment fields

Each value in `environments` supports:

| Field | Type | Description |
|---|---|---|
| `host`* | `string` | Host name or IP for this environment. |
| `port` | `integer` | Port, 1–65535. |
| `ssl` | `boolean` | Use HTTPS. |
| `username` | `string` | Username for this environment. |
| `ignoreSSLErrors` | `boolean` | Skip SSL certificate validation. Default `false`. |
| `ignitionVersion` | `string` | Ignition version for this environment, if it differs from the gateway-level value. |
| `modules` | `object` | Environment-specific module configuration. |

Switch the active environment from the status bar or with the environment commands — see [Settings](/reference/settings) and [Commands](/reference/commands).

<!-- SCREENSHOT: status bar showing active gateway and environment selectors -->

### modules.project-scan-endpoint

Configures the gateway-side project scan integration on Ignition 8.3+ gateways:

| Field | Type | Where | Description |
|---|---|---|---|
| `enabled` | `boolean` | gateway level | Whether the project-scan endpoint is available on this gateway. Default `false`. |
| `apiTokenFilePath` | `string` | environment level | Path to a file containing the Gateway API token (absolute or relative to the workspace root). Keep the token file out of version control. |
| `forceUpdateDesigner` | `boolean` | environment level | Force open Designers to update when a scan is triggered. Default `false`. |

See [Module installation](/module/installation) and [Security](/module/security) for setting up the token.

### settings

| Field | Type | Default | Description |
|---|---|---|---|
| `showInheritedResources` | `boolean` | `true` | Show resources inherited from parent projects in the Project Browser. |
| `groupResourcesByType` | `boolean` | `true` | Group resources by type in the Project Browser. |
| `autoRefreshProjects` | `boolean` | `true` | Rescan projects automatically when files change. |
| `searchHistoryLimit` | `integer` | `50` | Maximum number of search history entries. |

These are workspace-shared settings; per-user VS Code settings are documented in [Settings](/reference/settings).

## Complete example

```json title="flint.config.json"
{
    "schemaVersion": "0.2",
    "project-paths": [
        "ignition-data/projects"
    ],
    "gateways": {
        "frontend": {
            "id": "frontend",
            "ignitionVersion": "8.1.44",
            "environments": {
                "local": {
                    "host": "localhost",
                    "port": 8088,
                    "ssl": false
                },
                "staging": {
                    "host": "frontend.staging.example.com",
                    "port": 443,
                    "ssl": true
                },
                "prod": {
                    "host": "frontend.example.com",
                    "port": 443,
                    "ssl": true
                }
            },
            "defaultEnvironment": "local",
            "enabled": true,
            "projects": ["hmi-frontend", "shared-utilities"]
        },
        "backend": {
            "id": "backend",
            "ignitionVersion": "8.3.1",
            "environments": {
                "local": {
                    "host": "localhost",
                    "port": 9088,
                    "ssl": false
                },
                "prod": {
                    "host": "backend.example.com",
                    "port": 443,
                    "ssl": true
                }
            },
            "defaultEnvironment": "local",
            "enabled": true,
            "projects": ["process-backend", "shared-utilities"],
            "modules": {
                "project-scan-endpoint": {
                    "enabled": true,
                    "apiTokenFilePath": "~/.ignition/tokens/backend-api-token"
                }
            }
        }
    },
    "settings": {
        "showInheritedResources": true,
        "groupResourcesByType": true,
        "autoRefreshProjects": true,
        "searchHistoryLimit": 50
    }
}
```

And a matching per-developer override:

```json title="flint.local.json"
{
    "gateways": {
        "backend": {
            "environments": {
                "local": {
                    "host": "192.168.1.50"
                }
            }
        }
    }
}
```

## Migrating from schema 0.1

Configurations with `"schemaVersion": "0.1"` are migrated automatically when loaded. The 0.2 format introduced the `environments` / `defaultEnvironment` structure; migrated single-environment gateways keep working via the legacy `host`/`port`/`ssl` fields. When editing a migrated file, prefer moving connection details into `environments` — the legacy shape is supported but not recommended for new configurations.

:::note
`schemaVersion` accepts only `"0.1"` or `"0.2"`. Files with any other value are rejected by schema validation.
:::

## Related pages

- [Installation](/getting-started/installation) — installing the extension
- [Quick Start](/getting-started/quick-start) — the Setup Wizard workflow
- [Settings](/reference/settings) — VS Code settings (`flint.*`)
- [Headless gateway API](/module/headless-api) — what the API token enables
