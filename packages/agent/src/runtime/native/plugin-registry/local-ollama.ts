import {
  type IAgentRuntime,
  type JsonValue,
  logger,
  ModelType,
  type Plugin,
} from "@elizaos/core";
import type { EnvConfig } from "@/types/runtime";

type UnknownParams = unknown;

type OllamaGenerateResponse = {
  response?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

type OllamaTimingDetails = {
  modelType: string;
  model: string;
  promptChars: number;
  maxTokens?: number;
  elapsedMs: number;
  stats?: OllamaGenerateResponse;
};

function apiBase(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
}

function runtimeSetting(
  runtime: IAgentRuntime,
  key: string,
  fallback: string,
): string {
  const value = runtime.getSetting(key);
  return typeof value === "string" && value.trim() ? value : fallback;
}

function textFromParams(params: UnknownParams): string {
  if (typeof params === "string") {
    return params;
  }
  if (!params || typeof params !== "object") {
    return "";
  }
  const text = (params as { text?: unknown }).text;
  if (typeof text === "string") {
    return text;
  }
  const prompt = (params as { prompt?: unknown }).prompt;
  return typeof prompt === "string" ? prompt : "";
}

function numberFromParams(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function recordFromParams(params: UnknownParams): Record<string, unknown> {
  return params && typeof params === "object"
    ? (params as Record<string, unknown>)
    : {};
}

function fallbackEmbedding(text: string, dimensions = 1536): number[] {
  const seed = text || "test";
  const vector: number[] = [];
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  for (let index = 0; index < dimensions; index += 1) {
    hash ^= index + 0x9e3779b9;
    hash = Math.imul(hash, 16777619);
    vector.push(((hash >>> 0) % 10_000) / 10_000);
  }
  return vector;
}

function modelForType(
  runtime: IAgentRuntime,
  config: EnvConfig,
  modelType: string,
): string {
  const small = runtimeSetting(
    runtime,
    "OLLAMA_SMALL_MODEL",
    config.ollamaSmallModel,
  );
  const large = runtimeSetting(
    runtime,
    "OLLAMA_LARGE_MODEL",
    config.ollamaLargeModel,
  );
  const response = runtimeSetting(
    runtime,
    "OLLAMA_RESPONSE_HANDLER_MODEL",
    small,
  );
  const planner = runtimeSetting(runtime, "OLLAMA_ACTION_PLANNER_MODEL", large);

  switch (modelType) {
    case ModelType.TEXT_NANO:
    case ModelType.RESPONSE_HANDLER:
      return response;
    case ModelType.TEXT_SMALL:
      return small;
    case ModelType.TEXT_MEDIUM:
    case ModelType.ACTION_PLANNER:
    case ModelType.TEXT_REASONING_SMALL:
      return planner;
    default:
      return large;
  }
}

function maxPredictForType(
  config: EnvConfig,
  modelType: string,
  requestedMaxTokens?: number,
): number {
  const requested = Math.max(
    1,
    Math.floor(requestedMaxTokens ?? config.openAiMaxTokens),
  );
  const cap =
    {
      [ModelType.TEXT_NANO]: 96,
      [ModelType.RESPONSE_HANDLER]: 64,
      [ModelType.TEXT_SMALL]: 256,
      [ModelType.TEXT_MEDIUM]: 320,
      [ModelType.ACTION_PLANNER]: 160,
      [ModelType.TEXT_REASONING_SMALL]: 320,
      [ModelType.TEXT_LARGE]: 640,
      [ModelType.TEXT_COMPLETION]: 640,
      [ModelType.TEXT_REASONING_LARGE]: 768,
      [ModelType.TEXT_MEGA]: 1024,
    }[modelType] ?? 640;

  return Math.min(requested, cap);
}

function shouldTraceOllama(runtime: IAgentRuntime): boolean {
  const raw =
    runtime.getSetting("DOOLITTLE_OLLAMA_TRACE") ??
    process.env.DOOLITTLE_OLLAMA_TRACE;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return true;
  }
  return !["0", "false", "off", "no"].includes(raw.trim().toLowerCase());
}

function durationMs(nanoseconds: number | undefined): number | undefined {
  return typeof nanoseconds === "number" && Number.isFinite(nanoseconds)
    ? Math.round(nanoseconds / 1_000_000)
    : undefined;
}

function tokensPerSecond(
  count: number | undefined,
  nanoseconds: number | undefined,
): number | undefined {
  if (
    typeof count !== "number" ||
    count <= 0 ||
    typeof nanoseconds !== "number" ||
    nanoseconds <= 0
  ) {
    return undefined;
  }
  return Math.round((count / (nanoseconds / 1_000_000_000)) * 10) / 10;
}

function logOllamaTiming(
  runtime: IAgentRuntime,
  message: string,
  details: OllamaTimingDetails,
): void {
  if (!shouldTraceOllama(runtime)) {
    return;
  }
  logger.info(
    {
      src: "doolittle:ollama",
      modelType: details.modelType,
      model: details.model,
      promptChars: details.promptChars,
      maxTokens: details.maxTokens,
      elapsedMs: details.elapsedMs,
      totalMs: durationMs(details.stats?.total_duration),
      loadMs: durationMs(details.stats?.load_duration),
      promptEvalTokens: details.stats?.prompt_eval_count,
      promptEvalMs: durationMs(details.stats?.prompt_eval_duration),
      promptEvalTps: tokensPerSecond(
        details.stats?.prompt_eval_count,
        details.stats?.prompt_eval_duration,
      ),
      evalTokens: details.stats?.eval_count,
      evalMs: durationMs(details.stats?.eval_duration),
      evalTps: tokensPerSecond(
        details.stats?.eval_count,
        details.stats?.eval_duration,
      ),
    },
    message,
  );
}

async function ollamaGenerate(
  runtime: IAgentRuntime,
  config: EnvConfig,
  modelType: string,
  params: UnknownParams,
): Promise<string> {
  const record = recordFromParams(params);
  const prompt = textFromParams(params);
  const model = modelForType(runtime, config, modelType);
  const maxTokens = maxPredictForType(
    config,
    modelType,
    numberFromParams(record, "maxTokens"),
  );
  const endpoint = runtimeSetting(
    runtime,
    "OLLAMA_API_ENDPOINT",
    config.ollamaApiEndpoint,
  );
  const startedAt = performance.now();
  const response = await (runtime.fetch ?? fetch)(
    `${apiBase(endpoint)}/api/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        system:
          typeof record.system === "string"
            ? record.system
            : (runtime.character?.system ?? undefined),
        stream: false,
        keep_alive: "10m",
        options: {
          temperature:
            numberFromParams(record, "temperature") !== undefined
              ? numberFromParams(record, "temperature")
              : config.openAiTemperature,
          num_predict: maxTokens,
          stop: Array.isArray(record.stopSequences)
            ? record.stopSequences
            : undefined,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama generate failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  logOllamaTiming(runtime, "Ollama generate complete", {
    modelType,
    model,
    promptChars: prompt.length,
    maxTokens,
    elapsedMs: Math.round(performance.now() - startedAt),
    stats: data,
  });
  return data.response?.trim() ?? "";
}

async function ollamaEmbedding(
  runtime: IAgentRuntime,
  config: EnvConfig,
  params: UnknownParams,
): Promise<number[]> {
  const text = textFromParams(params) || "test";
  const endpoint = runtimeSetting(
    runtime,
    "OLLAMA_API_ENDPOINT",
    config.ollamaApiEndpoint,
  );
  const model = runtimeSetting(
    runtime,
    "OLLAMA_EMBEDDING_MODEL",
    config.ollamaEmbeddingModel,
  );
  const fetcher = runtime.fetch ?? fetch;
  const startedAt = performance.now();

  try {
    const embedResponse = await fetcher(`${apiBase(endpoint)}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: text }),
    });
    if (embedResponse.ok) {
      const data = (await embedResponse.json()) as { embeddings?: number[][] };
      const embedding = data.embeddings?.[0];
      if (Array.isArray(embedding)) {
        if (shouldTraceOllama(runtime)) {
          logger.info(
            {
              src: "doolittle:ollama",
              modelType: ModelType.TEXT_EMBEDDING,
              model,
              inputChars: text.length,
              dimensions: embedding.length,
              elapsedMs: Math.round(performance.now() - startedAt),
              endpoint: "embed",
            },
            "Ollama embedding complete",
          );
        }
        return embedding;
      }
    }

    const legacyResponse = await fetcher(
      `${apiBase(endpoint)}/api/embeddings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
      },
    );
    if (legacyResponse.ok) {
      const data = (await legacyResponse.json()) as { embedding?: number[] };
      if (Array.isArray(data.embedding)) {
        if (shouldTraceOllama(runtime)) {
          logger.info(
            {
              src: "doolittle:ollama",
              modelType: ModelType.TEXT_EMBEDDING,
              model,
              inputChars: text.length,
              dimensions: data.embedding.length,
              elapsedMs: Math.round(performance.now() - startedAt),
              endpoint: "embeddings",
            },
            "Ollama embedding complete",
          );
        }
        return data.embedding;
      }
    }
  } catch {
    return fallbackEmbedding(text);
  }

  return fallbackEmbedding(text);
}

async function ollamaObject(
  runtime: IAgentRuntime,
  config: EnvConfig,
  modelType: string,
  params: UnknownParams,
): Promise<Record<string, JsonValue>> {
  const text = await ollamaGenerate(runtime, config, modelType, params);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<
        string,
        JsonValue
      >;
    } catch {
      return {};
    }
  }
  return {};
}

export function createLocalOllamaModelsPlugin(config: EnvConfig): Plugin {
  const textModel =
    (modelType: string) => (runtime: IAgentRuntime, params: UnknownParams) =>
      ollamaGenerate(runtime, config, modelType, params);

  return {
    name: "doolittle-ollama-local",
    description:
      "Doolittle local Ollama model handlers using the Ollama REST API directly.",
    models: {
      [ModelType.TEXT_NANO]: textModel(ModelType.TEXT_NANO),
      [ModelType.TEXT_SMALL]: textModel(ModelType.TEXT_SMALL),
      [ModelType.TEXT_MEDIUM]: textModel(ModelType.TEXT_MEDIUM),
      [ModelType.TEXT_LARGE]: textModel(ModelType.TEXT_LARGE),
      [ModelType.TEXT_MEGA]: textModel(ModelType.TEXT_MEGA),
      [ModelType.RESPONSE_HANDLER]: textModel(ModelType.RESPONSE_HANDLER),
      [ModelType.ACTION_PLANNER]: textModel(ModelType.ACTION_PLANNER),
      [ModelType.TEXT_REASONING_SMALL]: textModel(
        ModelType.TEXT_REASONING_SMALL,
      ),
      [ModelType.TEXT_REASONING_LARGE]: textModel(
        ModelType.TEXT_REASONING_LARGE,
      ),
      [ModelType.TEXT_COMPLETION]: textModel(ModelType.TEXT_COMPLETION),
      [ModelType.TEXT_EMBEDDING]: (runtime, params) =>
        ollamaEmbedding(runtime, config, params),
      [ModelType.OBJECT_SMALL]: (runtime, params) =>
        ollamaObject(runtime, config, ModelType.TEXT_SMALL, params),
      [ModelType.OBJECT_LARGE]: (runtime, params) =>
        ollamaObject(runtime, config, ModelType.TEXT_LARGE, params),
    },
  };
}

export function createLocalOllamaEmbeddingPlugin(config: EnvConfig): Plugin {
  return {
    name: "doolittle-ollama-local-embeddings",
    description:
      "Doolittle local Ollama embedding handler for non-Ollama text providers.",
    models: {
      [ModelType.TEXT_EMBEDDING]: (runtime, params) =>
        ollamaEmbedding(runtime, config, params),
    },
  };
}
