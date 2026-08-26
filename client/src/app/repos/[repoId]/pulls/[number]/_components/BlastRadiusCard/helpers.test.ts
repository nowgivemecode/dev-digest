import { describe, it, expect } from "vitest";
import { buildSymbolRows, buildCronSet } from "./helpers";
import type { BlastRadiusResult } from "@devdigest/shared";

const makeBlast = (overrides: Partial<BlastRadiusResult> = {}): BlastRadiusResult => ({
  changedSymbols: [],
  callers: [],
  impactedEndpoints: [],
  ...overrides,
});

describe("buildSymbolRows", () => {
  it("maps symbols to callers", () => {
    const blast = makeBlast({
      changedSymbols: [
        { name: "foo", kind: "function", file: "src/foo.ts" },
        { name: "bar", kind: "class", file: "src/bar.ts" },
      ],
      callers: [
        { symbol: "foo", file: "src/caller.ts", line: 10 },
        { symbol: "foo", file: "src/other.ts", line: 20 },
        { symbol: "bar", file: "src/main.ts", line: 5 },
      ],
    });

    const rows = buildSymbolRows(blast);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      name: "foo",
      kind: "function",
      file: "src/foo.ts",
      callers: [
        { symbol: "foo", file: "src/caller.ts", line: 10 },
        { symbol: "foo", file: "src/other.ts", line: 20 },
      ],
    });
    expect(rows[1]).toEqual({
      name: "bar",
      kind: "class",
      file: "src/bar.ts",
      callers: [{ symbol: "bar", file: "src/main.ts", line: 5 }],
    });
  });

  it("excludes callers from the declaration file (same file as symbol)", () => {
    const blast = makeBlast({
      changedSymbols: [{ name: "fn", kind: "function", file: "src/fn.ts" }],
      callers: [
        { symbol: "fn", file: "src/fn.ts", line: 1 },   // same file — should be excluded
        { symbol: "fn", file: "src/other.ts", line: 5 }, // different file — kept
      ],
    });
    const rows = buildSymbolRows(blast);
    expect(rows[0]?.callers).toHaveLength(1);
    expect(rows[0]?.callers[0]?.file).toBe("src/other.ts");
  });

  it("sorts callers by rank ascending", () => {
    const blast = makeBlast({
      changedSymbols: [{ name: "fn", kind: "function", file: "src/fn.ts" }],
      callers: [
        { symbol: "fn", file: "src/c.ts", line: 1, rank: 3 },
        { symbol: "fn", file: "src/a.ts", line: 1, rank: 1 },
        { symbol: "fn", file: "src/b.ts", line: 1, rank: 2 },
      ],
    });
    const rows = buildSymbolRows(blast);
    expect(rows[0]?.callers.map((c) => c.file)).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
  });

  it("limits callers to 20", () => {
    const callers = Array.from({ length: 30 }, (_, i) => ({
      symbol: "bigFn",
      file: `src/caller${i}.ts`,
      line: i + 1,
    }));
    const blast = makeBlast({
      changedSymbols: [{ name: "bigFn", kind: "function", file: "src/big.ts" }],
      callers,
    });

    const rows = buildSymbolRows(blast);

    expect(rows[0]?.callers).toHaveLength(20);
  });
});

describe("buildCronSet", () => {
  it("collects unique crons across files", () => {
    const factsByFile: BlastRadiusResult["factsByFile"] = {
      "src/a.ts": { endpoints: ["/api/a"], crons: ["0 * * * *", "*/5 * * * *"] },
      "src/b.ts": { endpoints: ["/api/b"], crons: ["0 * * * *", "0 0 * * *"] },
    };

    const crons = buildCronSet(factsByFile);

    expect(crons.size).toBe(3);
    expect(crons.has("0 * * * *")).toBe(true);
    expect(crons.has("*/5 * * * *")).toBe(true);
    expect(crons.has("0 0 * * *")).toBe(true);
  });

  it("returns empty set when factsByFile is undefined", () => {
    const crons = buildCronSet(undefined);
    expect(crons.size).toBe(0);
  });
});
