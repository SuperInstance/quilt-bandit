// merge_receipts.mjs — consolidate the chunk receipts into the ensemble receipt
// of record. Recomputes the pre-registered claim verdicts over the full seed set.
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import glob from "node:fs/promises";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const dir = path.join(ROOT, "receipts");
const files = (await import("node:fs")).readdirSync(dir).filter((f) => /^experiment-v0\.1\.0\.chunk.*\.json$/.test(f)).sort();
const chunks = files.map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
const perSeed = chunks.flatMap((c) => c.perSeed);
const seeds = perSeed.map((p) => p.seed);
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

const c3 = perSeed.map((p) => p.isolatedMeanRegret - p.federatedMeanRegret);
const c4 = perSeed.map((p) => p.federatedMeanRegret - p.ditheredMeanRegret);
const winsC3 = c3.filter((x) => x > 0).length;
const winsC4 = c4.filter((x) => x > 0).length;
const varIso = mean(perSeed.map((p) => { const m = mean(p.isolatedPerReplica); return Math.sqrt(mean(p.isolatedPerReplica.map((x) => (x - m) ** 2))); }));
const varFed = mean(perSeed.map((p) => { const m = mean(p.federatedPerReplica); return Math.sqrt(mean(p.federatedPerReplica.map((x) => (x - m) ** 2))); }));
const varDit = mean(perSeed.map((p) => { const m = mean(p.ditheredPerReplica); return Math.sqrt(mean(p.ditheredPerReplica.map((x) => (x - m) ** 2))); }));

const merged = {
  experiment: "quilt-bandit federation of record — MERGED ENSEMBLE",
  mergeOf: files,
  seeds,
  config: chunks[0].config,
  startedISO: chunks[0].startedISO,
  finishedISO: chunks[chunks.length - 1].finishedISO,
  preRegistered: {
    C3: "FEDERATED < ISOLATED on >= 8/10 seeds (paired mean pseudo-regret)",
    C4: "DITHERED < FEDERATED on >= 8/10 seeds (paired mean pseudo-regret)",
    C1: "FEDERATED re-run bit-identical (regret, knowledge, cumReward)",
    C5: "every replica's knowledge >= its own observations",
  },
  claims: {
    C3_federation: {
      wins: winsC3, of: seeds.length,
      verdict: winsC3 >= 8 ? "HELD" : "FAILED",
      meanDelta: mean(c3),
      sd: sd(c3),
      perSeedDelta: c3.map((x) => +x.toFixed(4)),
      note: "FAILED the 8/10 bar honestly. Deltas are bimodal: |delta| <= 5.5 on 8/10 seeds, one +47.4 (federation saves the swarm), one -34.5 (federation herds it onto a worse arm). Mean effect +3.79 regret in federation's favor.",
    },
    C4_dithering: {
      wins: winsC4, of: seeds.length,
      verdict: winsC4 >= 8 ? "HELD" : "FAILED",
      meanDelta: mean(c4),
      sd: sd(c4),
      perSeedDelta: c4.map((x) => +x.toFixed(4)),
      note: "FAILED: at drift 0.01 / 1500 steps the epsilon-ladder's extra exploration is a small tax on 8/10 seeds (delta -0.3..-5.9); it saves the swarm on seed 404 (+20.4) and costs it on seed 606 (-22.9). Delta = fedMean - ditMean; positive favors dithering.",
    },
    C1_determinism: chunks.every((c) => c.claims.C1_determinism === "HELD") ? "HELD" : "FAILED",
    C5_monotone: chunks.every((c) => c.claims.C5_monotone === "HELD") ? "HELD" : "FAILED",
  },
  varianceCollapse: {
    definition: "mean over seeds of the per-replica population sd of total pseudo-regret",
    isolated: +varIso.toFixed(4),
    federated: +varFed.toFixed(4),
    dithered: +varDit.toFixed(4),
    compressionFederatedVsIsolated: +(varIso / varFed).toFixed(3),
    note: "THE FINDING OF RECORD: federation compresses per-replica outcome spread ~3.8x — it eliminates catastrophic individual lock-ins AND lucky individual wins; all replicas share one fate (the swarm's). Mean regret improves mildly (isolated -> federated).",
  },
  meanRegret: {
    isolated: +mean(perSeed.map((p) => p.isolatedMeanRegret)).toFixed(4),
    federated: +mean(perSeed.map((p) => p.federatedMeanRegret)).toFixed(4),
    dithered: +mean(perSeed.map((p) => p.ditheredMeanRegret)).toFixed(4),
  },
};
writeFileSync(path.join(dir, "experiment-v0.1.0-merged.json"), JSON.stringify(merged, null, 2) + "\n");
console.log(JSON.stringify({ claims: merged.claims, varianceCollapse: merged.varianceCollapse, meanRegret: merged.meanRegret }, null, 2));
