---
title: Searching Resources
description: Find Ignition resources by name, path, or content across all configured projects without opening the Designer.
sidebar_label: Search
---

Flint indexes the resources in your configured Ignition projects and lets you find them by name, path, or file content directly from VS Code. Instead of clicking through the Designer's project tree, you can jump straight to a script line or a Perspective view property in seconds.

:::info Prerequisites
Search works **fully offline**. It only requires a valid `flint.config.json` with at least one project path configured — no gateway connection, API token, or Designer Bridge module is needed. See [Configuration](/reference/configuration).
:::

## Search Resources

**Search Resources** (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> on macOS, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> on Windows/Linux) is the fastest way to locate a resource. It matches your query against resource names, paths, and file contents across **all configured projects** at once.

Run it from the keyboard shortcut, the Command Palette (**Flint: Search Resources**), or the search icon in the Project Browser view title.

<!-- SCREENSHOT: Search Resources quick pick open with a query typed and matching resources listed across two projects -->

- The input is seeded with your **recent searches**, so repeating a query is a single keystroke away.
- Results are ranked by relevance and show the resource type and project.
- Selecting a result opens the resource; content matches **jump directly to the matching line**.

:::note
The keyboard shortcuts are active when the Flint Project Browser is visible (the `flint.projectBrowserVisible` context). If a shortcut does not respond, open the Flint view in the Activity Bar first, or run the command from the Command Palette.
:::

## Find in Resources

**Find in Resources** (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> on macOS, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> on Windows/Linux) is a full-text content search, comparable to VS Code's built-in Find in Files but scoped to Ignition resources. Before the search runs, a confirmation step lets you toggle options:

| Option | Default |
|---|---|
| Case sensitive | Off |
| Whole word | Off |
| Regular expressions | Supported in the query |
| Scope | Currently selected project (falls back to all projects if none is selected) |

<!-- SCREENSHOT: Find in Resources options quick pick showing Case Sensitive, Whole Word, and project scope toggles -->

Results are **grouped by resource**, showing the match count and resource type for each file. Selecting a resource shows its individual matches; selecting a match opens the file at that line. When more than 50 resources match, a summary document lists the complete results.

If a search returns nothing in the current project, Flint offers to rerun it across **all projects** with one click.

<!-- SCREENSHOT: Content Search Results quick pick with grouped results, e.g. "Found 'system.tag.readBlocking' in 12 resources (34 matches)" -->

## Search by Type

**Flint: Search by Type** (`flint.searchByType`) lists every resource of a chosen type — for example, all Named Queries or all Perspective Views — optionally scoped to a project. Pick a resource type from the quick pick, then browse or open the results. This is useful for auditing a project ("show me every View") rather than hunting for a specific string.

You can also start a type-scoped search from a resource type node in the [Project Browser](/features/project-browser).

## Search history

Flint keeps a history of your queries and uses it to seed the Search Resources input with recent searches.

| Item | Value |
|---|---|
| History size | `searchHistoryLimit` in the `settings` block of `flint.config.json` (default: 50) |
| Clear history | **Flint: Clear Search History** (`flint.clearSearchHistory`) |

See [Configuration](/reference/configuration) for the full `settings` schema.

## What gets searched

:::warning Scope
Search operates on the **resources in your configured project paths** — the files that Flint's resource type providers understand (Project Scripts, Named Queries, Perspective Views, Style Classes, Page Config, Session Props). It is not a raw filesystem search: files outside recognized resource structures are not indexed, and binary resources such as Perspective Session Events (`data.bin`) are not content-searchable. For arbitrary files in your workspace, use VS Code's built-in Find in Files.
:::

## Related pages

- [Project Browser](/features/project-browser) — browse the same resources as a tree
- [Resources](/features/resources) — resource types, keys, and operations
- [Commands reference](/reference/commands) — every Flint command in one table
