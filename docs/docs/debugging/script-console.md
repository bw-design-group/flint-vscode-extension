---
title: Script Console
description: Run Jython interactively against a live Designer, Gateway, or Perspective session from a VS Code panel.
---

The Flint Script Console is a live Jython REPL inside VS Code that executes code on a real Ignition interpreter — the same `ScriptManager` your Designer and Gateway use, with full access to `system.*` functions, tags, named queries, and project scripts. It replaces round-trips to the Designer's built-in Script Console with a workflow that stays in your editor.

:::info Prerequisites
The Script Console requires the **Designer Bridge module** installed on your gateway and a **running, connected Designer**. It does not work offline or with only a gateway API token. See [Connecting a Designer](/getting-started/connecting-designer) and [Module Installation](/module/installation).
:::

## Opening the console

Open the console in any of these ways:

- Run **Flint: Open Ignition Script Console** from the Command Palette.
- Open the **Flint** panel at the bottom of VS Code and select the **Script Console** tab.

The console connects through the active Designer bridge session shown in the status bar. If no Designer is connected, connect one first with **Flint: Connect to Designer**.

<!-- SCREENSHOT: Script Console open in the bottom Flint panel with a system.tag.readBlocking call and its result -->

## Execution scopes

The console can execute code in three scopes, selectable in the console toolbar:

| Scope | Where code runs | Notes |
|---|---|---|
| **Designer** | The connected Designer's Jython interpreter | Equivalent to the Designer's own Script Console |
| **Gateway** | The gateway's Jython interpreter | The Designer proxies the request to the gateway |
| **Perspective** | Inside a live Perspective session context | Requires binding to a running session |

When you select the Perspective scope, pickers prompt you to choose a live **session**, then a **page**, then a **view**. Your code then runs as if it were executing inside that session — `session`, `page`, and view context objects are available, and `system.perspective.*` functions target the bound session.

<!-- SCREENSHOT: Perspective scope pickers showing session, page, and view selection -->

## Persistent session state

Variables, imports, and function definitions persist between executions within a console session, just like the Designer's Script Console. You can build up state across multiple runs:

```python
# First execution
tags = system.tag.readBlocking(["[default]Pump/Speed"])

# Later execution — `tags` is still defined
print tags[0].value
```

The console also provides code completion as you type, backed by the connected Designer.

:::note
Ignition scripting is Jython 2.7 — Python 2 syntax applies (`print` statement, no f-strings).
:::

## Run in Flint

To execute a whole file instead of typing into the console, right-click inside any open `.py` file in the editor and choose **Run in Flint**. The file's contents are sent to the console and executed in the currently selected scope.

<!-- SCREENSHOT: Editor context menu on a .py file showing the Run in Flint entry -->

## Debugging from the console

The console toolbar includes a **debug toggle**. With it enabled, the next execution starts a debug session instead of running straight through: breakpoints you have set in the script are honored, and VS Code's debugger UI (call stack, variables, stepping) takes over. See [Debugger](/debugging/debugger) for details and [Debugger Limitations](/debugging/limitations) for what is not supported.

:::warning Limitations
- The console (in all scopes) executes the code **you submit** — an ad-hoc script buffer. It does not attach to scripts already running on the gateway or in a Perspective session, so you cannot intercept a live event handler with it. Breakpoints do trap into project script modules that your submitted code calls.
- The Perspective scope requires a live session; if the session, page, or view closes, re-bind through the pickers.
- Code blocked at a breakpoint holds the real executing thread until you continue or stop the session.
:::

## Related pages

- [Debugger](/debugging/debugger) — full breakpoint debugging of scripts in all three scopes
- [Debugger Limitations](/debugging/limitations)
- [Connecting a Designer](/getting-started/connecting-designer)
