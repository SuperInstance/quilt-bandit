// run_sparse_experiment.mjs — v0.2.0 sparse-gossip probe of record.
//
// PRE-REGISTERED CLAIMS (before execution, in-script):
//   P1: SPARSE regret <= 1.15 x DENSE regret on >= 7/10 seeds (paired mean pseudo-regret).
//   P2: SPARSE emits < 50% of DENSE's diff count on >= 9/10 seeds.
//   P3: sparse determinism (re-run bit-identical) + receipts verify (per chunk).
//
// Config mirrors the v0.1.0 ensemble: 4 arms, 6 replicas, 1500 steps, ring sync
// every 50, eps 0.1, drift 0.01. SPARSE epsilon = 0.02 (rate cells).
// Chunkable: SEEDS="a,b,c" OUT=".chunkN".
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runCondition } from "../src/bandit.mjs";
import { runSparseCondition } from "../src/sparse_bandit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_SEEDS = process.env.SEEDS ? process.env.SEEDS.split(",").map(Number) : null;
const OUT_SUFFIX = process.env.OUT || "";
const CONFIG = {
  arms: 4, replicas: 6, steps: 1500, sync: 50, eps: 0.1, drift: 0.01, epsilon: 0.02,
  seeds: ENV_SEEDS || [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010],
};
const startedISO = new Date().toISOString();
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

const perSeed = [];
let p2wins = 0;
let receiptsOkAll = true;
for (const seed of CONFIG.seeds) {
  const dense = runCondition({ condition: "FEDERATED", ...CONFIG, banditSeed: seed });
  const sparse = runSparseCondition({ ...CONFIG, banditSeed: seed });
  const denseM = dense.agents.reduce((s, a) => s + a.totalRegret, 0) / dense.agents.length;
  const sparseM = sparse.agents.reduce((s, a) => s + a.totalRegret, 0) / sparse.agents.length;
  const denseDiffs = dense.agents.reduce((s, a) => s + a.knowledge, 0);
  const sparseDiffs = sparse.agents.reduce((s, a) => s + a.knowledge, 0);
  const sparseEmits = sparse.agents.reduce((s, a) => s + a.comm.emits, 0);
  receiptsOkAll = receiptsOkAll && sparse.agents.every((a) => a.receiptsOk);
  if (sparseDiffs < 0.5 * denseDiffs) p2wins++;
  perSeed.push({
    seed, denseMeanRegret: denseM, sparseMeanRegret: sparseM,
    ratio: sparseM / denseM,
    p1win: sparseM <= 1.15 * denseM,
    denseDiffs, sparseDiffs, sparseEmits,
    sparsePerReplica: sparse.agents.map((a) => a.totalRegret),
    sparseComm: sparse.agents.map((a) => a.comm),
  });
  process.stderr.write(`seed ${seed}: dense ${denseM.toFixed(1)} | sparse ${sparseM.toFixed(1)} (ratio ${(sparseM / denseM).toFixed(3)}) | diffs dense ${denseDiffs} sparse ${sparseDiffs} (emits ${sparseEmits})\n`);
}

const p1wins = perSeed.filter((p) => p.p1win).length;
const n = perSeed.length;
const claims = {
  P1_sparseRegret: {
    preRegistered: "SPARSE regret <= 1.15 x DENSE on >= 7/10 seeds",
    wins: p1wins, of: n,
    verdict: p1wins >= Math.ceil(0.7 * n) ? "HELD" : "FAILED",
    meanRatio: mean(perSeed.map((p) => p.ratio)),
  },
  P2_communication: {
    preRegistered: "SPARSE diffs < 50% of DENSE on >= 9/10 seeds",
    wins: p2wins, of: n,
    verdict: p2wins >= Math.ceil(0.9 * n) ? "HELD" : "FAILED",
    meanDense: mean(perSeed.map((p) => p.denseDiffs)),
    meanSparse: mean(perSeed.map((p) => p.sparseDiffs)),
    meanSparseEmits: mean(perSeed.map((p) => p.sparseEmits)),
  },
  P3_integrity: receiptsOkAll ? "HELD" : "FAILED",
};

// determinism re-run on this chunk's first seed
const s0 = runSparseCondition({ ...CONFIG, banditSeed: CONFIG.seeds[0] });
const s1 = runSparseCondition({ ...CONFIG, banditSeed: CONFIG.seeds[0] });
const sig = (r) => JSON.stringify(r.agents.map((a) => [a.totalRegret, a.comm, a.knowledge]));
claims.P4_determinism = sig(s0) === sig(s1) ? "HELD" : "FAILED";

const receipt = { experiment: "quilt-bandit v0.2.0 sparse gossip probe", config: CONFIG, startedISO, finishedISO: new Date().toISOString(), chunk: { seeds: CONFIG.seeds, out: OUT_SUFFIX || "full" }, claims, perSeed };
mkdirSync(path.join(ROOT, "receipts"), { recursive: true });
writeFileSync(path.join(ROOT, "receipts", `experiment-v0.2.0${OUT_SUFFIX}.json`), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ claims, perSeedRatios: perSeed.map((p) => +p.ratio.toFixed(3)), perSeedSparseDense: perSeed.map((p) => +((p.sparseDiffs / p.denseDiffs) || 0).toFixed(4)) }, null, 2));
console.log(`receipt written: receipts/experiment-v0.2.0${OUT_SUFFIX}.json`);
