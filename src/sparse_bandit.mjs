// sparse_bandit.mjs — v0.2.0 sparse gossip: P7-based checkpoint emission.
//
// CELL MODEL CHANGE (design receipt): v0.1.0 federated agents committed one
// append-only observation cell per pull ("arm:k:obs:replica:n") and folded at
// read time — communication O(1) per step. SPARSE agents keep per-arm RATE
// cells ("arm:k:rate", numeric, value = that agent's mean reward on the arm)
// written at SYNC TIME under the P7 epsilon-diff policy: a rate within epsilon
// of the agent's current DAG value emits no diff (receipted skip-eps). Merged
// policy for arm k = the state() value of "arm:k:rate", which under P5
// concurrent-set semantics is the canonical mean of the agents' rates.
//
// ESTIMATOR RECEIPT: the sparse estimator is the AGENT-EQUAL pooled rate
// (each replica's experience counts once); the dense estimator is the
// OBSERVATION-EQUAL pooled rate (every pull counts once). They coincide when
// per-agent per-arm observation counts are equal (SP1 pins bit-exact equality
// in that case); with unequal counts they are two legitimate estimators — the
// experiment compares each federation against ISOLATED, never estimator-vs-
// estimator as a confound.
import { QuiltBanditAgent, DriftingBandit } from "./bandit.mjs";
import { merge } from "../vendor/replica.mjs";

export class SparseQuiltBanditAgent extends QuiltBanditAgent {
  constructor(opts) {
    // THE NUMERIC SCHEMA IS LOAD-BEARING: rate cells must be registered numeric
    // or concurrent sets resolve by P3 id-tiebreak instead of the P5 mean
    // (caught by SP1 — the fleet's own suite policing working as designed).
    const schema = { ...(opts.schema ?? {}), numeric: opts.schema?.numeric ?? ["arm:*"] };
    super({ ...opts, schema });
    // local per-arm running sums/counts (the replica holds only rate cells)
    this._sum = Array(this.arms).fill(0);
    this._n = Array(this.arms).fill(0);
    this._emits = 0;
    this._writes = 0;
  }
  // override: keep observations OUT of the DAG; local accumulators only
  observe(k, reward, ts) {
    this._sum[k] += reward;
    this._n[k] += 1;
  }
  // at sync time: write per-arm rate cells under P7; unseen arms write nothing
  checkpointSync(epsilon) {
    for (let k = 0; k < this.arms; k++) {
      if (this._n[k] === 0) continue;
      this._writes++;
      const rate = this._sum[k] / this._n[k];
      const d = this.rep.set(`arm:${k}:rate`, rate, { author: this.name, ts: tsFor(this, k), epsilon });
      if (d !== null) this._emits++;
    }
    this._stateCache = null;
  }
  _state() {
    // PERF OF RECORD: the DAG only changes at checkpointSync/syncFrom, so the
    // topological state() fold is cached between syncs (per-step state() over a
    // growing DAG was measured quadratic in the v0.1.0 lane — never again).
    if (!this._stateCache) this._stateCache = this.rep.state();
    return this._stateCache;
  }
  policyTable() {
    const state = this._state();
    const value = [];
    for (let k = 0; k < this.arms; k++) {
      const own = this._n[k] === 0 ? null : this._sum[k] / this._n[k];
      const cellVal = state[`arm:${k}:rate`];
      // merged knowledge wins when present; own rate is the fallback (unseen-by-swarm)
      value[k] = cellVal !== undefined ? cellVal : (own ?? 0.5);
    }
    return { sum: this._sum, cnt: this._n, value };
  }
  choose() {
    if (this.rnd() < this.eps) return Math.floor(this.rnd() * this.arms);
    const { value, cnt } = this.policyTable();
    for (let k = 0; k < this.arms; k++) if (cnt[k] === 0 && this._swarmSeen(k) === false) return k;
    let best = -1;
    for (let k = 0; k < this.arms; k++) if (best === -1 || value[k] > value[best]) best = k;
    return best;
  }
  _swarmSeen(k) { return this._state()[`arm:${k}:rate`] !== undefined; }
  syncFrom(other) {
    merge(other.rep, this.rep);
    this._stateCache = null;
  }
  commCost() { return { writes: this._writes, emits: this._emits, skips: this._writes - this._emits }; }
}

function tsFor(agent, k) {
  // deterministic per (agent, arm) timestamp so diff ids are reproducible
  return 5000 + agent._n[k] * 10 + k;
}

// Sparse federated episode: mirrors runCondition's shape for comparability.
export function runSparseCondition({ replicas, banditSeed, steps, sync, eps, arms, epsilon }) {
  const bandit = new DriftingBandit({ arms, seed: banditSeed });
  const agents = Array.from({ length: replicas }, (_, i) => new SparseQuiltBanditAgent({
    name: `r${i + 1}`, arms, seed: banditSeed * 100 + i + 1, eps,
  }));
  for (let t = 0; t < steps; t++) {
    bandit.step();
    for (const a of agents) a.play(bandit, t);
    if (sync > 0 && (t + 1) % sync === 0) {
      for (const a of agents) a.checkpointSync(epsilon);
      for (let i = 0; i < agents.length; i++) agents[i].syncFrom(agents[(i + 1) % agents.length]);
    }
  }
  return {
    condition: "SPARSE-FEDERATED",
    agents: agents.map((a) => ({
      name: a.name,
      totalRegret: a.regret,
      cumReward: a.cumReward,
      knowledge: a.rep.diffCount(),
      comm: a.commCost(),
      receiptsOk: a.rep.verifyReceipts(),
      finalPolicy: a.policyTable().value,
    })),
    oracleRegret: 0,
    history: [],
  };
}
