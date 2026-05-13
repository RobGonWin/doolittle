import { describe, expect, it } from "bun:test";
import { type IAgentRuntime, ModelType, type Plugin } from "@elizaos/core";
import { stableHashVector } from "./hash";
import createLocalEmbeddingPlugin from "./index";

type LocalEmbeddingServiceShape = {
  status(): {
    provider: string;
    available: boolean;
    detail: string;
  };
  embed(text: string, dimensions?: number): number[];
  similarity(left: string, right: string, dimensions?: number): number;
  stop(): Promise<void>;
};

type LocalEmbeddingServiceClass = {
  serviceType: string;
  start(runtime: IAgentRuntime): Promise<LocalEmbeddingServiceShape>;
};

describe("local embedding plugin", () => {
  it("builds deterministic normalized vectors", () => {
    const first = stableHashVector("doolittle");
    const second = stableHashVector("doolittle");
    const reduced = stableHashVector("doolittle", 4);

    expect(first).toEqual(second);
    expect(first).toHaveLength(16);
    expect(reduced).toHaveLength(4);
    expect(reduced.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("exposes an offline embedding service with stable similarity", async () => {
    const plugin = createLocalEmbeddingPlugin() as Plugin & {
      services: unknown[];
    };
    const ServiceClass = plugin
      .services[0] as unknown as LocalEmbeddingServiceClass;
    const service = await ServiceClass.start({} as IAgentRuntime);

    expect(plugin.name).toBe("local-embedding");
    expect(ServiceClass.serviceType).toBe("local_embedding");
    expect(service.status()).toEqual({
      provider: "local",
      available: true,
      detail:
        "Deterministic local embeddings are active for startup-safe memory and knowledge operations.",
    });

    const embedded = service.embed("hello world", 8);
    const modelEmbedding = await plugin.models?.[ModelType.TEXT_EMBEDDING]?.(
      {} as IAgentRuntime,
      {
        text: "hello world",
      },
    );

    expect(embedded).toHaveLength(8);
    expect(modelEmbedding).toHaveLength(1536);
    expect(
      await plugin.models?.[ModelType.TEXT_EMBEDDING]?.(
        {} as IAgentRuntime,
        "hello world",
      ),
    ).toEqual(modelEmbedding);
    expect(service.embed("hello world", 8)).toEqual(embedded);
    expect(service.similarity("hello world", "hello world", 8)).toBe(1);
    expect(service.similarity("hello world", "different text", 8)).toBeLessThan(
      1,
    );

    await expect(service.stop()).resolves.toBeUndefined();
  });
});
