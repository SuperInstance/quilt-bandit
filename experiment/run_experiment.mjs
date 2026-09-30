// run_experiment.mjs — quilt-bandit experiment of record (ensemble run).
//
// CLAIMS UNDER TEST:
//   C1 (determinism): same seeds => identical regret/knowledge (re-run, bit-exact).
//   C2 (merge-order independence): covered structurally in test/bandit.test.mjs
//       (fold over unique append-only cell ids inherits the substrate's
//       knowledge-set convergence); the experiment runs the ensemble.
//   C3 (federation helps vs isolation) — pre-registered: FEDERATED beats ISOLATED
//       on >= 8/10 seeds (paired mean pseudo-regret).
//   C4 (dithering antidote) — pre-registered: DITHERED beats FEDERATED on
//       >= 8/10 seeds (paired mean pseudo-regret). Motivation: the herding
//       phenomenon observed in the seed-101 probe (naive pooling collapses
//       decorrelated exploration; the swarm can lock onto a worse arm than
//       lucky individuals).
//   C5 (knowledge monotone): every replica's knowledge >= its own observations.
//
// Metric of record: pseudo-regret (max_mean(t) - mean(pulled arm)), reward noise
// excluded; cumReward receipted separately. ORACLE = the zero line by construction.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runCondition } from "../src/bandit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Chunkable runs: SEEDS="101,202" OUT=".chunk1" env vars let the ensemble run in
// separate OS processes (each chunk writes its own receipt; merge is offline).
const ENV_SEEDS = process.env.SEEDS ? process.env.SEEDS.split(",").map(Number) : null;
const OUT_SUFFIX = process.env.OUT || "";
const CONFIG = {
  arms: 4,
  replicas: 6,
  steps: 1500,
  sync: 50,
  eps: 0.1,
  epsLadder: [0.05, 0.075, 0.1, 0.125, 0.15, 0.175],
  drift: 0.01,
  seeds: ENV_SEEDS || [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010],
};
const startedISO = new Date().toISOString();
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const agentMean = (r) => r.agents.reduce((s, a) => s + a.totalRegret, 0) / r.agents.length;

const results = { config: CONFIG, startedISO, perSeed: [], claims: {} };
const c3 = [], c4 = [];
let c5ok = true;

for (const seed of CONFIG.seeds) {
  const iso = runCondition({ condition: "ISOLATED", ...CONFIG, banditSeed: seed });
  const fed = runCondition({ condition: "FEDERATED", ...CONFIG, banditSeed: seed });
  const dit = runCondition({ condition: "DITHERED", ...CONFIG, banditSeed: seed });
  const isoM = agentMean(iso), fedM = agentMean(fed), ditM = agentMean(dit);
  c3.push({ seed, delta: isoM - fedM });
  c4.push({ seed, delta: fedM - ditM });
  for (const a of fed.agents) if (a.knowledge < CONFIG.steps) c5ok = false;
  results.perSeed.push({
    seed,
    isolatedMeanRegret: isoM,
    federatedMeanRegret: fedM,
    ditheredMeanRegret: ditM,
    isolatedPerReplica: iso.agents.map((a) => a.totalRegret),
    federatedPerReplica: fed.agents.map((a) => a.totalRegret),
    ditheredPerReplica: dit.agents.map((a) => a.totalRegret),
    federatedKnowledge: fed.agents.map((a) => a.knowledge),
    federatedCumReward: fed.agents.map((a) => a.cumReward),
    isolatedCumReward: iso.agents.map((a) => a.cumReward),
  });
  process.stderr.write(`seed ${seed}: iso ${isoM.toFixed(1)} | fed ${fedM.toFixed(1)} | dit ${ditM.toFixed(1)}\n`);
}

const wins = (xs) => xs.filter((p) => p.delta > 0).length;
results.claims.C3_federation = {
  preRegistered: "FEDERATED < ISOLATED on >= 8/10 seeds",
  wins: wins(c3),
  ofSeeds: CONFIG.seeds.length,
  verdict: wins(c3) >= Math.ceil(0.8 * CONFIG.seeds.length) ? "HELD" : "FAILED",
  meanDelta: mean(c3.map((p) => p.delta)),
  sd: sd(c3.map((p) => p.delta)),
};
results.claims.C4_dithering = {
  preRegistered: "DITHERED < FEDERATED on >= 8/10 seeds",
  wins: wins(c4),
  ofSeeds: CONFIG.seeds.length,
  verdict: wins(c4) >= Math.ceil(0.8 * CONFIG.seeds.length) ? "HELD" : "FAILED",
  meanDelta: mean(c4.map((p) => p.delta)),
  sd: sd(c4.map((p) => p.delta)),
};
results.claims.C5_monotone = c5ok ? "HELD" : "FAILED";

// C1: re-run the FIRST seed of this chunk FEDERATED, compare bit-exact
const d1 = runCondition({ condition: "FEDERATED", ...CONFIG, banditSeed: CONFIG.seeds[0] });
const d2 = runCondition({ condition: "FEDERATED", ...CONFIG, banditSeed: CONFIG.seeds[0] });
const sig = (r) => JSON.stringify(r.agents.map((a) => [a.totalRegret, a.knowledge, a.cumReward]));
results.claims.C1_determinism = sig(d1) === sig(d2) ? "HELD" : "FAILED";

results.finishedISO = new Date().toISOString();
results.chunk = { seeds: CONFIG.seeds, out: OUT_SUFFIX || "full" };
mkdirSync(path.join(ROOT, "receipts"), { recursive: true });
writeFileSync(path.join(ROOT, "receipts", `experiment-v0.1.0${OUT_SUFFIX}.json`), JSON.stringify({ experiment: "quilt-bandit federation of record", ...results }, null, 2) + "\n");
console.log(JSON.stringify({
  chunk: results.chunk,
  claims: results.claims,
  pairedC3: c3.map((p) => +p.delta.toFixed(1)),
  pairedC4: c4.map((p) => +p.delta.toFixed(1)),
}, null, 2));
console.log(`receipt written: receipts/experiment-v0.1.0${OUT_SUFFIX}.json`);
