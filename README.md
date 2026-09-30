# quilt-bandit

**RL in quilts.** A federation of bandit agents whose reward observations live as append-only cells in a quilt diff-DAG (the [quilt-neighbourhood](https://github.com/SuperInstance/quilt-neighbourhood) substrate, vendored and pinned). Replicas explore a drifting 4-arm bandit independently, periodically merge their knowledge via **gossip-ring** sync, and compute their policy by **read-time folding** of the merged knowledge set — no parameter server, no coordinator, every observation provenance-carrying and tamper-evident.

## Design of record

- **Observation cells, not Q-value cells.** Every reward is its own cell (`arm:<k>:obs:<replica>:<n>`, unique id → never a concurrent set). Merge-order independence is *inherited* from the substrate's knowledge-set convergence; the arm value is a fold over the knowledge set (mean per arm) — commutative, associative, idempotent. The alternative (P5 numeric merge over concurrent Q-value cells) is the next design point, not used here.
- **Gossip-ring sync.** At each sync, agent *i* merges from agent *(i+1)%K* — K merges per sync instead of K²−K; knowledge propagates to everyone within K−1 syncs (ring diameter).
- **Incremental fold with canonical verification.** The policy fold is maintained incrementally (O(new diffs)) and *must* reproduce the substrate's full topological state() fold bit-exactly at run end — fail-closed if not. (The naive per-step state() fold was measured quadratic and receipted.)
- **Pseudo-regret is the metric of record**: `max_mean(t) − mean(pulled arm)` — reward noise excluded (cumReward receipted separately). The oracle is the zero line by construction.

## The herding finding, then the ensemble verdict

A probe run (seed 101, 2000 steps) surfaced the experiment's reason to exist: **naive observation-pooling federates the DATA but de-correlates nothing — it herds the agents.** Under pooled ε-greedy all agents share one argmax, so they all exploit (and explore) the same arm simultaneously; exploration becomes K× redundant, and on that seed the swarm locked onto a worse arm than the best individual found alone (FEDERATED ≈ 253 vs ISOLATED best-replica ≈ 130). The **DITHERED** condition (per-agent ε-ladder 0.05–0.175) was built as the herding antidote.

The 10-seed pre-registered ensemble (3 conditions × 1500 steps, gossip-ring sync every 50) then settled it honestly — **both headline claims FAILED their bars, and the real effect was one neither predicted**:

| pre-registered claim | verdict of record |
|---|---|
| C3: FEDERATED < ISOLATED on ≥ 8/10 seeds | **FAILED — 6/10** (mean Δ +3.79 in federation's favor, but bimodal: ±≤5.5 on 8 seeds, one **+47.4** the swarm is saved, one **−34.5** it is herded onto a worse arm) |
| C4: DITHERED < FEDERATED on ≥ 8/10 seeds | **FAILED — 2/10** (the ladder is a small tax on 8/10 seeds; saves the swarm once, costs it once) |
| C1: bit-exact determinism | **HELD** (all chunks) |
| C5: knowledge monotone | **HELD** (all chunks) |

**The finding of record — variance collapse.** Federation's real, consistent effect is *homogenization*: the mean per-seed spread of per-replica outcomes is **22.36 isolated vs 5.92 federated (3.78× compression)**, with dithering in between (10.08, partial decorrelation). Shared knowledge makes replicas share one fate: catastrophic individual lock-ins disappear, and so do lucky individual wins. Mean regret improves mildly (105.73 → 101.94 isolated → federated). "Pooling helps" is the wrong summary; "pooling collapses the outcome distribution onto the swarm's consensus" is the receipted one.

## Experiment of record

`node experiment/run_experiment.mjs` (chunkable via `SEEDS="…" OUT="…"`) — receipts: `receipts/experiment-v0.1.0-merged.json` (ensemble of record) + per-chunk raws; claims sealed verbatim — HELD or FAILED, no threshold surgery. Suite: `node --test test/*.test.mjs`.

## What counts as failure (suite)

`node --test test/*.test.mjs`:

| # | claim | failure means |
|---|-------|---------------|
| B1 | same seeds → bit-identical regret/reward/knowledge | any nondeterminism |
| B2 | union policy is merge-order invariant, bit-exact | order-dependent fold or revision |
| B3 | syncFrom monotone: sender unchanged, receiver grows, chains verify | knowledge loss or chain break |
| B4 | receipt chains verify after heavy syncs | any chain lie |
| B5 | greedy-on-truth accumulates exactly 0 pseudo-regret | metric misimplementation |
| B6 | seeded PRNG stream-stable | irreproducible randomness |
| NC-B1 | tampered observation rejected on merge + rejection receipted | forgery accepted or silent |
| NC-B2 | re-merging old knowledge never shrinks or double-counts the fold | duplicate/shrinking fold |

## Honest limitations (v0.1.0)

- Scale: 4 arms, 6 replicas, 1500 steps, synthetic drift — the claims are about the *substrate semantics and the federation protocol*, not bandit theory at scale.
- The ε-ladder is one antidote, hand-picked; UCB-style optimism, Thompson sampling, and per-agent optimism bonuses are untested here.
- Observation cells grow unboundedly (one per pull); compaction/summary cells are future work.
- The substrate's merge cost is superlinear in knowledge size (receipted in the perf note); gossip-ring frequency trades freshness against cost.
- Vendored substrate (pinned in [vendor/PROVENANCE.md](vendor/PROVENANCE.md)) — upgrade = re-pin; a silent drift voids this receipt.

## Receipt

[TEST-RECEIPT.md](TEST-RECEIPT.md) — run-verified numbers behind this version.
