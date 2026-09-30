// bandit.mjs — the drifting-bandit environment and the quilt-federated agent.
//
// DESIGN OF RECORD (why observation cells, not Q-value cells):
//   Each replica commits EVERY reward observation as its own append-only cell
//   ("arm:<k>:obs:<replica>:<n>", unique id => never a concurrent set). The arm
//   value is computed at READ time by folding the merged knowledge set (mean of
//   that arm's observation values). Merge-order independence is then INHERITED
//   from the substrate's knowledge-set convergence (T1) — the fold is
//   commutative+associative+idempotent over unique cell ids — instead of being
//   manufactured by a numeric merge policy (P5). P5 on concurrent Q-value cells
//   is the alternative design point; it is receipted as future work, not used
//   here. Sum/count fold carries provenance per observation and needs no
//   coordination: a replica that never syncs simply has a partial view.
import { Replica, merge } from "../vendor/replica.mjs";

// ---------- deterministic PRNG (mulberry32) ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- drifting-bandit environment ----------
// Means follow a bounded random walk: mu_k(t+1) = clip(mu_k(t) + N(0, DRIFT), LO, HI).
export class DriftingBandit {
  constructor({ arms = 4, drift = 0.01, lo = 0.2, hi = 0.8, seed = 1 }) {
    this.arms = arms;
    this.drift = drift;
    this.lo = lo;
    this.hi = hi;
    this.rnd = mulberry32(seed);
    this.means = Array.from({ length: arms }, () => this.lo + this.rnd() * (this.hi - this.lo));
    this.t = 0;
  }
  step() {
    for (let k = 0; k < this.arms; k++) {
      const g = (this.rnd() + this.rnd() + this.rnd() - 1.5) * 2 * this.drift; // approx N(0, drift)
      this.means[k] = Math.min(this.hi, Math.max(this.lo, this.means[k] + g));
    }
    this.t++;
  }
  pull(k) {
    // Bernoulli reward with the CURRENT mean; caller must step() per round
    const r = this.rnd() < this.means[k] ? 1 : 0;
    return { reward: r, trueMean: this.means[k] };
  }
}

// ---------- the quilt-federated agent ----------
// One Replica per agent. Every observation is an append-only cell. Policy =
// eps-greedy on the fold of the agent's CURRENT knowledge (own + merged).
//
// PERF NOTE OF RECORD: the policy fold is maintained INCREMENTALLY over the
// replica's diff set (observation cells are append-only and unique, so the
// fold is sum/count per arm — O(new diffs) amortized). Calling the substrate's
// full topological state() fold per STEP was measured quadratic (27s per
// 2000-step episode) and is used here ONLY as the end-of-run canonical
// verification: verifyPolicyAgainstState() must reproduce the incremental
// table bit-exactly or the run fails closed.
export class QuiltBanditAgent {
  constructor({ name, arms, seed, sheet = "bandit", eps = 0.1, schema }) {
    this.name = name;
    this.arms = arms;
    this.eps = eps;
    this.rnd = mulberry32(seed);
    this.rep = new Replica(name, sheet, schema);
    this.n = 0; // observation counter (per replica)
    this.regret = 0;
    this.cumReward = 0;
    this._armSum = Array(arms).fill(0);
    this._armCnt = Array(arms).fill(0);
    this._seen = new Set(); // diff ids already folded
  }
  _armOf(cell) {
    const m = /^arm:(\d+):obs:/.exec(cell);
    return m ? Number(m[1]) : null;
  }
  // incremental fold over any diffs not yet folded (own sets + merged-in)
  _foldNew() {
    for (const [id, d] of this.rep.diffs) {
      if (this._seen.has(id) || d.op !== "set") continue;
      const k = this._armOf(d.cell);
      if (k === null) continue;
      this._armSum[k] += d.value;
      this._armCnt[k] += 1;
      this._seen.add(id);
    }
  }
  // canonical verification: full substrate state() fold must equal the incremental table
  verifyPolicyAgainstState() {
    this._foldNew(); // fold trailing diffs written after the last choose() (lag-1 catch)
    const state = this.rep.state();
    const sum = Array(this.arms).fill(0);
    const cnt = Array(this.arms).fill(0);
    for (const [cell, v] of Object.entries(state)) {
      const k = this._armOf(cell);
      if (k === null) continue;
      sum[k] += v;
      cnt[k] += 1;
    }
    for (let k = 0; k < this.arms; k++) {
      if (sum[k] !== this._armSum[k] || cnt[k] !== this._armCnt[k]) return false;
    }
    return true;
  }
  policyTable() {
    this._foldNew();
    return {
      sum: [...this._armSum],
      cnt: [...this._armCnt],
      value: this._armCnt.map((c, k) => (c === 0 ? 0.5 : this._armSum[k] / c)),
    };
  }
  choose() {
    if (this.rnd() < this.eps) return Math.floor(this.rnd() * this.arms);
    const { value, cnt } = this.policyTable();
    // unseen arms first (optimistic), then argmax with deterministic tie-break (lowest index)
    for (let k = 0; k < this.arms; k++) if (cnt[k] === 0) return k;
    let best = -1;
    for (let k = 0; k < this.arms; k++) if (best === -1 || value[k] > value[best]) best = k;
    return best;
  }
  observe(k, reward, ts) {
    const cell = `arm:${k}:obs:${this.name}:${this.n}`;
    this.n++;
    this.rep.set(cell, reward, { author: this.name, ts });
  }
  play(bandit, ts) {
    const k = this.choose();
    const { reward, trueMean } = bandit.pull(k);
    this.observe(k, reward, ts);
    // PSEUDO-REGRET (metric of record, documented): max_mean(t) - mean(pulled arm).
    // Reward noise is excluded (it is measured separately as cumReward); this is
    // the standard "loss from not always pulling the best arm". The bandit's own
    // RNG stream is untouched by this read.
    const bestMean = Math.max(...bandit.means);
    this.regret += bestMean - trueMean;
    this.cumReward += reward;
    return { k, reward, trueMean };
  }
  syncFrom(other) {
    merge(other.rep, this.rep);
    this._foldNew();
  }
}

// ---------- the experimental conditions ----------
// ISOLATED: replicas never merge (baseline). FEDERATED: gossip-ring merge every
// SYNC steps, naive pooling (all agents eps=EPS). DITHERED: same ring merge but
// each agent explores with its OWN eps from a ladder — exploration stays
// decorrelated under pooling (the herding antidote under test). ORACLE: the
// pseudo-regret zero line (by construction), receipted as a note.
export function runCondition({ condition, replicas, banditSeed, steps, sync, eps, arms }) {
  const bandit = new DriftingBandit({ arms, seed: banditSeed });
  const EPS_LADDER = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75].map((m) => eps * m);
  const agents = Array.from({ length: replicas }, (_, i) => new QuiltBanditAgent({
    name: `r${i + 1}`, arms, seed: banditSeed * 100 + i + 1,
    eps: condition === "DITHERED" ? EPS_LADDER[i % EPS_LADDER.length] : eps,
  }));
  const history = [];
  for (let t = 0; t < steps; t++) {
    bandit.step();
    const best = Math.max(...bandit.means);
    for (const a of agents) a.play(bandit, t);
    if (condition !== "ISOLATED" && sync > 0 && (t + 1) % sync === 0) {
      // GOSSIP-RING sync (protocol of record): agent i merges from agent (i+1)%K
      // only — K merges per sync instead of K^2-K; knowledge propagates to every
      // replica within K-1 syncs (ring diameter), i.e. <= 300 steps here. The
      // merge-order independence of the RESULT is separately tested, not assumed.
      for (let i = 0; i < agents.length; i++) {
        agents[i].syncFrom(agents[(i + 1) % agents.length]);
      }
    }
    history.push({ t: t + 1, best, means: [...bandit.means], regret: agents.map((a) => a.regret) });
  }
  // ORACLE yardstick: under the pseudo-regret metric, greedy-on-truth has
  // regret 0 BY CONSTRUCTION (it always pulls the argmax arm) — so the
  // oracle is the zero line of the metric, not a simulated competitor.
  // (Reward-level comparison lives in cumReward per agent, receipted.)
  const oracleRegret = 0;
  return {
    condition,
    agents: agents.map((a) => {
      const foldVerified = a.verifyPolicyAgainstState(); // canonical fold == incremental, fail-closed
      if (!foldVerified) throw new Error(`agent ${a.name}: incremental fold != canonical state() fold`);
      return {
        name: a.name,
        totalRegret: a.regret,
        cumReward: a.cumReward,
        observations: a.n,
        knowledge: a.rep.diffCount(),
        finalPolicy: a.policyTable().value,
        receiptsOk: a.rep.verifyReceipts(),
      };
    }),
    oracleRegret,
    history,
  };
}
