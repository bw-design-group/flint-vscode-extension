---
title: Perspective Performance Profiling
description: Analyze Perspective view structure offline and profile live sessions for slow bindings and oversized properties.
sidebar_label: Perspective Profiling
---

Flint includes three performance tools for Perspective: a static analyzer that inspects a `view.json` file without any connection, and two live profilers that measure real binding behavior in a running Perspective session. Together they help you find the views, bindings, and properties that make pages slow before your operators do.

These are performance tools, not a debugger. For script debugging, see [Debugger](/debugging/debugger).

:::info Prerequisites
- **Analyze View Performance** works completely offline — it only needs a `view.json` file on disk.
- **Profile View Performance** and **Profile Page Bindings** require the [Designer Bridge module](/module/overview), a [connected Designer](/getting-started/connecting-designer), the Perspective module on the gateway, and at least one **running Perspective session**.
:::

## Analyze View Performance (offline)

**Flint: Analyze View Performance** (`flint.perspective.analyzeView`) performs static analysis of a Perspective `view.json` and opens a report in the Profiler webview, with a summary notification of component count and warnings.

Run it from:

- The Project Browser context menu on a Perspective view
- The Command Palette with a `view.json` file open in the editor
- The Command Palette with no file open — you are prompted to select a `view.json`

<!-- SCREENSHOT: Profiler webview showing a static analysis report with metrics and warnings for a large view -->

The analyzer walks the component tree and view-level `propConfig`, collecting metrics such as component count, nesting depth, binding counts by type, transform counts, script events, and serialized property sizes. Each metric is compared against thresholds and reported as a medium- or high-severity warning when exceeded:

| Metric | Medium | High |
|---|---|---|
| Component count | 100 | 250 |
| Maximum nesting depth | 8 | 12 |
| Total bindings | 50 | 150 |
| Script transforms | 10 | 30 |
| Embedded views | 5 | 15 |
| Flex repeaters | 2 | 5 |
| Gateway-scoped scripts | 3 | 10 |
| Single property size | 10 KB | 50 KB |
| Total view size | 100 KB | 500 KB |

Each warning includes a recommendation for reducing the load. Because this is static analysis of the JSON on disk, it reflects the view's design cost — it cannot observe actual runtime binding execution.

## Profile View Performance (live)

**Flint: Profile View Performance** (`flint.perspective.profileView`) captures a runtime snapshot of a single view instance in a live Perspective session. If the Designer is not connected, Flint prompts you to connect first.

You are walked through three pickers:

1. **Session** — active Perspective sessions, shown with user name, project, and view count
2. **Page** — pages open in that session (auto-selected when there is only one)
3. **View** — view instances on that page, with component counts (auto-selected when there is only one)

<!-- SCREENSHOT: Quick pick showing active Perspective sessions with user, project, and view counts -->

The result opens in the Profiler webview: component-level metrics, binding states, binding errors, and property sizes as they exist in the running session. The completion notification summarizes total components, total bindings, and any binding errors.

<!-- SCREENSHOT: Profiler webview showing a runtime profile with per-component binding metrics -->

## Profile Page Bindings (live)

**Flint: Profile Page Bindings** (`flint.perspective.profilePage`) opens the page binding profiler webview in idle mode. From the webview you choose a session and page, set a poll interval, and start a recording; Flint then polls binding activity on that page and streams pending, resolved, and error counts into the timeline. A reload-and-record mode restarts a view and captures its bindings resolving from a cold start, which is useful for measuring initial page-load behavior.

<!-- SCREENSHOT: Page binding profiler webview recording a live page, showing binding resolution timeline -->

Stop the recording from the webview when you have captured enough data. Closing the panel stops the recording automatically.

## Limitations

:::warning Limitations
- The live profilers require a running Perspective session — they cannot profile a view that no one has open, and they report an error if the Perspective module is not available on the gateway.
- Static analysis thresholds are heuristics: exceeding one does not guarantee a slow view, and staying under them does not guarantee a fast one.
- These tools observe and measure only. They do not modify views, pause execution, or intercept the page's own scripts — script debugging is a separate feature with its own [constraints](/debugging/limitations).
:::

## Related pages

- [Connecting the Designer](/getting-started/connecting-designer) — set up the bridge the live profilers depend on
- [Tag Browser](/live-tools/tag-browser) — another live tool that uses the same Designer connection
- [Module Overview](/module/overview) — what the Designer Bridge module provides
