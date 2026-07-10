---
title: Quick Start
description: Go from a fresh install to browsing an Ignition project in VS Code in about ten minutes.
---

Flint turns a folder of Ignition project files into a structured, navigable workspace in VS Code. This guide takes you from a fresh extension install to browsing a project's resources — no gateway connection or Designer required.

:::info Prerequisites
Everything on this page works **offline**. You need:

- VS Code 1.102 or later with the [Flint for Ignition extension](/getting-started/installation) installed
- Ignition project files on disk — folders that follow the gateway's `data/projects/<name>/` layout, where each project directory contains a `project.json` file

Live features (Script Console, Tag Browser, debugging) additionally require the Designer Bridge module and a running Designer. See [Connecting a Designer](/getting-started/connecting-designer) once you finish here.
:::

## 1. Open your projects folder

Open the folder that contains your Ignition projects in VS Code (**File > Open Folder**). This is typically a checkout of your gateway's `data/projects/` directory, or a repository that contains one or more project directories.

Flint identifies a directory as an Ignition project only if it contains a `project.json` file. The project name comes from that file's `title` field, falling back to the folder name.

## 2. Run the Setup Wizard

Click the Flint icon in the Activity Bar to open the **Project Browser**. With no configuration in the workspace, the view shows a welcome message with a **Get Started** button (this runs the **Flint: Get Started with Flint** command, also available from the Command Palette).

<!-- SCREENSHOT: Project Browser welcome view with the Get Started button, no config present -->

The Setup Wizard walks you through:

1. **Project paths** — add one or more directories, or let the wizard scan them to discover the Ignition projects inside.
2. **Gateways** — add each gateway you work with: a name, host, port, and SSL setting. URLs are validated as you type.

<!-- SCREENSHOT: Setup Wizard webview showing scanned project paths and a gateway entry form -->

When you finish, the wizard writes a `flint.config.json` file to your workspace. This file is meant to be committed, so your whole team shares the same project and gateway definitions.

## 3. Or hand-write the config

If you prefer, create `flint.config.json` at the workspace root yourself. A minimal configuration with one gateway and multiple environments:

```json title="flint.config.json"
{
    "schemaVersion": "0.2",
    "project-paths": ["ignition-data/projects"],
    "gateways": {
        "frontend": {
            "id": "frontend",
            "ignitionVersion": "8.3.1",
            "environments": {
                "local": { "host": "localhost", "port": 8088, "ssl": false },
                "prod": { "host": "frontend.example.com", "port": 443, "ssl": true }
            },
            "defaultEnvironment": "local",
            "enabled": true,
            "projects": ["hmi-frontend", "shared-utilities"]
        }
    }
}
```

Key points:

| Field | Meaning |
|---|---|
| `schemaVersion` | Use `"0.2"` (the current schema; `"0.1"` configs are migrated automatically) |
| `project-paths` | Directories to scan for projects, absolute or relative to the config file |
| `gateways` | One entry per gateway; each maps environments (local, staging, prod, ...) to host/port/SSL |
| `projects` | Which discovered projects belong to this gateway |

The extension validates the file against its bundled JSON schema and reports problems inline. For every option — including per-developer overrides in `flint.local.json` and alternate config locations — see the [configuration reference](/reference/configuration).

## 4. Select a gateway and project

The Project Browser tree stays empty until both an active gateway **and** an active project are selected. Use the status bar items on the left of the window, or the **Select Gateway** and **Select Project** commands from the Command Palette. If your gateway defines multiple environments, the status bar also shows the active environment.

<!-- SCREENSHOT: Status bar showing gateway, environment, and search items with a gateway/project selected -->

Selections persist per workspace, so you only do this once.

## 5. Browse the project

The Project Browser now shows your project's resources grouped by type — Project Scripts, Named Queries, and Perspective resources (Views, Style Classes, Page Config, Session Props, Session Events). Expand a Python script to see its functions, classes, and constants, and click any symbol to jump to its definition. Resources inherited from a parent project appear dimmed with an `(inherited from <parent>)` suffix.

<!-- SCREENSHOT: Project Browser tree expanded, showing grouped resource types and a script expanded to its symbols -->

A few things to try next:

- Press <kbd>Cmd/Ctrl+Shift+R</kbd> to run **Flint: Search Resources** across every project — see [Search](/features/search)
- Right-click a resource to create, rename, duplicate, or delete it — see [Working with Resources](/features/resources)
- Open a Perspective `view.json` and press <kbd>Cmd/Ctrl+Shift+E</kbd> to edit an embedded script as real Python — see [Embedded Scripts](/features/embedded-scripts)

:::note
Everything so far runs entirely from the files on disk. The gateway entries in your config identify projects and enable navigation links; Flint has not connected to anything yet.
:::

## Next steps

To unlock live features — the Script Console, Tag Browser, script debugging, and Perspective profiling — install the Designer Bridge module on your gateway and launch a Designer. Continue with [Connecting a Designer](/getting-started/connecting-designer).
