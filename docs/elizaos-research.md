# ElizaOS Research Notes

This document captures framework-level findings that matter for keeping Doolittle aligned with the current ElizaOS 2.x architecture.

## Package Status Observed On May 9, 2026

Current npm metadata is not lockstep across the ElizaOS package family, so Doolittle should pin package-by-package instead of assuming one shared version.

| Package | npm `latest` | npm `alpha` | Doolittle strategy |
| --- | --- | --- | --- |
| `elizaos` | `1.7.2` | `2.0.0-alpha.535` | Use explicit alpha |
| `@elizaos/core` | `1.7.2` | `2.0.0-alpha.537` | Use explicit alpha |
| `@elizaos/agent` | `0.25.9` | `2.0.0-alpha.537` | Use explicit alpha |
| `@elizaos/skills` | `2.0.0-alpha.77` | `2.0.0-alpha.539` | Use explicit alpha |
| `@elizaos/autonomous` | `2.0.0-alpha.77` | `2.0.0-alpha.85` | Keep current alpha, because no newer alpha is published |
| `@elizaos/plugin-openai` | `1.6.0` | `2.0.0-alpha.537` | Use explicit alpha |
| `@elizaos/plugin-sql` | `1.7.2` | `2.0.0-alpha.20` | Keep workspace compatibility wrapper around the newest published alpha |

Implications:

- The 2.x runtime line still lives behind explicit alpha tags for the core runtime packages.
- Several official plugins have reached `2.0.0-alpha.537`, but some packages, such as SQL and autonomous, have their own latest available alpha.
- Workspace wrappers are still valuable where Doolittle needs compatibility patches or plugins that are not published as official npm packages.

## Current Architecture Findings

### 1. The New `ElizaOS` Orchestrator Is A Better Harness Boundary

The current runtime docs show `ElizaOS` handling plugin resolution, multi-agent orchestration, `addAgents`, `startAgents`, `handleMessage`, streaming callbacks, events, and health checks.

What that means for Doolittle:

- Doolittle should keep shrinking toward a harness around ElizaOS runtime orchestration.
- Local CLI, gateway, browser, account linking, and diagnostics should wrap the runtime instead of becoming a parallel agent framework.
- The Doolittle value layer is operator ergonomics, provider/account bridges, native local execution, and harness policy.

### 2. Runtime-Centered Design Is Still Correct

ElizaOS is still centered around `AgentRuntime` and plugin-loaded runtime capabilities.

What that means for Doolittle:

- character, plugins, model settings, memory, and message processing should remain the center of the app
- HTTP, CLI, gateway, and scheduling layers should adapt into runtime messages and services
- app code should avoid duplicating runtime orchestration where the SDK now owns it

### 3. Services Are The Native Long-Running Integration Model

Official docs register services through plugins and expose them with `runtime.getService(...)`.

Implication for Doolittle:

- gateway lifecycles, browser/MCP bridges, platform adapters, account refreshers, and background coordination should continue moving into ElizaOS plugin services
- standalone app services should be treated as harness adapters unless they truly belong outside the runtime

### 4. Plugins Are Broader Than Actions

Current plugin docs cover actions, providers, evaluators, services, routes, events, and model handlers.

Implication for Doolittle:

- the Doolittle plugin surface should prefer native plugin components over app-only extension points
- plugin-provided routes may be a good fit for runtime-owned APIs
- model/provider wrappers should stay plugin-native so they can benefit from SDK routing and model selection

## Application Direction For Doolittle

### Good Current Alignment

- runtime-centered bootstrapping
- custom Doolittle plugin for actions/providers/evaluators/models
- SQL-backed runtime initialization
- canonical message processing path for chat requests
- workspace wrappers where official package versions lag or Doolittle needs compatibility patches

### Highest-Value Next Refactors

1. Treat Doolittle as the harness around ElizaOS rather than a replacement agent runtime.
2. Evaluate replacing remaining bespoke runtime boot logic with the `ElizaOS` orchestrator where the alpha SDK now supports it cleanly.
3. Promote gateway lifecycle and account/provider bridges into real ElizaOS `Service` classes where they are still app-bound.
4. Move runtime-owned HTTP surfaces into plugin routes when the ownership boundary is clear.
5. Keep package audit/version tooling explicit about `latest` versus `alpha`, because npm dist-tags are mixed across the ecosystem.

## Sources Consulted

Primary sources:

- ElizaOS core runtime docs: https://docs.elizaos.ai/runtime/core
- ElizaOS services docs: https://docs.elizaos.ai/runtime/services
- ElizaOS project docs: https://docs.elizaos.ai/projects/overview
- ElizaOS plugin reference: https://docs.elizaos.ai/plugins/reference
- npm package metadata via `npm view` for `elizaos`, `@elizaos/core`, `@elizaos/agent`, `@elizaos/skills`, `@elizaos/autonomous`, `@elizaos/plugin-openai`, and `@elizaos/plugin-sql`
