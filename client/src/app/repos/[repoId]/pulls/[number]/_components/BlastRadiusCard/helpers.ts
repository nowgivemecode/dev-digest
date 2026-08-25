import type { BlastRadiusResult } from "@devdigest/shared";

export interface SymbolRow {
  name: string;
  kind: string;
  file: string;
  callers: Array<{ symbol: string; file: string; line: number }>;
}

export function buildSymbolRows(blast: BlastRadiusResult): SymbolRow[] {
  return blast.changedSymbols.map((sym) => ({
    name: sym.name,
    kind: sym.kind,
    file: sym.file,
    callers: blast.callers
      .filter((c) => c.symbol === sym.name)
      .slice(0, 20),
  }));
}

export function buildCronSet(factsByFile?: BlastRadiusResult["factsByFile"]): Set<string> {
  const crons = new Set<string>();
  if (!factsByFile) return crons;
  for (const facts of Object.values(factsByFile)) {
    for (const c of facts.crons) crons.add(c);
  }
  return crons;
}
