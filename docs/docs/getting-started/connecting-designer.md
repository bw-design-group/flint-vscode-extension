---
title: Connecting to the Designer
description: How Flint automatically discovers and connects to running Ignition Designer sessions through the Designer Bridge module.
sidebar_label: Connecting a Designer
---

The Designer Bridge connects VS Code to a live Ignition Designer session, enabling features like the [script console](/debugging/script-console), the [Perspective debugger](/debugging/debugger), [live tag browsing](/live-tools/tag-browser), and [Designer navigation](/live-tools/designer-navigation). Once the module is installed on your gateway, the connection is fully automatic — launch a Designer and Flint finds it within about five seconds.

:::info Prerequisites
This feature requires the **Flint Designer Bridge module** installed on your gateway and a **running Designer** on the same machine as VS Code. See [Module Installation](/module/installation) if you have not installed it yet. No gateway API token is needed for the Designer connection.
:::

## How discovery works

You never configure a host or port for the Designer connection. Instead:

1. When a Designer launches on a gateway that has the Flint Designer Bridge module installed, the module starts a WebSocket server on a loopback port (in the range **52400–52500**) inside that Designer.
2. The module writes a registry file to `~/.ignition/flint/designers/designer-<pid>.json` containing the WebSocket port, a per-instance authentication secret, and details about the Designer session (project, gateway, user, PID).
3. The Flint extension polls that directory **every 5 seconds**, matches discovered Designers against the gateways in your `flint.config.json`, connects over the WebSocket, and authenticates using the secret from the registry file.

The registry file is created with owner-only permissions (0600) and is deleted when the Designer shuts down cleanly. Stale files from crashed Designers are cleaned up automatically.

<!-- SCREENSHOT: Status bar showing "Designer: MyProject" with a check icon after auto-connect -->

## Connecting step by step

1. Install the Flint Designer Bridge module on your gateway ([instructions](/module/installation)) and restart the gateway if prompted.
2. Open your project workspace in VS Code with a valid `flint.config.json` (see [Quick Start](/getting-started/quick-start)).
3. Launch the Designer for your project from the Designer Launcher and log in.
4. Within about five seconds, the Flint status bar item changes from **Designer: None** to a connected state showing the project name.

Nothing is configured on the Designer side — the WebSocket server and registry file are created automatically whenever the module is present.

## Status bar states

The Designer connection status appears in the VS Code status bar (right side). Clicking it when connected runs **Flint: Send Message to Designer**.

| State | Status bar text | Meaning |
|-------|-----------------|---------|
| Disconnected (none found) | `Designer: None` | No registry files found. Check that the module is installed and a Designer is running. |
| Disconnected (available) | `Designer (N available)` | Designers were discovered but none is connected. Click to connect. |
| Connecting | `Designer: Connecting...` (spinner) | Opening the WebSocket connection. |
| Authenticating | `Designer: Authenticating...` (key icon) | Exchanging the secret from the registry file. |
| Connected | `Designer: <project name>` (check icon) | Connected and authenticated. The tooltip shows project, gateway, user, and PID. |
| Error | `Designer: Error` (red background) | Connection failed. Click to reconnect. |

When connected, the icon also reflects how well the Designer matches your configuration:

| Icon | Meaning |
|------|---------|
| Check | The Designer's gateway and project both match an entry in `flint.config.json`. |
| Warning (yellow background) | The gateway matches but the project is not in your configuration, or no configured gateway matches. Features still work; hover the status bar item for the mismatch reason. |

<!-- SCREENSHOT: Status bar tooltip showing gateway match details, project, gateway host, user, and PID -->

## Multiple Designers

If several Designers are running, Flint connects to one as the primary connection and tracks the others as secondary connections. The status bar shows the primary project name with a `(+N more)` suffix, and the tooltip lists each secondary Designer with its project, gateway, and PID.

## Manual connect and disconnect

Auto-connection covers most workflows, but you can manage the connection explicitly from the Command Palette (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>):

| Command | Purpose |
|---------|---------|
| **Flint: Connect to Designer** | Pick a discovered Designer instance to connect to. |
| **Flint: Disconnect from Designer** | Close the current Designer connection. |
| **Flint: Send Message to Designer** | Show a message dialog inside the connected Designer (also bound to clicking the status bar item). |

<!-- SCREENSHOT: Command Palette showing the Flint: Connect to Designer quick pick with a discovered Designer instance -->

## Security notes

- The WebSocket server listens on **localhost only** — it is never reachable from other machines.
- Every Designer instance generates a fresh 256-bit secret. Clients must read it from the registry file and authenticate before any other request is accepted, so only processes running as your OS user can connect.

:::warning WSL and remote setups
Discovery works by reading files from the home directory of the user running the Designer. VS Code and the Designer must share a filesystem view of `~/.ignition/flint/designers/` and be able to reach the Designer's loopback ports. Running the Designer on Windows while VS Code runs inside WSL (or on a remote host) requires mirrored networking and access to the Windows home directory; this configuration is not automatic.
:::

## Troubleshooting

If the status bar stays on **Designer: None**:

- **Registry file exists?** With the Designer running, check for `~/.ignition/flint/designers/designer-<pid>.json`. If it is missing, the module is not installed on that gateway (or the Designer predates the module install — restart the Designer).
- **Same home directory?** VS Code and the Designer must run as the same OS user on the same machine, so both see the same `~/.ignition` directory.
- **Loopback ports reachable?** Ensure local firewall or endpoint-protection software is not blocking localhost connections on ports **52400–52500**.
- **Gateway mismatch warning?** A yellow status bar means the connected Designer's gateway or project is not in your `flint.config.json`. Add the gateway (see [Configuration](/reference/configuration)) to clear the warning.

For more, see [Troubleshooting](/troubleshooting).
