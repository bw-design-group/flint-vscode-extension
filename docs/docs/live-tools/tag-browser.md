---
title: Tag Browser
description: Browse live tag values, inspect tag configuration, and manage tags directly from VS Code through a connected Ignition Designer.
---

The Tag Browser brings the Ignition tag tree into VS Code: browse tag providers, watch live values and quality codes update inline, and create, write, or delete tags without switching to the Designer. It is a live view — every read and write goes through your running Designer session, so what you see is exactly what the gateway sees.

:::info Prerequisites
The Tag Browser requires the **Flint Designer Bridge module** installed on your gateway and a **running, connected Designer**. All tag operations ride the Designer bridge — a configured gateway alone is not enough. See [Connecting the Designer](/getting-started/connecting-designer) and [Module Installation](/module/installation).
:::

## Opening the Tag Browser

The Tag Browser appears in the **Flint for Ignition** Activity Bar container, below the [Project Browser](/features/project-browser). The view is available once the extension is activated; its contents load when a Designer is connected.

<!-- SCREENSHOT: Tag Browser view in the Activity Bar showing providers, folders, and tags with inline live values -->

## What the tree shows

The tree mirrors the Designer's tag structure:

| Node type | Description |
|---|---|
| **Provider** | Each tag provider visible to the connected Designer (e.g. `default`) |
| **Folder** | Tag folders, expandable to any depth |
| **Tag** | Atomic tags, with live value and quality shown inline |
| **UDT Definition** | UDT type definitions, expandable to their member structure |
| **UDT Instance** | UDT instances, expandable to their member tags |

### Live values

Visible atomic tags display their current value and quality inline, in the form `value [quality]` — for example `42.5 [Good]`. Values refresh automatically about every **5 seconds** while the view is visible. Polling stops when the view is hidden, so it adds no load while you work elsewhere.

<!-- SCREENSHOT: Expanded tag folder with several atomic tags showing "value [Good]" descriptions -->

## Tag operations

Right-click a node in the Tag Browser for context actions. All commands are in the **Flint** category.

| Action | Command | Available on |
|---|---|---|
| **Read Value** | `flint.readTagValue` | Tags |
| **Write Value** | `flint.writeTagValue` | Tags |
| **Get Configuration** | `flint.getTagConfig` | Any node |
| **Create Tag** | `flint.createTag` | Providers and folders |
| **Delete** | `flint.deleteTag` | Tags, folders, UDT definitions and instances |
| **Copy Tag Path** | `flint.copyTagPath` | Any node |
| **Refresh Tag Browser** | `flint.refreshTagBrowser` | View title bar |

### Read and write

**Read Value** performs an on-demand read of the selected tag, independent of the polling cycle. **Write Value** prompts for a new value and writes it through the Designer's gateway connection.

:::warning
Writes go to the live gateway. In a production environment, a tag write from the Tag Browser has the same effect as a write from the Designer or a running client.
:::

### Get configuration

**Get Configuration** fetches the full tag configuration and opens it as formatted JSON in an untitled editor — useful for inspecting bindings, alarm setups, or UDT parameters, or for copying configuration between environments.

<!-- SCREENSHOT: Untitled JSON editor showing a fetched tag configuration next to the Tag Browser -->

### Create and delete

**Create Tag** on a provider or folder walks you through three prompts:

1. **Name** of the new tag.
2. **Type** — Atomic Tag, Folder, UDT Definition, or UDT Instance.
3. **Data type** (atomic tags only) — `Int1`, `Int2`, `Int4`, `Int8`, `Float4`, `Float8`, `Boolean`, `String`, or `DateTime`.

**Delete** asks for confirmation before removing the tag, folder, or UDT node from the provider.

### Copy tag path

**Copy Tag Path** puts the fully qualified path (including the `[provider]` prefix) on the clipboard, ready to paste into scripts, bindings, or `system.tag.*` calls.

## How it connects

The Tag Browser does not talk to the gateway directly. It sends JSON-RPC requests over the local WebSocket bridge to your connected Designer, and the Designer performs the tag operations through its existing gateway session — using the Designer's authenticated user and its permissions. See [Module Overview](/module/overview) for the full architecture.

:::note Limitations
- **A connected Designer is required.** If no Designer is connected, the tree is empty and tag commands fail. A gateway configured in `flint.config.json` with an API token is not sufficient for this view.
- **Values poll at a fixed ~5 second interval.** The Tag Browser is not a substitute for the Designer's subscription-based tag browser when you need sub-second updates.
- Only tags visible while the view is expanded are polled; collapsed branches are not read.
:::

## Related pages

- [Script Console](/debugging/script-console) — run `system.tag.*` calls interactively against the same Designer session.
- [Connecting the Designer](/getting-started/connecting-designer) — establish the bridge connection this view depends on.
