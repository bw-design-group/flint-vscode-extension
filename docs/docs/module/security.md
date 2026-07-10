---
title: Security Model
description: How the Flint Designer Bridge authenticates Designer WebSocket clients and gateway HTTP API requests, and how to protect its tokens.
sidebar_label: Security
---

The Flint Designer Bridge exposes two attack surfaces: a per-Designer WebSocket server and an optional headless HTTP endpoint on the gateway. This page explains exactly how each is locked down and what you are responsible for protecting.

:::info Prerequisites
This page applies once the Designer Bridge module is installed on a gateway (see [Module Installation](/module/installation)). No extension configuration is required to understand or apply this guidance.
:::

## Designer WebSocket

Every running Designer with the module loaded starts a JSON-RPC WebSocket server. Its defenses, in order:

| Control | Detail |
|---------|--------|
| Network scope | Binds to loopback only (`localhost`), ports **52400–52500**. Never reachable from other machines. |
| Secret | Per-instance 256-bit hex secret generated with `SecureRandom` at Designer startup. |
| File permissions | Secret stored in `~/.ignition/flint/designers/designer-<pid>.json` with owner-only permissions (`0600`), alongside a `.lock` file. |
| Authentication | Every method except `authenticate` is rejected until the client authenticates. The secret comparison is constant-time to resist timing attacks. |
| Lifecycle | Registry files are deleted on clean Designer shutdown; stale files from crashed Designers are reaped on the next startup. |

Clients (the VS Code extension, or anything else on the same machine) discover a Designer by reading its registry file and then calling `authenticate` with the secret. Being able to read the file *is* the credential.

### What the registry file contains

Each `designer-<pid>.json` includes the authentication secret plus connection metadata: gateway host, port, and SSL flag, the open project name, the OS username, the Designer version, and the embedded browser CDP port. The owner-only file permissions are the entire protection boundary for this data — any process running as your user can connect to your Designers.

:::warning
Do not loosen permissions on `~/.ignition/flint/designers/` or copy registry files elsewhere. Anyone who can read a registry file can authenticate to that Designer and execute Designer-scope Jython as you.
:::

<!-- SCREENSHOT: Finder/terminal view of ~/.ignition/flint/designers/ showing a designer-<pid>.json with 0600 permissions -->

## Gateway HTTP endpoint

The [headless API](/module/headless-api) adds two routes on the gateway web server:

| Route | Method | Auth |
|-------|--------|------|
| `/data/flint/health` | GET | None — public by design, safe for load balancers and monitoring probes |
| `/data/flint/rpc` | POST | Required on every request |

### Authentication by Ignition version

| Ignition line | Accepted credentials |
|---------------|----------------------|
| 8.3.1+ | Native platform API token via `X-Ignition-API-Token: keyId:secret` header, **or** the Flint bearer token as a fallback |
| 8.1.44+ | Flint bearer token only, via `Authorization: Bearer <token>` |

On 8.3, prefer native API tokens — they are managed, audited, and revocable through the gateway itself.

### Flint bearer token resolution

The module resolves its bearer token in this order:

1. The `flint.gateway.apiToken` system property or the `FLINT_GATEWAY_API_TOKEN` environment variable. These are never persisted to disk, which makes them the right choice for containers.
2. An existing token file, if one is present.
3. A freshly auto-generated 48-character token written to `<dataDir>/modules/flint/gateway/api-token.json` with `0600` permissions.

To rotate an auto-generated token, delete the token file and restart the gateway (or set the environment variable, which always wins).

<!-- SCREENSHOT: gateway data directory showing modules/flint/gateway/api-token.json -->

:::danger Treat the token like a gateway admin credential
A valid token — native or Flint bearer — grants **gateway-developer power**: arbitrary gateway-scope Jython execution, plus create/read/update/delete on project resources, views, tags, and UDTs. There is no reduced-privilege mode. Anyone holding the token can do anything a developer logged into the gateway could do.

- Never commit the token to source control or paste it into shared documents.
- Never expose the gateway web port directly to the public internet.
- Use TLS (HTTPS) on the gateway so tokens are not sent in cleartext; restrict `/data/flint/rpc` reachability with firewalls or network segmentation.
- On 8.3, use native API tokens so you can revoke access per client.
:::

## Practical guidance

- **Developer workstations:** the Designer WebSocket needs no configuration and never leaves the machine. Keep your home directory permissions intact and you are covered.
- **CI and containers:** inject `FLINT_GATEWAY_API_TOKEN` as a secret; nothing is written to disk.
- **Shared or production gateways:** think carefully before installing the module at all. If you do, mint a dedicated 8.3 native API token per consumer and keep the endpoint behind TLS on a private network. See [Headless API](/module/headless-api) for usage and [Troubleshooting](/troubleshooting) for auth failures.
