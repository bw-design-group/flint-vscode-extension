---
title: Troubleshooting
description: Symptom-by-symptom fixes for common Flint problems, from extension activation to Designer connectivity, language server, and debugging issues.
---

# Troubleshooting

This page lists the most common problems by symptom, with the underlying cause and the fix. Before diving in, know where Flint writes its logs — most issues can be diagnosed from one of these three places.

## Where to find logs

| Component | Location |
|---|---|
| VS Code extension | Output panel → **Flint** channel (**View: Toggle Output**, then select "Flint") |
| Gateway module | Gateway web console → Logs. Set loggers under `dev.bwdesigngroup.flint` (e.g. `flint.Gateway.*`) to **DEBUG** for detail |
| Designer module | Designer console (**Tools → Console** in Designer); Designer-scope loggers are under `flint.Designer.*` |

:::info Prerequisites
Different features need different connectivity, and many "broken feature" reports are really missing prerequisites. As a quick reference: the Project Browser, resource operations, search, and embedded-script editing work **offline**; the language server needs a **configured gateway with an API token**; the Script Console, debugger, Tag Browser, and live Perspective profiling need the **Designer Bridge module and a running Designer**.
:::

## Extension not activating or config invalid

### The Flint activity bar view shows a welcome message instead of projects

**Cause:** No workspace folder is open, or no Flint configuration file was found.

**Fix:** Open the folder that contains your Ignition projects, then click **Get Started** in the welcome view (or run **Flint: Get Started** from the command palette). The Setup Wizard scans for projects and writes the config file for you — you do not need to hand-write it.

Flint looks for configuration in this order:

1. The path in the `flint.configPath` setting
2. `flint.config.json`
3. `.flint/config.json`
4. `.flint-config.json`
5. `.vscode/flint.config.json`

<!-- SCREENSHOT: Project Browser welcome view with the Get Started button -->

### "Invalid configuration" error or the Project Browser is empty despite a config file

**Cause:** The config file fails schema validation. Common mistakes: missing `schemaVersion` (must be `"0.1"` or `"0.2"`), missing `project-paths` or `gateways`, or an `ignitionVersion` that does not match `major.minor(.patch)`.

**Fix:** Run **Flint: Open Configuration File** — the JSON schema is attached, so errors are underlined in the editor. If the config is on the old `0.1` schema, Flint migrates it automatically. See [Configuration](/reference/configuration) for the full schema.

### Projects exist on disk but do not appear in the tree

**Cause:** Flint treats a directory as an Ignition project only if it contains a `project.json` file. Entries in `project-paths` must point at directories whose *subfolders* are projects (the `data/projects/` layout).

**Fix:** Check that each project folder contains `project.json`, and that `project-paths` points at the parent directory, not the project itself. Also note that a local override file (`flint.local.json`) *replaces* arrays from the base config rather than merging them — a stale local file can hide projects.

## Designer won't connect

The status bar item on the right shows the bridge state (Disconnected → Connecting → Authenticating → Connected). Work through these in order:

1. **Is the Designer Bridge module installed on the gateway?** Check Gateway Config → Modules for "Flint Designer Bridge" (`dev.bwdesigngroup.flint.FlintDesignerBridge`). Install the artifact that matches your gateway line — `Flint-Designer-Bridge-<version>-8.1.modl` for 8.1.44+ or `Flint-Designer-Bridge-<version>-8.3.modl` for 8.3.1+ — from the [module releases page](https://github.com/bw-design-group/flint-designer-bridge-ignition-module/releases). See [Module Installation](/module/installation).
2. **Is a Designer actually running?** The bridge lives in the Designer, not the gateway. Launch a Designer against a gateway that has the module; discovery is automatic within about 5 seconds.
3. **Does the registry directory contain an entry?** On Designer launch the module writes `~/.ignition/flint/designers/designer-<pid>.json` with the WebSocket port and authentication secret. If that file is missing, the module is not loaded in the Designer — check the Designer console for Flint startup messages.
4. **Same OS user and home directory?** The extension reads the registry file from *your* home directory, and the file is created with owner-only permissions (0600). VS Code and the Designer must run as the same OS user on the same machine (or share the filesystem).

<!-- SCREENSHOT: Status bar showing the Designer connection indicator in the Connected state -->

:::warning Upgrading from module 0.13.x or earlier
The module ID changed in v1.0.0. If a gateway still has the old `com.bwdesigngroup.flint-designer-bridge` module installed, uninstall it before installing the new module, then restart the Designer.
:::

:::note WSL
The Designer WebSocket server binds to loopback only, on a dynamic port in the range **52400–52500**. Under WSL2, use mirrored networking mode (or Flint's built-in WSL TCP proxy support) so that `localhost` in WSL reaches a Designer running on Windows, and ensure the Windows home directory registry files are reachable from WSL.
:::

## Language server not working

No completion, hover, definition, or diagnostics in Python files? The default language server talks to the gateway over HTTP — it does **not** need a Designer, but it does need a gateway and token. The proxy it uses is bundled with the extension, so there is nothing extra to install (`flint.languageServer.proxyPath` is only an advanced override).

Check, in order:

1. **Is a gateway selected?** The language server is dormant until you pick a gateway (status bar, or **Flint: Select Gateway**).
2. **Is `flint.languageServer.enabled` on?** It defaults to `true`. When it is `false`, Flint falls back to the legacy completion engine, which provides completion only — no hover, definition, or diagnostics.
3. **Is an API token configured and valid?** The gateway entry in `flint.config.json` needs `modules.project-scan-endpoint.apiTokenFilePath` pointing at a token file. On 8.3 this can be a native gateway API token; on 8.1 it is the Flint-managed bearer token. See [Module Security](/module/security).
4. **Is the gateway endpoint reachable?** Open `http://<gateway>:<port>/data/flint/health` in a browser — it is intentionally unauthenticated. If it does not respond, the module is not installed or the gateway is unreachable.
5. **Check the logs.** The Output panel → **Flint** channel shows proxy startup, the gateway URL it targets, and authentication failures. The server restarts automatically when you change gateways or config.

<!-- SCREENSHOT: Output panel Flint channel showing language server startup lines -->

:::caution Known scope of language features
Diagnostics are **syntax errors only** — there is no name, type, or semantic checking. Hover shows function signatures (no docstrings, and no hover for `system.*` functions). There is no Java-class or tag-path completion. See [Gateway LSP](/language/gateway-lsp) for the full feature matrix.
:::

If `system.*` completions are missing in the legacy engine, download the Ignition stubs — see [stubs download fails](#stub-download-fails) below and [Ignition Stubs](/language/ignition-stubs).

## Tag Browser is empty

**Cause:** The Tag Browser goes through the Designer bridge, not the gateway HTTP endpoint. A configured gateway alone is not enough.

**Fix:** Install the Designer Bridge module and launch a Designer; the Tag Browser view appears once the status bar shows **Connected**. Then use **Refresh Tag Browser** if providers still do not load. See [Tag Browser](/live-tools/tag-browser).

## Debugger won't start

**Cause and fix, in order:**

1. **No connected Designer.** The debugger always requires a connected Designer — for all three scopes (Designer, Gateway, Perspective). Gateway and Perspective scopes execute on the gateway, but the Designer proxies the session. Connect first (status bar → Connected).
2. **Wrong file type.** Flint debugs Python files and Script Console buffers. It warns when you launch against a file that is not a `script-python` project resource — breakpoints in project modules only bind when the files come from the project on disk.
3. **Scope mismatch warnings.** The launch configuration's gateway/project must match the connected Designer's; Flint warns on mismatch. For Perspective scope you must supply a live `perspectiveSessionId`.

:::caution Debugger limitations
The debugger runs an **ad-hoc script buffer** in the real Jython interpreter; breakpoints trap into project modules that buffer calls into. It does **not** attach to live event scripts — you cannot breakpoint a Perspective event handler or a gateway tag-change script and hit it from the running system. Hit-count breakpoint conditions, pause-while-running, stop-on-exception, and set-variable are not functional. See [Debugger Limitations](/debugging/limitations).
:::

## Stub download fails {#stub-download-fails}

**Cause:** Ignition Python stubs are downloaded from PyPI using `pip`, so the first download for each Ignition version needs internet access and a working Python/pip installation.

**Fix:**

- Verify the machine can reach PyPI (proxy/firewall rules for `pypi.org`).
- Retry with **Flint: Download Ignition Stubs** and pick your gateway's version explicitly.
- If the cache is corrupted, run **Flint: Clear Ignition Stubs Cache** (cache lives in `~/.flint/ignition-stubs/<version>/`) and download again.

Note that stubs feed Flint's own completion engine — they are not wired into Pylance, so installing Pylance will not change Flint's completions.

## Still stuck?

Turn the `dev.bwdesigngroup.flint` gateway loggers up to DEBUG, reproduce the issue, and file an issue with the relevant Output panel and gateway log excerpts. For build-from-source and contribution setup, see [Development](/development).
