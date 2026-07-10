---
title: Installation
description: Install the Flint VS Code extension and the Flint Designer Bridge module on your Ignition gateway.
---

Flint has two components: the **Flint for Ignition** VS Code extension, and the **Flint Designer Bridge** Ignition module. The extension works on its own for browsing and editing project files on disk; installing the module unlocks live Designer and gateway features such as the Script Console, debugger, tag browser, and gateway-backed language server.

:::info Prerequisites
The extension itself works offline against projects on disk. The Designer Bridge module requires access to an Ignition gateway where you can install modules.

- **VS Code** 1.102 or later
- **Ignition gateway** 8.1.44+ or 8.3.1+ with the Perspective module
- **Ignition projects on disk** — a folder of project directories in the standard gateway layout (`data/projects/<project>/`), where each project directory contains a `project.json` file
:::

## Install the VS Code extension

### From the Marketplace (recommended)

1. Open VS Code and go to the Extensions view (<kbd>Ctrl+Shift+X</kbd> / <kbd>Cmd+Shift+X</kbd>).
2. Search for **Flint for Ignition**.
3. Install the extension published by Keith-gamble (`Keith-gamble.ignition-flint`).

Or install from the command line:

```bash
code --install-extension Keith-gamble.ignition-flint
```

<!-- SCREENSHOT: VS Code Extensions view showing "Flint for Ignition" search result with the Install button -->

### From a .vsix file

Every release also attaches a `.vsix` package to its [GitHub release](https://github.com/bw-design-group/flint-vscode-extension/releases). To install it, open the Extensions view, click the **...** menu, choose **Install from VSIX...**, and select the downloaded file.

:::note
The extension bundles everything it needs — there is no separate binary to install. Gateway-backed language features connect directly to the language server hosted by the Designer Bridge module (v1.2.0+) on your gateway.
:::

## Install the Designer Bridge module

The module is distributed from [GitHub Releases](https://github.com/bw-design-group/flint-designer-bridge-ignition-module/releases). Each release ships two artifacts — one per Ignition major line. Download the one that matches your gateway:

| Artifact | Ignition version | Minimum |
|---|---|---|
| `Flint-Designer-Bridge-<version>-8.1.modl` | Ignition 8.1 | 8.1.44 |
| `Flint-Designer-Bridge-<version>-8.3.modl` | Ignition 8.3 | 8.3.1 |

The two builds are not interchangeable — a `.modl` built for one major line will not load on the other.

To install:

1. Open the gateway web interface and go to **Config → Modules**.
2. Click **Install or Upgrade a Module**.
3. Upload the downloaded `.modl` file and accept the license.

The module is free (no activation) and MIT-licensed. Release artifacts are code-signed, so you do **not** need to enable the gateway's unsigned-module setting.

<!-- SCREENSHOT: Gateway Config > Modules page showing Flint Designer Bridge installed and running -->

The module has three scopes (Gateway, Designer, Common). Nothing needs to be installed in the Designer separately — the Designer picks up the module from the gateway the next time it launches.

:::warning Upgrading from 0.13.x or earlier
Version 1.0.0 changed the module ID from `com.bwdesigngroup.flint-designer-bridge` to `dev.bwdesigngroup.flint.FlintDesignerBridge`. If your gateway has a Flint module at version 0.13.x or earlier, **uninstall the old module first**, then install the new one. Installing the new `.modl` over the old one leaves two copies of the module on the gateway.
:::

:::note
The module declares a dependency on the Perspective module. Perspective-specific features (session inspection, view profiling) require Perspective to be running on the gateway.
:::

## Verify the installation

1. In the gateway web interface, check **Config → Modules** — **Flint Designer Bridge** should be listed as running.
2. In VS Code, open a folder that contains your Ignition projects. The Flint project browser appears in the activity bar and offers a **Get Started** button when no configuration exists yet.

<!-- SCREENSHOT: VS Code activity bar with the Flint project browser open, showing the Get Started welcome view -->

## Next steps

- [Quick start](/getting-started/quick-start) — run the setup wizard to create `flint.config.json` and browse your first project.
- [Connecting a Designer](/getting-started/connecting-designer) — launch the Designer and let Flint auto-discover the live bridge connection.
- [Module overview](/module/overview) — what the Designer Bridge module provides and how it works.
