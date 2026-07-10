---
title: Breakpoint Debugger
description: Debug Ignition Jython scripts with breakpoints, stepping, and variable inspection directly from VS Code.
sidebar_label: Debugger
---

Flint includes a full debug adapter (`type: "flint"`) that runs your Jython scripts on a real Ignition interpreter — in the Designer, on the gateway, or inside a live Perspective session — with line breakpoints, stepping, call stacks, and variable inspection in the standard VS Code debug UI. Because the script executes through Ignition's `ScriptManager`, every `system.*` function behaves exactly as it does in production.

:::info Prerequisites
Debugging always requires the [Designer Bridge module](/module/overview) and a **connected, running Designer** — for all three scopes. Gateway and Perspective scopes execute on the gateway, but the Designer proxies those sessions. See [Connecting to the Designer](/getting-started/connecting-designer).
:::

<!-- SCREENSHOT: VS Code paused at a breakpoint in an Ignition script, showing the call stack, Locals/Globals variables panel, and a watch expression -->

## How execution works

The debugger launches an **ad-hoc script buffer**: the Python file you have open (or a [Script Console](/debugging/script-console) buffer) is sent to the Designer or gateway and executed via `ScriptManager.runCode` on the real Jython interpreter. Breakpoints are not limited to that buffer — if your script calls into project library modules, breakpoints set in those modules trap as well.

:::warning Not an attach debugger
Flint runs *your* script and traps breakpoints along its execution path. It does **not** attach to already-running event scripts — you cannot set a breakpoint in a Perspective event handler or a gateway tag-change script and have it hit when the running system fires that event. Perspective scope runs your code *as if* it were inside the session; it does not intercept the page's own scripts. See [Limitations](/debugging/limitations).
:::

## Starting a debug session

1. Open a Python file from an Ignition project (files outside a `script-python` directory prompt a warning).
2. Press <kbd>F5</kbd>, or open **Run and Debug** and select a `flint` configuration.
3. If VS Code is not connected to a Designer, Flint offers to connect first. A warning appears if the connected Designer's gateway or project does not match your active Flint selection.

<!-- SCREENSHOT: Run and Debug view showing the three Flint launch configurations in the configuration dropdown -->

## launch.json configuration

Flint contributes three ready-made configurations (available via **Add Configuration...** in `launch.json`):

```json title=".vscode/launch.json"
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "flint",
            "name": "Debug Ignition Script (Designer)",
            "request": "launch",
            "program": "${file}",
            "stopOnEntry": false,
            "scope": "designer"
        },
        {
            "type": "flint",
            "name": "Debug Ignition Script (Gateway)",
            "request": "launch",
            "program": "${file}",
            "stopOnEntry": false,
            "scope": "gateway"
        },
        {
            "type": "flint",
            "name": "Debug Perspective Script",
            "request": "launch",
            "program": "${file}",
            "stopOnEntry": false,
            "scope": "perspective",
            "perspectiveSessionId": "",
            "perspectivePageId": "",
            "perspectiveViewInstanceId": "",
            "perspectiveComponentPath": ""
        }
    ]
}
```

### Configuration attributes

| Attribute | Required | Description |
|---|---|---|
| `program` | Yes | Path to the Python script to debug. `${file}` uses the active editor. |
| `stopOnEntry` | No | Pause on the first line before running (default `false`). |
| `scope` | No | `designer` (default), `gateway`, or `perspective`. |
| `perspectiveSessionId` | Perspective scope only | ID of the live Perspective session to bind into. |
| `perspectivePageId` | No | Bind to a specific page in the session. |
| `perspectiveViewInstanceId` | No | Bind to a specific view instance. |
| `perspectiveComponentPath` | No | Component path bound as `self` in your script. |

### Scopes

| Scope | Runs on | Context |
|---|---|---|
| `designer` | Designer's Jython interpreter | Designer scripting context, full `system.*` |
| `gateway` | Gateway (proxied through the Designer) | Gateway scripting context |
| `perspective` | Gateway, inside a live session | Session context; `session`, `page`, and `self` resolve against the session you specify |

Perspective scope fails to launch without a `perspectiveSessionId`. You can find session IDs through the gateway's Perspective session tooling — see [Perspective Profiling](/live-tools/perspective-profiling).

<!-- SCREENSHOT: Debugging a script in perspective scope with the session-bound `self` component expanded in the Variables panel -->

## What works

| Capability | Supported |
|---|---|
| Line breakpoints | Yes, including in project modules your script calls |
| Conditional breakpoints | Yes — the condition is evaluated in the paused frame |
| Step over / into / out, continue | Yes |
| Call stack | Yes (up to 100 frames) |
| Variables | Locals and Globals scopes, with lazy expansion of nested objects (read-only) |
| Expression evaluation | Watch expressions, Debug Console (REPL), and hover evaluation in the paused frame |
| Output | Script output streams to the Debug Console |
| Stop | Terminates the debug session |

## What does not work

:::warning Known limitations
- **Hit-count breakpoints** are accepted by the UI but do not function — the condition is ignored and the breakpoint behaves like a plain line breakpoint.
- **Pause** (async interruption of a running script) is not supported; a script only stops at a breakpoint or when it finishes.
- **Stop on exception** (break on raised/uncaught exceptions) is not implemented.
- **Editing variables** in the Variables panel is not supported; inspection is read-only.
- Function breakpoints, step back, and restart frame are not available.
- While paused at a breakpoint, the real interpreter thread is blocked with no timeout — in gateway scope this holds a gateway thread until you continue or stop. Avoid leaving production gateways paused.
:::

The full list, with workarounds, is on the [Debugging Limitations](/debugging/limitations) page.

## Related pages

- [Script Console](/debugging/script-console) — run scripts without breakpoints, including debugging the console buffer itself
- [Debugging Limitations](/debugging/limitations) — complete constraints and workarounds
- [Module Installation](/module/installation) — install the Designer Bridge module that powers debugging
