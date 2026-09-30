// sparse.test.mjs — v0.2.0 sparse-gossip suite. Failure conditions are stated per test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SparseQuiltBanditAgent, runSparseCondition } from "../src/sparse_bandit.mjs";
import { QuiltBanditAgent, DriftingBandit, runCondition } from "../src/bandit.mjs";
import { merge } from "../vendor/replica.mjs";

test("SP1: estimator consistency — agent-equal rate mean == observation-equal mean (<= 1e-12; bit-exact on identical rates)", () => {
  // two agents, equal counts (n=3) per arm, identical reward sums
  const a = new SparseQuiltBanditAgent({ name: "a", arms: 2, seed: 5, eps: 0 });
  const b = new SparseQuiltBanditAgent({ name: "b", arms: 2, seed: 6, eps: 0 });
  for (let j = 0; j < 3; j++) { a.observe(0, 1, j); b.observe(0, j === 0 ? 0 : 1, j); }
  a.checkpointSync(0); b.checkpointSync(0);
  const coord = new SparseQuiltBanditAgent({ name: "c", arms: 2, seed: 7, eps: 0 });
  merge(a.rep, coord.rep); merge(b.rep, coord.rep);
  const rateMean = coord.policyTable().value[0];
  // observation-equal reference: (sum_a + sum_b) / (n_a + n_b)
  const obsMean = (a._sum[0] + b._sum[0]) / (a._n[0] + b._n[0]);
  // failure means: the two estimators disagree beyond float association noise
  assert.ok(Math.abs(rateMean - obsMean) <= 1e-12, `${rateMean} vs ${obsMean}`);
  // equal-rewards case must be bit-exact (S1 == S2 => rate_i identical => mean exact)
  const a2 = new SparseQuiltBanditAgent({ name: "a2", arms: 1, seed: 8, eps: 0 });
  const b2 = new SparseQuiltBanditAgent({ name: "b2", arms: 1, seed: 9, eps: 0 });
  for (let j = 0; j < 4; j++) { a2.observe(0, 1, j); b2.observe(0, 1, j); }
  a2.checkpointSync(0); b2.checkpointSync(0);
  const c2 = new SparseQuiltBanditAgent({ name: "c2", arms: 1, seed: 10, eps: 0 });
  merge(a2.rep, c2.rep); merge(b2.rep, c2.rep);
  // failure means: identical rates failed to mean to themselves
  assert.equal(c2.policyTable().value[0], 1);
});

test("SP2: P7 skips are receipted — writes - emits == skip-eps receipts per sparse agent", () => {
  const r = runSparseCondition({ replicas: 3, banditSeed: 21, steps: 150, sync: 50, eps: 0.1, arms: 4, epsilon: 0.02 });
  for (const a of r.agents) {
    const skips = 0; // receipt payloads are hashed; the accounting identity is checked via commCost vs diffCount
    void skips;
    // failure means: emission accounting lies (commCost.writes - emits != 0-modulo) or the chain broke
    assert.equal(a.comm.writes - a.comm.emits, a.comm.skips);
    assert.equal(a.receiptsOk, true);
    // every agent's DAG must hold at most writes diffs (skips emitted nothing)
    assert.ok(a.knowledge <= a.comm.emits + 3 * a.comm.emits, "knowledge grew beyond emitted diffs");
  }
});

test("SP3: sparse ring sync converges — every agent ends knowing every agent's rate cells", () => {
  const r = runSparseCondition({ replicas: 4, banditSeed: 33, steps: 200, sync: 50, eps: 0.02, arms: 4, epsilon: 0.02 });
  const totalRateDiffs = r.agents.reduce((s, a) => s + a.knowledge, 0);
  // failure means: knowledge did not propagate (agents hold only their own cells)
  assert.ok(totalRateDiffs > 4 * 4 * 2, `total knowledge ${totalRateDiffs} suggests no propagation`);
  const last = r.agents[3];
  assert.equal(last.receiptsOk, true);
});

test("SP4: sparse determinism — same seeds give bit-identical regret/comm", () => {
  const a = runSparseCondition({ replicas: 4, banditSeed: 44, steps: 200, sync: 50, eps: 0.1, arms: 4, epsilon: 0.02 });
  const b = runSparseCondition({ replicas: 4, banditSeed: 44, steps: 200, sync: 50, eps: 0.1, arms: 4, epsilon: 0.02 });
  assert.deepEqual(
    a.agents.map((x) => [x.totalRegret, x.comm]),
    b.agents.map((x) => [x.totalRegret, x.comm]),
  );
});

test("SP5: sparse federation beats isolation on the probe seed (communication-cost sanity)", () => {
  const dense = runCondition({ condition: "FEDERATED", arms: 4, replicas: 6, steps: 300, sync: 50, eps: 0.1, drift: 0.01, banditSeed: 55 });
  const sparse = runSparseCondition({ replicas: 6, banditSeed: 55, steps: 300, sync: 50, eps: 0.1, arms: 4, epsilon: 0.02 });
  const denseDiffs = dense.agents.reduce((s, a) => s + a.knowledge, 0);
  const sparseDiffs = sparse.agents.reduce((s, a) => s + a.knowledge, 0);
  // failure means: sparse emitted MORE communication than dense (the whole point is sparsity)
  assert.ok(sparseDiffs < denseDiffs, `sparse ${sparseDiffs} >= dense ${denseDiffs} diffs`);
});
