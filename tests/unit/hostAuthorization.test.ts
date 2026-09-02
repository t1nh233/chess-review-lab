import { describe, expect, it } from "vitest";
import { assertHostAuthorization } from "../../src/offscreen/hostAuthorization";

describe("offscreen analysis host authorization", () => {
  it.each(["LIVE_GAME", "UNKNOWN"] as const)("rejects %s even with a token", (state) => expect(() => assertHostAuthorization(state, true)).toThrow());
  it.each(["SAFE_COMPLETED_GAME", "SAFE_IMPORTED_PGN"] as const)("accepts a validated %s job", (state) => expect(() => assertHostAuthorization(state, true)).not.toThrow());
  it("rejects a forged safe job without the service-worker token", () => expect(() => assertHostAuthorization("SAFE_IMPORTED_PGN", false)).toThrow(/authorization/));
});
