import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { buildInventoryRows } from "./inventory";

const repoRoot = resolve(import.meta.dir, "..", "..");

describe("buildInventoryRows", () => {
  it("classifies the autocoder and product runtime rows truthfully", () => {
    const rows = buildInventoryRows(repoRoot);

    expect(rows.find((row) => row.id === "research.autocoder")).toEqual(
      expect.objectContaining({
        packageName: "@doolittle/plugin-autocoder",
        maturity: "experimental",
        persistence: "injected",
      }),
    );

    expect(rows.find((row) => row.id === "product.doolittle-runtime")).toEqual(
      expect.objectContaining({
        packageName: "doolittle-runtime",
        owner: "doolittle-runtime",
        publishIntent: "internal-product-layer",
        workspacePath: "packages/plugins/doolittle-plugin",
      }),
    );
  });
});
