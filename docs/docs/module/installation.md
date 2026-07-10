---
title: Installing the Designer Bridge Module
description: Install and upgrade the Flint Designer Bridge module on your Ignition gateway.
sidebar_label: Installation
---

The Flint Designer Bridge is an Ignition module that connects your Designer and gateway to VS Code. Installing it on the gateway unlocks live Designer features in the extension — script execution, debugging, Perspective tooling, tag operations — and the headless gateway API.

:::info Prerequisites
This is a gateway-side install. You need administrative access to an Ignition gateway running **8.1.44+** or **8.3.1+**. The [VS Code extension](/getting-started/installation) works offline without the module, but every live Designer and gateway feature requires it.
:::

## Choose the right artifact

Each release ships two `.modl` files — one per Ignition major line. Download the one that matches your gateway from the [releases page](https://github.com/bw-design-group/flint-designer-bridge-ignition-module/releases).

| Artifact | Ignition version | Notes |
|----------|-----------------|-------|
| `Flint-Designer-Bridge-<version>-8.1.modl` | 8.1.44 or later | Flint-managed bearer token auth for the headless API |
| `Flint-Designer-Bridge-<version>-8.3.modl` | 8.3.1 or later | Supports native Ignition API tokens for the headless API |

The module is free (no license activation), Maker-compatible, and **code-signed** — you do not need to enable unsigned modules on the gateway.

:::warning One artifact per Ignition line
An 8.3 build will not load on an 8.1 gateway, and vice versa. If a module install fails with a version error, verify you downloaded the artifact matching your gateway's major version.
:::

## Install on the gateway

1. Download the `.modl` file for your Ignition version.
2. Open the gateway web interface and go to **Config → Modules** (8.1) or the Modules page in the 8.3 config UI.
3. Click **Install or Upgrade a Module**, select the downloaded `.modl` file, and confirm.
4. Accept the license (MIT). The gateway installs the module and starts it.

<!-- SCREENSHOT: Gateway Config > Modules page with the Install or Upgrade a Module button highlighted -->

The module runs in three scopes:

| Scope | What it does |
|-------|--------------|
| Gateway | Headless HTTP JSON-RPC API and backend for Designer-initiated gateway operations |
| Designer | Localhost WebSocket server that VS Code connects to |
| Common | Shared protocol types |

### Restart implications

Installing or upgrading the module restarts the module's gateway scope, not the whole gateway. However:

- **Running Designers do not pick up a new module version.** Restart any open Designer sessions after installing or upgrading so they load the new Designer-scope code.
- Perspective is declared as a module dependency. The Perspective-specific features require it, but the rest of the module functions without Perspective sessions running.

## Upgrading

For most upgrades, repeat the install steps above — **Install or Upgrade a Module** replaces the existing version in place. Then restart any open Designers.

:::danger Upgrading from v0.13.x or earlier
Version 1.0.0 renamed the module ID from `com.bwdesigngroup.flint-designer-bridge` to `dev.bwdesigngroup.flint.FlintDesignerBridge`. The gateway treats these as two different modules, so an in-place upgrade is not possible.

If your gateway runs Flint Designer Bridge **v0.13.x or earlier**, you must:

1. Uninstall the old module (`com.bwdesigngroup.flint-designer-bridge`) from **Config → Modules**.
2. Install the new `.modl` as described above.

Skipping the uninstall leaves both modules installed, with both attempting to serve the same role.
:::

## Verify the installation

**On the gateway**, confirm the module appears in the module list:

- Look for **Flint Designer Bridge** with module ID `dev.bwdesigngroup.flint.FlintDesignerBridge` and state *Running* on the Modules page.

<!-- SCREENSHOT: Gateway module list showing Flint Designer Bridge in the Running state -->

**Over HTTP**, hit the public health endpoint (no authentication required):

```bash
curl http://<gateway-host>:<port>/data/flint/health
```

A successful response confirms the gateway scope is up and the [headless API](/module/headless-api) is reachable. Only the health endpoint is public — the RPC endpoint at `/data/flint/rpc` requires a token (see [Security](/module/security)).

## Designer side: nothing to install

There is no Designer-side installation step. When you launch a Designer against a gateway with the module installed, the Designer scope automatically:

1. Starts a localhost-only WebSocket server on a port in the range 52400–52500.
2. Writes a registry file to `~/.ignition/flint/designers/designer-<pid>.json` containing the port and a per-instance secret.

The VS Code extension discovers this file and connects automatically — see [Connecting the Designer](/getting-started/connecting-designer).

<!-- SCREENSHOT: VS Code status bar showing the Flint connection indicator in the Connected state -->

:::note
VS Code must run on the same machine (or share the same home directory and loopback network) as the Designer to read the registry file and reach the localhost WebSocket. Under WSL2, this requires mirrored networking mode.
:::

## Next steps

- [Connect the Designer to VS Code](/getting-started/connecting-designer)
- [Security and authentication](/module/security)
- [Headless gateway API](/module/headless-api)
