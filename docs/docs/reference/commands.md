---
title: Command Reference
description: Every Flint command, grouped by feature area, with its command palette title, ID, and where it can be invoked.
sidebar_label: Commands
---

Flint contributes its commands under the **Flint:** category in the Command Palette (<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>). Many commands are context-driven — they act on a tree item or editor selection and appear in right-click menus rather than the palette.

:::info Prerequisites
Connectivity requirements vary by group. Configuration, project, resource, `resource.json`, search, and script commands work **offline** with a valid `flint.config.json`. The default language server needs a **configured gateway and API token**. Designer, tag, and live Perspective profiling commands need the **Designer Bridge module and a running, connected Designer** — see [Connecting the Designer](/getting-started/connecting-designer).
:::

## Keyboard shortcuts

| Shortcut (macOS / Win-Linux) | Command | Active when |
|---|---|---|
| <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> | Search Resources | Project Browser visible |
| <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> | Find in Resources | Project Browser visible |
| <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> | Navigate to Script Element | Python editor focused |
| <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>C</kbd> | Copy Qualified Path | Python editor focused |
| <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> | Edit Script | `.json` editor focused |

<!-- SCREENSHOT: Command Palette filtered to "Flint:" showing the command list -->

## Configuration

| Title | ID | Where invoked |
|---|---|---|
| Flint: Get Started with Flint | `flint.getStarted` | Palette, welcome view |
| Flint: Open Configuration | `flint.openConfig` | Palette, Project Browser toolbar |
| Flint: Add Gateway | `flint.addGateway` | Palette, inline button in Project Browser |
| Flint: Remove Gateway | `flint.removeGateway` | Palette |
| Flint: Add Project Paths | `flint.addProjectPaths` | Palette |
| Flint: Select Environment | `flint.selectEnvironment` | Palette, gateway context menu |
| Flint: Debug Configuration | `flint.debugConfig` | Palette |

See [Configuration](/reference/configuration) for the `flint.config.json` schema these commands manage.

## Gateway

| Title | ID | Where invoked |
|---|---|---|
| Select Gateway | `flint.selectGateway` | Palette, inline button in Project Browser |
| Flint: Open Gateway Webpage | `flint.navigateToGateway` | Palette |
| Flint: Open Designer | `flint.navigateToDesigner` | Palette |
| Flint: Open Gateway Webpage | `flint.navigateToGatewayFromNode` | Gateway context menu |
| Flint: Open Designer | `flint.navigateToDesignerFromNode` | Gateway context menu |

## Project

| Title | ID | Where invoked |
|---|---|---|
| Select Project | `flint.selectProject` | Palette, inline button in Project Browser |
| Refresh Projects | `flint.refreshProjects` | Palette, Project Browser toolbar |
| Flint: Validate Project | `flint.validateProject` | Palette |
| Flint: Open project.json | `flint.openProjectJson` | Palette, project context menu |

## Resources

| Title | ID | Where invoked |
|---|---|---|
| Open Resource | `flint.openResource` | Click on a resource in the tree |
| Create Resource | `flint.createResource` | Palette (active project), context menu on type/category/folder |
| Create Folder | `flint.createFolder` | Palette (active project), context menu on type/category/folder |
| Delete | `flint.deleteResource` | Resource/folder context menu |
| Duplicate | `flint.duplicateResource` | Resource/folder context menu |
| Rename | `flint.renameResource` | Resource/folder context menu |
| Copy Path | `flint.copyResourcePath` | Resource/folder context menu |

## resource.json

| Title | ID | Where invoked |
|---|---|---|
| Flint: Create resource.json | `flint.createResourceJson` | Context menu on items flagged as missing `resource.json` |
| Flint: Create All Missing resource.json Files | `flint.createAllMissingResourceJson` | Resource type/category context menu |
| Flint: Validate resource.json Files | `flint.validateResourceJson` | Project context menu |

## Search

| Title | ID | Where invoked |
|---|---|---|
| Flint: Search Resources | `flint.searchResources` | Palette, keybinding, Project Browser toolbar |
| Flint: Find in Resources | `flint.findInResources` | Palette, keybinding |
| Flint: Search by Type | `flint.searchByType` | Palette |
| Flint: Clear Search History | `flint.clearSearchHistory` | Palette |

Details in [Search](/features/search).

## Scripts and language

| Title | ID | Where invoked |
|---|---|---|
| Flint: Edit Script | `flint.editEmbeddedScript` | Editor context menu on `.json`, keybinding |
| Flint: Compare Decoded with Git | `flint.compareDecodedWithGit` | Palette |
| Flint: Paste as JSON | `flint.pasteAsJson` | Palette, editor context menu |
| Flint: Compare Decoded Scripts | `flint.compareConflictScripts` | Code action on merge-conflicted script fields |
| Flint: Accept Current (Left Side) | `flint.acceptCurrentScript` | Editor title button in conflict comparison |
| Flint: Accept Incoming (Right Side) | `flint.acceptIncomingScript` | Editor title button in conflict comparison |
| Flint: Navigate to Script Element | `flint.navigateToScriptElement` | Palette, keybinding |
| Flint: Copy Qualified Path | `flint.copyQualifiedPath` | Editor context menu (project scripts), keybinding |
| Flint: Copy Symbol Path | `flint.copySymbolPath` | Python symbol context menu in Project Browser |
| Flint: Download Ignition Stubs | `flint.downloadIgnitionStubs` | Palette |
| Flint: Clear Ignition Stubs Cache | `flint.clearIgnitionStubsCache` | Palette |

See [Embedded Scripts](/features/embedded-scripts), [Git Merge Conflicts](/features/git-merge-conflicts), and [Ignition Stubs](/language/ignition-stubs).

<!-- SCREENSHOT: right-click context menu on a view.json editor showing "Edit Script" -->

## Designer bridge

| Title | ID | Where invoked |
|---|---|---|
| Flint: Connect to Designer | `flint.connectToDesigner` | Palette, status bar item |
| Flint: Disconnect from Designer | `flint.disconnectFromDesigner` | Palette |
| Flint: Send Message to Designer | `flint.sendMessageToDesigner` | Palette |
| Flint: Open Ignition Script Console | `flint.openScriptConsole` | Palette |
| Flint: Run in Flint | `flint.runInFlint` | Palette, editor context menu on Python files |
| Flint: Open in Designer | `flint.openInDesigner` | Resource context menu in Project Browser |

## Debugging

Debugging is not started from a dedicated command. Launch it from a `launch.json` configuration with `"type": "flint"`, or toggle debug mode in the [Script Console](/debugging/script-console). See [Debugger](/debugging/debugger).

## Tags

All tag commands operate on nodes in the [Tag Browser](/live-tools/tag-browser) and require a connected Designer.

| Title | ID | Where invoked |
|---|---|---|
| Flint: Read Value | `flint.readTagValue` | Tag context menu |
| Flint: Write Value | `flint.writeTagValue` | Tag context menu |
| Flint: Get Configuration | `flint.getTagConfig` | Tag/UDT context menu |
| Flint: Create Tag | `flint.createTag` | Provider/folder context menu |
| Flint: Delete | `flint.deleteTag` | Tag/folder/UDT context menu |
| Flint: Copy Tag Path | `flint.copyTagPath` | Tag context menu |
| Flint: Refresh Tag Browser | `flint.refreshTagBrowser` | Tag Browser toolbar and context menu |

## Perspective

| Title | ID | Where invoked |
|---|---|---|
| Flint: Analyze View Performance | `flint.perspective.analyzeView` | Perspective view context menu (works offline) |
| Flint: Profile View Performance | `flint.perspective.profileView` | Palette (needs connected Designer and live session) |
| Flint: Profile Page Bindings | `flint.perspective.profilePage` | Palette (needs connected Designer and live session) |

Details in [Perspective Profiling](/live-tools/perspective-profiling).

## External tools

| Title | ID | Where invoked |
|---|---|---|
| Flint: Open with Kindling | `flint.openWithKindling` | Explorer context menu on `.gwbk`, `.modl`, `.idb`, `.log` files |
| Flint: Configure Kindling Executable Path | `flint.configureKindlingPath` | Palette |
| Flint: Reset Kindling Installation Setting | `flint.resetKindlingSetting` | Palette |
| Flint: Reset Designer Launcher Setting | `flint.resetDesignerLauncherSetting` | Palette |
| Flint: Reset Tool Settings | `flint.resetToolSettings` | Palette |

See [External Tools](/reference/external-tools).

<!-- SCREENSHOT: Explorer context menu on a .gwbk file showing "Open with Kindling" -->

:::note
A handful of command IDs visible in the extension manifest (for example `flint.exportConfiguration`, `flint.filterTree`, `flint.debugScript`) are reserved and not currently functional. Only the commands listed on this page are supported.
:::
