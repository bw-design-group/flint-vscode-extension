---
title: Designer Navigation
description: Jump between VS Code, the Ignition Designer, and the gateway web interface without breaking your flow.
---

Flint keeps VS Code and the Ignition Designer working as a pair. You can open the resource you are editing in VS Code directly inside a connected Designer, run a Python file against the Designer's live scripting environment, launch a Designer session for any configured gateway, or jump straight to the gateway web interface — all without leaving your editor.

:::info Prerequisites
The commands on this page have different requirements:

- **Open in Designer**, **Run in Flint**, and **Send Message to Designer** need the [Designer Bridge module](/module/overview) installed and a running Designer that Flint is [connected to](/getting-started/connecting-designer).
- **Open Designer** and **Open Gateway Webpage** only need a gateway defined in `flint.config.json` — no bridge connection required. Open Designer additionally requires the Ignition 8.3+ Designer Launcher on your machine.
:::

## Command summary

| Command palette title | Command ID | Requires |
|---|---|---|
| Flint: Open in Designer | `flint.openInDesigner` | Connected Designer |
| Flint: Run in Flint | `flint.runInFlint` | Connected Designer |
| Flint: Send Message to Designer | `flint.sendMessageToDesigner` | Connected Designer |
| Flint: Open Designer | `flint.navigateToDesigner` | 8.3+ Designer Launcher |
| Flint: Open Gateway Webpage | `flint.navigateToGateway` | Configured gateway |

## Open in Designer

Right-click a resource in the Project Browser and choose **Open in Designer**. Flint sends a request over the Designer Bridge, and the connected Designer switches to the matching workspace and opens that resource — a Perspective view opens in the view designer, a script opens in the script editor.

If no Designer is connected yet, the command prompts you to connect first.

<!-- SCREENSHOT: Project Browser context menu on a Perspective view showing the "Open in Designer" item -->

The following resource types can be opened this way:

| Flint resource type | Opens in Designer as |
|---|---|
| Python script (`script-python`) | Project Library script editor |
| Named query (`named-query`) | Named Query workspace |
| Perspective view (`perspective-view`) | Perspective view designer |
| Perspective style class (`perspective-style`) | Style class editor |
| Perspective page config (`perspective-page-config`) | Page configuration |
| Perspective session props / events | Session property and event editors |
| Vision window / template | Vision workspace |

:::note
Resource types outside this list report `Unsupported resource type` — the Designer Bridge cannot open them. See [Resources](/features/resources) for the full set of resource types Flint manages in VS Code.
:::

## Run in Flint

With a Python file open in the editor, right-click and choose **Run in Flint** (or run **Flint: Run in Flint** from the command palette). The entire file is sent to the connected Designer and executed in the [Script Console](/debugging/script-console), where output and errors appear.

<!-- SCREENSHOT: Python file editor context menu showing "Run in Flint", with the Script Console panel visible below -->

:::warning
Run in Flint only works with Python files. It executes the whole file — there is no run-selection variant of this command.
:::

## Send Message to Designer

**Flint: Send Message to Designer** prompts for a text message and displays it as a notification inside the connected Designer. It is a quick way to verify the bridge connection end to end, or to signal a teammate looking at the Designer while you work in VS Code. If no Designer is connected, the command offers to connect first.

## Open Designer

**Flint: Open Designer** launches an Ignition Designer session for a gateway using a `designer://` deep link, which the Ignition 8.3+ Designer Launcher registers as a URL handler. Run it from the command palette (you will be asked to pick a gateway) or right-click a gateway node in the Project Browser and choose **Open Designer**.

<!-- SCREENSHOT: Quick pick listing configured gateways with host, active environment, and project counts -->

The first time you run it, Flint asks whether you have the 8.3+ Designer Launcher installed and records your answer in the `flint.has83DesignerLauncher` setting. To answer the prompt again — for example after installing the launcher — run **Flint: Reset Designer Launcher Setting**.

:::warning
`designer://` deep links require the Ignition 8.3+ Designer Launcher. On earlier launchers the link does nothing; if the launch fails, Flint offers to open the gateway web interface instead, where you can start the Designer manually.
:::

## Open Gateway Webpage

**Flint: Open Gateway Webpage** opens the gateway's web interface in your default browser, using the host, port, and SSL settings of the gateway's active environment. It is also available from the gateway node's context menu in the Project Browser. Use it to reach the gateway status pages, config section, or module list without hunting for the URL.

## Environment switching

Gateways in `flint.config.json` can define multiple environments (for example `dev`, `staging`, and `prod`), each with its own host, port, and SSL settings. The active environment is shown in the status bar and switched with **Flint: Select Environment** — or from the gateway node's context menu in the Project Browser. Your selection persists per workspace.

<!-- SCREENSHOT: Status bar showing the active gateway and environment items, with the environment quick pick open -->

Environment selection directly affects the navigation commands:

- **Open Designer** builds its `designer://` link from the active environment's host and port, and the launch notification shows which environment is being used.
- **Open Gateway Webpage** opens the active environment's web address.

Switching from `dev` to `prod` before running either command therefore points them at the production gateway — check the status bar before you launch. See [Configuration](/reference/configuration) for how to define environments and a `defaultEnvironment` per gateway.
