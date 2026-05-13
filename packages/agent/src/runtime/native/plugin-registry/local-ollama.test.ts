import { describe, expect, it } from "bun:test";
import { type IAgentRuntime, ModelType } from "@elizaos/core";
import type { EnvConfig } from "@/types";
import { createLocalOllamaModelsPlugin } from "./local-ollama";

function createConfig(overrides: Partial<EnvConfig> = {}): EnvConfig {
  return {
    ollamaApiEndpoint: "http://localhost:11434/api",
    ollamaSmallModel: "granite4.1:3b",
    ollamaLargeModel: "granite4.1:3b",
    ollamaEmbeddingModel: "nomic-embed-text:latest",
    openAiTemperature: 0.4,
    openAiMaxTokens: 1200,
    ...overrides,
  } as EnvConfig;
}

describe("createLocalOllamaModelsPlugin", () => {
  it("generates text through the local Ollama REST API", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const plugin = createLocalOllamaModelsPlugin(createConfig());
    const runtime = {
      getSetting: () => undefined,
      fetch: async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({
          url: String(url),
          body: JSON.parse(String(init?.body)),
        });
        return Response.json({ response: "local response" });
      },
    } as unknown as IAgentRuntime;

    const result = await plugin.models?.[ModelType.TEXT_LARGE]?.(runtime, {
      prompt: "hello",
      maxTokens: 32,
    });

    expect(result).toBe("local response");
    expect(calls[0]?.url).toBe("http://localhost:11434/api/generate");
    expect(calls[0]?.body).toMatchObject({
      model: "granite4.1:3b",
      prompt: "hello",
      stream: false,
      keep_alive: "10m",
      options: {
        num_predict: 32,
      },
    });
  });

  it("caps hidden planning calls so local models do not inherit the broad default budget", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const plugin = createLocalOllamaModelsPlugin(createConfig());
    const runtime = {
      getSetting: () => undefined,
      fetch: async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({
          url: String(url),
          body: JSON.parse(String(init?.body)),
        });
        return Response.json({ response: "plan" });
      },
    } as unknown as IAgentRuntime;

    await plugin.models?.[ModelType.ACTION_PLANNER]?.(runtime, {
      prompt: "choose the next action",
    });

    expect(calls[0]?.body).toMatchObject({
      model: "granite4.1:3b",
      options: {
        num_predict: 160,
      },
    });
  });

  it("uses Ollama embeddings and falls back deterministically when unavailable", async () => {
    const plugin = createLocalOllamaModelsPlugin(createConfig());
    const runtime = {
      getSetting: () => undefined,
      fetch: async (url: string | URL | Request) => {
        if (String(url).endsWith("/api/embed")) {
          return Response.json({ embeddings: [[0.1, 0.2, 0.3]] });
        }
        return new Response("missing", { status: 404 });
      },
    } as unknown as IAgentRuntime;

    await expect(
      plugin.models?.[ModelType.TEXT_EMBEDDING]?.(runtime, {
        text: "hello",
      }),
    ).resolves.toEqual([0.1, 0.2, 0.3]);

    const fallbackRuntime = {
      getSetting: () => undefined,
      fetch: async () => new Response("missing", { status: 404 }),
    } as unknown as IAgentRuntime;
    const fallback = await plugin.models?.[ModelType.TEXT_EMBEDDING]?.(
      fallbackRuntime,
      "hello",
    );

    expect(fallback).toHaveLength(1536);
    await expect(
      plugin.models?.[ModelType.TEXT_EMBEDDING]?.(fallbackRuntime, "hello"),
    ).resolves.toEqual(fallback);
  });
});
