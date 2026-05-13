# Doolittle-Style Doolittle Harness Plan

## Goal

Make Doolittle feel like the ElizaOS-native version of the Doolittle Agent wow loop: a warm, persistent, terminal-native collaborator with strong local execution, visible control, memory, skills, recovery, and research-grade trajectories.

## Doolittle Patterns Worth Keeping

- **Live operator loop**: Doolittle makes the terminal feel alive with status bars, spinners, tool previews, approvals, interrupts, `/retry`, `/undo`, `/usage`, `/compress`, and model controls.
- **Closed learning loop**: Doolittle treats memory, todos, skills, session search, and trajectory export as one workflow rather than separate panels.
- **One command grammar**: CLI, TUI, gateway, and autocomplete derive from the same command registry.
- **Platform continuity**: Gateway conversations can resume, route home, approve commands, and preserve session context.
- **Research readiness**: Trajectories are first-class artifacts for compression, replay, batch generation, evaluation, and future small-model training.

## Doolittle Direction

Doolittle should not clone Doolittle as a Python monolith. It should use ElizaOS as the native substrate and make the harness feel better by tightening the experience spine:

- **ElizaOS-native identity**: character, personality, memory, and runtime services shape every model path.
- **Terminal-first recovery**: `/retry`, `/undo`, `/todo`, `/usage`, `/compress`, `/status`, and `/doctor` stay available inside the chat loop.
- **Tool use with receipts**: every local action records progress and trajectory events without drowning the user in logs.
- **Local-first providers**: Devin, Ollama, Codex, Claude Code, and ElizaCloud are selectable providers, but local/non-cloud status must be truthful.
- **Training harness**: trajectory records include conversation, model request/response, tool lifecycle, shell output, failures, timings, and final receipts.

## Implemented In This Slice

- `/retry` replays the latest real conversational turn after removing its previous answer, without storing `/retry` as the prompt.
- `/undo` removes the latest conversational exchange from session memory.
- `/todo list`, `/todo add`, and `/todo show` alias Doolittle's native planning service for Doolittle-native task tracking.
- Provider-path model input now includes a Doolittle experience contract: warm Eliza-style presence, memory continuity, visible todos for multi-step work, and truthful execution receipts.
- Command catalog and help examples advertise the recovery and todo loop.

## Next Todo

1. Promote `/model list`, `/model use`, and `/accounts use devin|ollama|codex|claude-code` into one coherent model picker.
2. Add a compact live status footer for plain shell mode: provider/model, elapsed turn time, context pressure, active tool, and last trajectory event.
3. Make `/insights` summarize session cost, tool patterns, slow phases, and trajectory quality.
4. Add a “skill after complex work” nudge that can synthesize a reusable skill from a successful trajectory.
5. Add gateway native experience checks for typing/progressive delivery, approvals, home routing, voice memo routing, and session continuity.
6. Add a Doolittle-vs-Doolittle benchmark pack covering small talk, coding, daily task automation, memory recall, CLI recovery, and multi-tool research.
