---
title: Project Browser
description: Browse Ignition projects, resources, and script symbols in a VS Code tree view, with inheritance annotations and resource health decorations.
---

The Project Browser is Flint's primary view: a tree of your Ignition gateways, projects, and resources rendered directly from the project files on disk. It gives you Designer-style project navigation inside VS Code — including inherited resources and script symbols — without opening the Designer at all.

:::info Prerequisites
**Works offline.** The Project Browser only needs a valid Flint configuration file with at least one gateway and project path — see [Configuration](/reference/configuration). No gateway connection, API token, or Designer Bridge module is required.
:::

## Opening the browser

Click the **Flint for Ignition** icon in the Activity Bar. The Project Browser renders nothing until you have selected both a gateway and a project — use the **Gateway** and **Project** items in the status bar, or the `Flint: Select Gateway` and `Flint: Select Project` commands. If no configuration exists yet, the view shows a welcome panel that launches the Get Started wizard (see [Quick Start](/getting-started/quick-start)).

<!-- SCREENSHOT: Project Browser tree showing a gateway, a selected project, and resource type groups with counts -->

## Tree structure

The tree follows the hierarchy **gateway → project → resource types → folders → resources**:

| Level | What it shows |
|---|---|
| Resource type groups | One node per resource type (Project Scripts, Named Queries, Views, and so on), with a resource count. Perspective types are grouped under a Perspective category. |
| Folders | The folder hierarchy from the project's resource paths. |
| Resources | Individual resources; clicking opens the primary file (for example `code.py` for a script, `view.json` for a view). |
| Singleton config types | Session Props, Session Events, and Page Config appear as single nodes and are created on first click if they do not exist yet. |

See [Resources](/features/resources) for the full list of supported resource types and the operations (create, rename, duplicate, delete) available from the tree's context menus.

### Script symbol expansion

Python script resources expand one level further: functions, classes, and module-level constants appear as child nodes, and classes expand to their methods. Clicking a symbol jumps to its line in the editor, and each symbol offers **Copy Symbol Path** (`flint.copySymbolPath`) to copy its fully qualified path (for example `myProject.utils.calculate`) for use in other scripts or bindings.

<!-- SCREENSHOT: Expanded Project Scripts node showing a script with function and class symbols as children -->

## Inherited resources

When a project inherits from a parent project, inherited resources appear dimmed in the tree with an `(inherited from <parent>)` annotation, so you can see the project's effective contents the same way the Designer presents them. Toggle this with `flint.showInheritedResources`.

<!-- SCREENSHOT: Tree showing dimmed inherited resources annotated with the parent project name -->

## Health decorations

The Project Browser decorates nodes to surface structural problems without you opening each resource:

| Decoration | Meaning |
|---|---|
| Missing `resource.json` | A resource directory has no `resource.json` manifest. The warning propagates up through parent folders so problems are visible from the top of the tree. |
| Invalid `resource.json` | The manifest exists but fails validation. |
| Missing parent project | The project's declared parent cannot be found under your configured project paths. |
| Circular inheritance | The project inheritance chain loops back on itself. |
| Deprecated resource type | The resource uses a type Flint marks as deprecated. |

For missing manifests, run `Flint: Validate Project` to list every issue, or use the tree context-menu actions to create a single `resource.json` or all missing ones at once. See [Resources](/features/resources) for details.

<!-- SCREENSHOT: Tree node with a missing resource.json warning badge propagated to its parent folders -->

## View actions

The view title bar provides three actions:

| Action | Command | Behavior |
|---|---|---|
| Refresh | `flint.refreshProjects` | Re-scans project paths and rebuilds the tree. |
| Search | `flint.searchResources` | Opens resource search (<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>) — see [Search](/features/search). |
| Open Config | `flint.openConfig` | Opens your `flint.config.json`. |

:::note
The Project Browser has no filter, sort, or collapse-all controls. To find a specific resource, use [Search](/features/search) instead; to pick up file changes made outside VS Code, use Refresh (automatic refresh on file changes is on by default via `flint.autoRefreshProjects`).
:::

## Settings

| Setting | Default | Effect |
|---|---|---|
| `flint.showInheritedResources` | `true` | Show inherited resources in the project browser. |
| `flint.groupResourcesByType` | `true` | Group resources by type in the project browser. |
| `flint.autoRefreshProjects` | `true` | Automatically refresh projects when files change. |
| `flint.showEmptyResourceTypes` | `false` | Show resource types even when they have no resources. |

See [Settings](/reference/settings) for the complete settings reference.
