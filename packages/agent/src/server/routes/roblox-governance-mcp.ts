import type { AppContext } from "@/runtime/bootstrap";
import { json } from "@/server/responses";
import {
  getRobloxGovernanceMcpHealth,
  handleRobloxGovernanceMcpRequest,
} from "@/services/roblox-governance-mcp";
import { readPublicAssociation } from "@/services/roblox-governance-mcp/evidence";

export function isRobloxGovernancePublicRoute(url: URL): boolean {
  return (
    url.pathname === "/mcp" ||
    url.pathname === "/mcp/health" ||
    url.pathname === "/.well-known/project-association.json"
  );
}

export async function handleRobloxGovernanceMcpRoutes(
  _context: AppContext,
  request: Request,
  url: URL,
): Promise<Response | null> {
  if (
    request.method === "GET" &&
    url.pathname === "/.well-known/project-association.json"
  ) {
    return json(readPublicAssociation());
  }

  if (request.method === "GET" && url.pathname === "/mcp/health") {
    return json(getRobloxGovernanceMcpHealth());
  }

  if (request.method === "POST" && url.pathname === "/mcp") {
    return handleRobloxGovernanceMcpRequest(request);
  }

  if (request.method === "GET" && url.pathname === "/mcp") {
    return json(getRobloxGovernanceMcpHealth());
  }

  return null;
}
