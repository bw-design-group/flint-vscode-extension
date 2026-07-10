---
title: External Tools
description: Integrations with Kindling, the Ignition Designer Launcher, and WSL environments.
---

Flint integrates with tools you already use alongside Ignition — Kindling for inspecting gateway backups and logs, and the Designer Launcher for opening Designer straight from VS Code. This page covers how each integration works, how detection and configuration behave, and how to reset them.

:::info Prerequisites
Everything on this page works offline — no gateway connection or Designer Bridge module is required. The tools themselves (Kindling, Designer Launcher) must be installed separately on your machine.
:::

## Kindling

[Kindling](https://inductiveautomation.github.io/kindling/download.html) is Inductive Automation's desktop tool for viewing Ignition backup files, module files, internal databases, and logs. When Kindling is available, Flint adds an **Open with Kindling** entry to the Explorer right-click menu for these file types:

| Extension | File type |
|-----------|-----------|
| `.gwbk` | Gateway backup |
| `.modl` | Ignition module |
| `.idb` | Internal database |
| `.log` | Log file |

<!-- SCREENSHOT: Explorer context menu on a .gwbk file showing the "Open with Kindling" entry -->

### Installation detection

The first time you use **Open with Kindling**, Flint asks whether Kindling is installed and offers three choices:

- **Confirm Installation** — Kindling is on your system `PATH`; Flint launches it directly.
- **Browse for Kindling** — pick the executable manually; the path is saved to `flint.kindlingExecutablePath`.
- **Download Kindling** — opens the Kindling download page in your browser.

Your answer is remembered in the `flint.hasKindlingInstalled` setting, so you are only prompted once.

<!-- SCREENSHOT: Modal prompt asking "Do you have Kindling installed?" with Confirm/Browse/Download buttons -->

### Settings and commands

| Setting | Default | Purpose |
|---------|---------|---------|
| `flint.hasKindlingInstalled` | `false` | Whether Kindling is installed and available on the system `PATH` |
| `flint.kindlingExecutablePath` | `""` | Custom path to the Kindling executable, used instead of `PATH` lookup |

| Command palette title | What it does |
|-----------------------|--------------|
| **Flint: Configure Kindling Executable Path** | Set or change the custom executable path |
| **Flint: Reset Kindling Installation Setting** | Clear the remembered answer so Flint prompts again |

:::tip WSL and non-standard installs
If you run VS Code in WSL or installed Kindling somewhere unusual, set `flint.kindlingExecutablePath` to the exact executable location (for WSL, this can point at the Windows executable, for example a `.exe` under `/mnt/c/...`). Flint uses this path instead of searching `PATH`.
:::

## Designer Launcher (8.3+)

For gateways running Ignition 8.3+, Flint can open Designer directly from the Project Browser using the `designer://` URL scheme registered by the 8.3 Designer Launcher. The **Flint: Open Designer** command (also available from a gateway node's context menu) builds the deep link from your configured gateway host and port.

<!-- SCREENSHOT: Gateway node context menu in the Project Browser with "Open Designer" highlighted -->

The first time you open Designer this way, Flint asks whether you have the 8.3+ Designer Launcher installed. Your answer is stored in `flint.has83DesignerLauncher` (default `false`).

- If the launcher is available, VS Code opens the `designer://` link and the Designer Launcher takes over.
- If launching fails (launcher not installed, or the `designer://` protocol is not registered), Flint offers to open the gateway web interface instead, or to update the setting.

| Setting | Default | Purpose |
|---------|---------|---------|
| `flint.has83DesignerLauncher` | `false` | Whether the Ignition Designer Launcher (8.3+) is installed |

| Command palette title | What it does |
|-----------------------|--------------|
| **Flint: Open Designer** | Open Designer for the active gateway via `designer://` |
| **Flint: Reset Designer Launcher Setting** | Clear the remembered answer so Flint prompts again |

:::note
The `designer://` scheme is only registered by the 8.3+ Designer Launcher. On Ignition 8.1 gateways, use the gateway web interface (**Flint: Open Gateway**) to download and launch Designer. Opening Designer this way is separate from the [Designer Bridge connection](/getting-started/connecting-designer) — the bridge auto-discovers running Designers regardless of how they were launched.
:::

## Windows Subsystem for Linux (WSL)

Flint handles WSL environments automatically — no manual configuration is required for the Designer Bridge:

- **Registry resolution**: the Designer Bridge writes its connection registry to the Windows user profile (`~/.ignition/flint/designers/`). When the extension runs inside WSL, Flint resolves and reads the Windows-side registry files.
- **WebSocket proxying**: a WSL2 process cannot reach Windows `127.0.0.1` directly, so Flint transparently creates a local TCP proxy that relays the Designer WebSocket connection through to Windows localhost.

The only WSL-specific configuration you may need is `flint.kindlingExecutablePath`, described above, since Kindling runs as a Windows application.

## Reset Tool Settings

The **Flint: Reset Tool Settings** command presents a category picker for resetting groups of Flint settings, including a workspace configuration reset.

:::warning
The **Workspace Configuration** and **All Flint Settings** categories are destructive — the first resets your workspace `flint.config.json` and the second resets every Flint setting to its default. For routine reconfiguration of Kindling or the Designer Launcher, prefer the targeted commands **Flint: Reset Kindling Installation Setting** and **Flint: Reset Designer Launcher Setting**.
:::

## Related pages

- [Settings reference](/reference/settings) — full list of extension settings
- [Commands reference](/reference/commands) — full command palette listing
- [Connecting the Designer](/getting-started/connecting-designer) — Designer Bridge setup and auto-discovery
