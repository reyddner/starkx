import { describe, expect, it } from "vitest";
import { calculate } from "@engine/index";
import { refInput, refExpected } from "../fixtures/reference";

describe("calculate — guards de entrada", () => {
  it("methods: [] lança erro explícito (DEC-36)", () => {
    expect(() =>
      calculate({
        ...(refInput as Parameters<typeof calculate>[0]),
        methods: [],
      }),
    ).toThrow(/ao menos um método geotécnico/i);
  });
});
