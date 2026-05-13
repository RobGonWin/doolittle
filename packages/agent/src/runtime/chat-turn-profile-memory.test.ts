import { describe, expect, it } from "bun:test";
import { extractDisplayNameUpdate } from "./chat-turn/native/profile-memory";

describe("profile memory native turn helpers", () => {
  it("extracts explicit display name updates from mixed requests", () => {
    expect(
      extractDisplayNameUpdate(
        "Update my name to SYMBiEX, tell me about yourself.",
      ),
    ).toBe("SYMBiEX");
    expect(extractDisplayNameUpdate("My name is Alex.")).toBe("Alex");
  });

  it("ignores unrelated identity questions", () => {
    expect(extractDisplayNameUpdate("What is your name?")).toBeUndefined();
  });
});
