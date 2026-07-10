---
title: Embedded Script Editing
description: Decode Python scripts embedded in Ignition JSON resources into real Python editors, then re-encode them on save.
sidebar_label: Embedded Scripts
---

Ignition stores the Python that lives inside Perspective views, transforms, message handlers, and tag event scripts as escaped strings inside JSON files — one long line with `\n` and `\t` sequences instead of real line breaks. Flint decodes those strings into proper Python documents with syntax highlighting and IntelliSense, and re-encodes them back into the JSON when you save.

:::info Prerequisites
Works completely offline. No gateway connection, API token, or Designer Bridge module is required — only a valid `flint.config.json` (see [Configuration](/reference/configuration)).
:::

## Edit Script

With a `.json` resource open, place your cursor inside an encoded script value and run **Flint: Edit Script** (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> on macOS, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> on Windows/Linux). Flint:

1. Detects which script the cursor is in and decodes it.
2. Opens the decoded script as a Python document beside the JSON file.
3. Prepends the correct function signature for that script type, so the code reads exactly as it does in Designer.
4. Re-encodes the script and writes it back into the JSON file when you save the Python document.

<!-- SCREENSHOT: JSON view file and decoded Python editor side by side, cursor in a config.script value -->

The decoded document uses the virtual `flint-script` URI scheme — it is not a file on disk. The JSON resource remains the single source of truth; saving the virtual document updates the JSON, which you then commit as usual.

### Recognized script types

Flint identifies the script type from its position in the JSON and applies the matching signature wrapper:

| Script type | JSON key pattern | Signature wrapper |
|---|---|---|
| Component event script | `config.script` | `def runAction(self, event):` |
| Binding transform | `transforms.code` | `def transform(self, value, quality, timestamp):` |
| Custom method | `customMethods.script` | `def <name>(self, <params>):` (from the method definition) |
| Message handler | `messageHandlers.script` | `def onMessageReceived(self, payload):` |
| Tag event script | `eventScripts.script` | `def valueChanged(tag, tagPath, previousValue, currentValue, initialChange, missedEvents):` |
| Property change script | `onChange.script` | `def valueChanged(self, previousValue, currentValue, origin, missedEvents):` |

:::warning
The signature line is context only — it is stripped out before re-encoding, because Ignition stores only the function body. If you modify or delete the signature line, saving fails with an error so the JSON is never corrupted.
:::

<!-- SCREENSHOT: decoded transform script showing the def transform(...) wrapper line and highlighted Python body -->

Decoded scripts get the same language features as project script files, including Jython-aware completion and `system.*` IntelliSense — see [Language Features](/language/overview).

## Compare Decoded with Git

Run **Flint: Compare Decoded with Git** on a JSON resource to open a diff against the Git HEAD version, with your current file shown in decoded form. This makes it much easier to review what actually changed in a view than reading escaped one-line strings in a raw diff.

<!-- SCREENSHOT: diff editor titled "view.json (Git HEAD ↔ Decoded)" -->

:::note Limitation
The left side of the diff (the Git HEAD version) is shown in its original **encoded** form; only the right side (your current file) is decoded. You can still read your current scripts as real Python, but the HEAD side displays escaped strings.
:::

If the file has no Git history, the command falls back to comparing the decoded version against the original encoded file.

## Paste as JSON

Copying data structures out of Ignition — script console output, dataset dumps, property values — often yields Python notation rather than valid JSON: `u'string'` prefixes, `True`/`False`/`None`, single quotes. **Flint: Paste as JSON** reads the clipboard, converts that Python notation to valid JSON, and pastes the result at the cursor.

<!-- SCREENSHOT: command palette showing Flint: Paste as JSON with converted output in a JSON file -->

## Related pages

- Resolving Git merge conflicts inside encoded scripts: [Git Merge Conflicts](/features/git-merge-conflicts)
- Completion, hover, and diagnostics for decoded scripts: [Language Features](/language/overview)
- Running scripts against a live Designer: [Script Console](/debugging/script-console)
