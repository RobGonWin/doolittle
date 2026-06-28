export interface JsonSchema {
  [key: string]: unknown;
}

export interface McpSecurityScheme {
  type: "noauth" | "oauth2";
  scopes?: string[];
}

export interface McpToolDescriptor {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  annotations: {
    readOnlyHint: true;
    openWorldHint: false;
    destructiveHint: false;
    idempotentHint: true;
  };
  securitySchemes: McpSecurityScheme[];
  _meta: {
    securitySchemes: McpSecurityScheme[];
    "openai/toolInvocation/invoking": string;
    "openai/toolInvocation/invoked": string;
  };
}

export interface McpContentItem {
  type: "text";
  text: string;
}

export interface McpToolResult {
  structuredContent?: Record<string, unknown>;
  content: McpContentItem[];
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

export interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}
