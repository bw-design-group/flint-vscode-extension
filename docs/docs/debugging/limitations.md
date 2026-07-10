---
title: Debugger Limitations
description: What the Flint Jython debugger can and cannot do, and how to work within those boundaries.
sidebar_label: Limitations
---

The Flint debugger runs your script buffer inside a real Ignition Jython interpreter, which makes it powerful — but it is not a full-featured attach debugger. This page lists every known limitation honestly so you know what to expect before you rely on it.

:::info Prerequisites
The debugger always requires the [Designer Bridge module](/module/installation) and a running, connected Designer — for all three scopes (Designer, Gateway, and Perspective). See [Connecting a Designer](/getting-started/connecting-designer).
:::

## You debug script buffers, not live event scripts

The debugger executes an **ad-hoc script buffer** — an open `.py` file or a [Script Console](/debugging/script-console) buffer — inside the real Designer or Gateway Jython interpreter, with full `system.*` access. Breakpoints trap into any project library modules that your buffer calls into.

It does **not** attach to scripts that Ignition itself fires:

- You cannot set a breakpoint in a Perspective event handler and hit it by clicking the button in a running session.
- You cannot breakpoint a gateway tag-change, timer, or message-handler script and wait for the gateway to trigger it.
- Perspective scope runs *your* code as if it were inside a live session (with `session`, `page`, and component context available); it does not intercept the page's own scripts.

**The workaround** is usually simple: write a small buffer that calls the same project library function the event script calls, set your breakpoints inside that library module, and debug from there.

<!-- SCREENSHOT: A debug session paused at a breakpoint inside a project library module, called from a small ad-hoc buffer -->

## Controls that do not work

Some standard debug controls are non-functional in the current engine, even where the VS Code UI offers them:

| Control | Status |
|---|---|
| Line breakpoints | Works |
| Conditional breakpoints (expression) | Works — evaluated in the paused frame |
| Step over / into / out, continue | Works |
| Call stack, Locals/Globals scopes, variable expansion | Works |
| Watch, Debug Console, hover evaluation | Works |
| **Hit-count breakpoints** | **Not functional** — accepted by the UI but never triggers on count |
| **Pause while running** | **Not functional** — the pause button is a no-op; the script runs until it hits a breakpoint or finishes |
| **Stop on exception** | **Not implemented** — uncaught exceptions end the run; they do not break into the debugger |
| **Edit variable values (Set Value)** | **Not supported** |
| Function breakpoints | Not supported |
| Step back / restart frame | Not supported |

:::warning
Hit-count breakpoints deserve special mention: VS Code lets you enter a hit condition without complaint, but the breakpoint will simply never pause. Use an expression condition (for example `i > 100`) instead.
:::

<!-- SCREENSHOT: VS Code breakpoint context menu showing expression condition entry -->

## A paused breakpoint blocks a real thread

When a breakpoint pauses, it blocks the **actual worker thread** executing your script until you continue or stop the session. There is no wall-clock timeout that releases it automatically.

:::danger Production gateways
In Gateway or Perspective scope, that paused thread lives on the gateway. Leaving a session paused ties up a gateway execution thread for as long as you sit at the breakpoint. Debug gateway-scoped code against a development gateway whenever possible, and always continue or stop sessions promptly on shared or production systems.
:::

## Single thread view

The debugger presents exactly one thread. Scripts you launch run on a single dedicated thread, and that is the only thread you can inspect — there is no view into other Designer or gateway threads, and no multi-threaded stepping. The call stack is capped at 100 frames.

## Python 2.7 semantics

Ignition scripting is Jython 2.7, so everything you debug follows **Python 2.7** semantics: `print` is a statement, integer division truncates, strings are bytes by default, and Python 3 syntax fails to parse. This matches the [gateway language server](/language/gateway-lsp), which uses the same Python 2.7 parser for diagnostics.

## Other minor quirks

- In Designer scope, stepping stops are reported with the reason "breakpoint" rather than "step" — cosmetic only.
- Stack paging requests are ignored; the full (capped) stack is always returned.

<!-- SCREENSHOT: Debug toolbar during a paused Flint session, with call stack and variables panes visible -->

## Related pages

- [Script Console](/debugging/script-console) — run and debug ad-hoc buffers
- [Debugger](/debugging/debugger) — launch configurations and the three scopes
- [Troubleshooting](/troubleshooting) — connection and session issues
