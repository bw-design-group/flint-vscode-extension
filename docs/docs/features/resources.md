---
title: Resource Types & Operations
description: The Ignition resource types Flint understands and the create, rename, duplicate, and delete operations available from the Project Browser.
sidebar_label: Resources
---

Flint models an Ignition project as a tree of typed resources — scripts, named queries, Perspective views, and configuration — and lets you create, rename, duplicate, and delete them directly from VS Code without opening the Designer. All resource operations work against files on disk, so they behave the same whether or not a gateway is reachable.

:::info Prerequisites
Works completely offline. You only need a valid `flint.config.json` with at least one project path — no gateway connection, API token, or Designer Bridge module is required. See [Configuration](/reference/configuration).
:::

## Supported resource types

Flint ships providers for seven built-in resource types:

| Resource type | Type ID | Primary file | Category | Singleton |
|---|---|---|---|---|
| Project Scripts | `script-python` | `code.py` | — | No |
| Named Queries | `named-query` | `query.sql` | — | No |
| Views | `perspective-view` | `view.json` | Perspective | No |
| Style Classes | `perspective-style-class` | `style.json` | Perspective | No |
| Page Configuration | `perspective-page-config` | `config.json` | Perspective | Yes |
| Session Properties | `perspective-session-props` | `props.json` | Perspective | Yes |
| Session Events | `perspective-session-events` | `data.bin` | Perspective | Yes |

Singleton types have exactly one resource per project. In the [Project Browser](/features/project-browser), clicking a singleton node creates the resource automatically if it does not exist yet.

:::note
Session Events are stored in a binary file (`data.bin`), so their content is not included in [full-text search](/features/search).
:::

## Resource keys

Every resource is identified by a key with the format:

```
{typeId}:{categoryId?}/{resourcePath}
```

The category segment is optional and only present for categorized types — the Perspective family in the table above. Examples:

- `script-python/utils/logging` — a project script at `utils/logging`
- `perspective-view:perspective/Overview/Main` — a Perspective view
- `named-query/reports/daily-totals` — a named query

## Creating, renaming, and deleting resources

Right-click a resource type, folder, or resource in the Project Browser to access these operations. Titles below are the exact context-menu labels.

<!-- SCREENSHOT: Project Browser context menu on a resource showing Rename, Duplicate, Delete, Copy Path -->

| Operation | Command | What it does |
|---|---|---|
| **Create Resource** | `flint.createResource` | Creates a new resource from a type-appropriate template (e.g. a starter `code.py` or `view.json`), with name validation |
| **Create Folder** | `flint.createFolder` | Creates a folder under the selected type or folder |
| **Delete** | `flint.deleteResource` | Deletes a resource or folder after a modal confirmation |
| **Duplicate** | `flint.duplicateResource` | Copies a resource to a new name alongside the original |
| **Rename** | `flint.renameResource` | Renames a resource or folder |
| **Copy Path** | `flint.copyResourcePath` | Copies the resource path to the clipboard |
| **Open Resource** | `flint.openResource` | Opens the resource's primary file in the editor |
| **Open in Designer** | `flint.openInDesigner` | Opens the resource in a connected Ignition Designer (requires the [Designer Bridge](/module/overview)) |

New resources are created with the correct directory layout and a valid `resource.json`, so they are immediately recognized by Ignition on the next project scan.

<!-- SCREENSHOT: Create Resource flow showing the resource name input box with a template-generated view.json open behind it -->

:::warning
Resource operations edit project files directly on disk. If the same project is open in a running Designer, save or discard your Designer changes first — the Designer does not merge external edits automatically, and saving from the Designer can overwrite changes made in VS Code.
:::

## resource.json management

Every Ignition resource directory must contain a `resource.json` manifest. It declares the resource's scope, files, and attributes; without it, the Ignition gateway does not recognize the directory as a resource at all. Manifests can go missing when files are created by hand, copied between projects, or mangled by a bad merge.

Flint surfaces these problems as warning decorations in the Project Browser — a missing `resource.json` marks the resource and propagates a warning badge up through its parent folders — and provides commands to repair them:

| Command palette title | Command | What it does |
|---|---|---|
| **Flint: Create resource.json** | `flint.createResourceJson` | Generates a manifest for the selected resource |
| **Flint: Create All Missing resource.json Files** | `flint.createAllMissingResourceJson` | Scans the project and generates every missing manifest in one pass |
| **Flint: Validate resource.json Files** | `flint.validateResourceJson` | Checks existing manifests for structural problems |
| **Flint: Validate Project** | `flint.validateProject` | Runs project-wide validation, including manifest checks |

<!-- SCREENSHOT: Project Browser showing warning decorations on a resource with a missing resource.json, propagated to its parent folder -->

The Project Browser also decorates resources with an invalid `resource.json`, a missing inheritance parent, circular inheritance, or a deprecated resource type. See [Project Browser](/features/project-browser) for the full decoration reference.

## Related pages

- [Project Browser](/features/project-browser) — the tree view where these operations live
- [Search](/features/search) — find resources by name, path, or content
- [Embedded Scripts](/features/embedded-scripts) — edit scripts embedded inside JSON resources as real Python files
