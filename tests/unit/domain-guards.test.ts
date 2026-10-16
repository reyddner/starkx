import { describe, expect, it } from "vitest";
import {
  isCaissonFoundation,
  isDeepFoundation,
  isFootingFoundation,
  isPileCapFoundation,
  isPileFoundation,
  isRaftFoundation,
  type Foundation,
} from "../../domain/types";

const base = { id: "x", label: "L", boreholeId: "bh1" };

describe("domain foundation type guards (DEC-33)", () => {
  const pile: Foundation = {
    ...base,
    id: "p1",
    kind: "pile",
    pileTypeId: 6,
    diameter_m: 0.3,
    length_m: 8,
    tipDepth_m: 8,
    position: { x_m: 0, y_m: 0 },
  };
  const footing: Foundation = {
    ...base,
    id: "f1",
    kind: "footing",
    width_m: 2,
    length_m: 2,
    height_m: 0.5,
  };
  const raft: Foundation = {
    ...base,
    id: "r1",
    kind: "raft",
    outline: [
      { x_m: 0, y_m: 0 },
      { x_m: 10, y_m: 0 },
      { x_m: 10, y_m: 12 },
      { x_m: 0, y_m: 12 },
    ],
    thickness_m: 0.4,
  };
  const caisson: Foundation = {
    ...base,
    id: "c1",
    kind: "caisson",
    diameter_m: 1.2,
    length_m: 10,
  };
  const cap: Foundation = {
    ...base,
    id: "b1",
    kind: "pile_cap",
    pileGroupId: "g1",
    edge_m: 0.25,
    thickness_m: 0.6,
  };

  it("discrimina kinds", () => {
    expect(isPileFoundation(pile)).toBe(true);
    expect(isPileFoundation(footing)).toBe(false);
    expect(isFootingFoundation(footing)).toBe(true);
    expect(isRaftFoundation(raft)).toBe(true);
    expect(isCaissonFoundation(caisson)).toBe(true);
    expect(isPileCapFoundation(cap)).toBe(true);
  });

  it("isDeepFoundation", () => {
    expect(isDeepFoundation(pile)).toBe(true);
    expect(isDeepFoundation(caisson)).toBe(true);
    expect(isDeepFoundation(cap)).toBe(true);
    expect(isDeepFoundation(footing)).toBe(false);
    expect(isDeepFoundation(raft)).toBe(false);
  });
});
