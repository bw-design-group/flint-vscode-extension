---
title: Ignition API Stubs
description: Version-matched ignition-api Python stubs that power Flint's system.* completions, downloaded on demand and cached locally.
sidebar_label: Ignition Stubs
---

Flint downloads version-matched [`ignition-api`](https://pypi.org/project/ignition-api/) Python stubs from PyPI and uses them to power its own `system.*` completion engine. This gives you accurate signatures for the exact Ignition version your gateway runs — `system.tag.readBlocking` in 8.1 and 8.3 are not the same, and the stubs reflect that.

:::info Prerequisites
Works offline once downloaded. The first download of each stub version requires an internet connection (Flint fetches the package from PyPI using `pip`). No gateway connection, API token, or Designer Bridge module is required.
:::

## How stubs are downloaded

Flint offers to download stubs the first time you type `system.` in a Python file. Accept the prompt and Flint fetches the stubs for your gateway's Ignition version in the background.

<!-- SCREENSHOT: notification prompt offering to download Ignition stubs after typing "system." in a Python file -->

You can also trigger a download manually at any time with **Flint: Download Ignition Stubs** from the Command Palette (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>). The version picker lists:

- Ignition versions detected from your configured gateways
- Common versions (8.1.33, 8.1.35, 8.1.42, 8.3.0, 8.3.1)
- A custom version you type in

<!-- SCREENSHOT: Command Palette running "Flint: Download Ignition Stubs" with the version quick-pick open -->

## Where stubs are stored

Downloaded stubs are cached per version so each version is only fetched once:

| Item | Location |
|---|---|
| Stub cache | `~/.flint/ignition-stubs/<version>/` |
| Cache metadata | `metadata.json` inside each version directory |

Subsequent sessions use the cache with no network access. To remove all cached stubs — for example to force a fresh download — run **Flint: Clear Ignition Stubs Cache**.

## How Flint uses the stubs

The stubs feed Flint's built-in completion engine. Flint parses the stub files itself and serves `system.*` completions through its own completion provider — see [Completion](/language/completion) for how this fits alongside the other completion sources.

:::note Not a Pylance integration
The stubs are **not** wired into Pylance or `python.analysis.extraPaths`, and Flint never modifies your Python analysis settings. You do not need the Python extension or Pylance installed for Flint's completions to work. If you separately use Pylance, it will not see these stubs.
:::

<!-- SCREENSHOT: system.tag completion list in a Python file, showing stub-backed entries with signatures -->

## Related settings and commands

| Command | Purpose |
|---|---|
| **Flint: Download Ignition Stubs** (`flint.downloadIgnitionStubs`) | Download stubs for a chosen Ignition version |
| **Flint: Clear Ignition Stubs Cache** (`flint.clearIgnitionStubsCache`) | Delete all cached stub versions |

| Setting | Default | Purpose |
|---|---|---|
| `flint.enablePythonAutocomplete` | `true` | Master switch for Flint's Python autocomplete (including stub-backed completions) |
| `flint.pythonAutocompleteIncludeInherited` | `true` | Include modules inherited from parent projects in completions |

The full list of completion-related settings is in the [Settings reference](/reference/settings).

## Limitations

:::caution
- Stubs provide completion data only for Flint's own engine. Hover, go-to-definition, references, and diagnostics come from the [gateway language server](/language/gateway-lsp), not from the stubs.
- The first download of each version requires internet access to PyPI. In an air-gapped environment, the on-demand download will fail; the rest of Flint continues to work without stub-backed `system.*` completions.
- Downloads use `pip`, so a working Python/pip installation must be available on your machine.
:::
