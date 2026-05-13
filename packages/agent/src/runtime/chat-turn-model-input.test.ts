import { describe, expect, it } from "bun:test";
import type { AgentExecutionContext } from "@/runtime/chat";
import { classifyTurnMessage } from "@/runtime/turn-classification/message";
import { createModelInputAssembly } from "./chat-turn/model-input";

function createModelInputContext() {
  return {
    runtime: {},
    services: {
      personalities: {
        getActive: () => ({
          id: "default-persona",
        }),
      },
      repository: {
        isRepository: () => true,
      },
      settings: {
        get: () => ({
          execution: {
            backend: "local-shell",
          },
          model: {
            provider: "openai",
            model: "gpt-4.1",
            baseUrl: "https://api.example.com/v1",
            temperature: 0.2,
            maxTokens: 2048,
          },
        }),
      },
      sessions: {
        recentBySession: () => [
          {
            sessionId: "session-1",
            createdAt: "2026-05-13T00:00:00.000Z",
            role: "user",
            text: "We want the Doolittle-native wow loop.",
          },
        ],
      },
      userProfiles: {
        get: () => ({
          userId: "alice",
          displayName: "Alex",
          aliases: [],
          facts: ["building Doolittle as an ElizaOS harness"],
          preferences: ["prefers visible todos"],
          explicitMemories: [],
        }),
        recall: () => [],
      },
      memory: {
        summary: (target: "memory" | "user") => ({
          target,
          entries: target === "memory" ? 1 : 0,
          characters: 20,
          preview: [],
        }),
      },
    },
    config: {
      workspaceDir: "/workspace/demo",
    },
  } as unknown as AgentExecutionContext;
}

function createTurn(localInteractive = true) {
  return {
    sessionId: "session-1",
    localInteractive,
  } as unknown as Parameters<typeof createModelInputAssembly>[0]["turn"];
}

describe("chat turn model input seam", () => {
  it("assembles shared prelude sections for local coding turns", () => {
    const context = createModelInputContext();
    const message = "inspect the repo and explain what os I'm on";

    const assembly = createModelInputAssembly({
      context,
      turn: createTurn(),
      effectiveInput: {
        message,
      } as Parameters<typeof createModelInputAssembly>[0]["effectiveInput"],
      derivedTurnPolicy: {
        runDepth: "deep",
        maxIterations: 4,
        toolProgressMode: "all",
        useMultiStep: true,
      },
      turnClassification: classifyTurnMessage(message),
      settingsDuring: context.services.settings.get(),
    });
    const built = assembly.build();

    expect(assembly.capabilityProfile).toBe("coding");
    expect(assembly.requiresPreferredLocalIntentSynthesis).toBe(false);
    expect(built.messagePrelude).toContain("DOOLITTLE EXPERIENCE CONTRACT");
    expect(built.messagePrelude).toContain("concise todo/checklist");
    expect(built.messagePrelude).toContain("savedDisplayName=Alex");
    expect(built.messagePrelude).toContain("Live machine facts:");
    expect(built.messagePrelude).toContain("CAPABILITY PROFILE");
    expect(built.messagePrelude).toContain("profile=coding");
    expect(built.messagePrelude).toContain("CODING CONTEXT");
    expect(built.messagePrelude).toContain("cwd=/workspace/demo");
    expect(built.effectiveMessage).toBe(message);
  });

  it("supports local synthesis prelude injection without response caching", () => {
    const context = createModelInputContext();
    const message = "what os am I on?";

    const assembly = createModelInputAssembly({
      context,
      turn: createTurn(),
      effectiveInput: {
        message,
      } as Parameters<typeof createModelInputAssembly>[0]["effectiveInput"],
      derivedTurnPolicy: {
        runDepth: "quick",
        maxIterations: 1,
        toolProgressMode: "all",
        useMultiStep: false,
      },
      turnClassification: classifyTurnMessage(message),
      settingsDuring: context.services.settings.get(),
      options: {
        personalityId: "reviewer",
      },
      preferredLocalIntent: {
        directLocalIntent: {
          label: "workspace:inspect",
        },
        requiresModelSynthesisForLocalIntent: () => true,
      },
    });
    const localSynthesisPrelude = [
      "Local workspace inspection already executed for this turn.",
      "repo is clean",
    ].join("\n");
    const built = assembly.build(localSynthesisPrelude);

    expect(assembly.requiresPreferredLocalIntentSynthesis).toBe(true);
    expect("responseCacheKey" in assembly).toBe(false);
    expect(built.messagePrelude).toContain(localSynthesisPrelude);
    expect(built.effectiveMessage).toBe(message);
  });
});
