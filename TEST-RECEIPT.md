# TEST-RECEIPT — quilt-bandit v0.1.0

Receipt three-elements: what was run, what came back, what counts as failure.

- **Run**: `node --test test/*.test.mjs` — Node v24.21.0, Linux container.
- **Came back**: 8 tests, **8 pass / 0 fail / 0 skipped** (B1–B6 + NC-B1 + NC-B2).
- **Counts as failure**: any nondeterminism across identical re-runs (B1); any merge-order dependence of the union policy or revision (B2); knowledge loss or receipt-chain break on sync (B3); a chain lie after heavy syncs (B4); nonzero pseudo-regret for greedy-on-truth (B5); irreproducible PRNG (B6); a forged observation accepted, or its rejection unreceipted (NC-B1); a fold that shrinks or double-counts on re-merge (NC-B2).

## Experiment of record (10-seed pre-registered ensemble)

- **Run**: `SEEDS="…" OUT=".chunkN" node experiment/run_experiment.mjs` in 4 chunks (101–303, 404–606, 707–808, 909–1010), merged by `node experiment/merge_receipts.mjs` → `receipts/experiment-v0.1.0-merged.json`. Config: 4 arms, 6 replicas, 1500 steps, gossip-ring sync every 50, drift 0.01, ε 0.1 (ladder 0.05–0.175 for DITHERED).
- **Came back**:
  - C3 FEDERATION: **FAILED the pre-registered ≥8/10 bar — 6/10 seeds**; mean Δ +3.79 regret in federation's favor; per-seed deltas `[+0.8, −0.1, +2.8, −34.5, +3.4, +47.4, −1.7, +22.0, −5.5, +3.2]` — bimodal: near-zero on 8 seeds, one swarm-saved (+47.4), one swarm-herded (−34.5).
  - C4 DITHERING: **FAILED — 2/10**; a small tax on 8/10 seeds (−0.3…−5.9), saves the swarm on seed 404 (+20.4), costs it on seed 606 (−22.9).
  - C1 DETERMINISM: **HELD** (every chunk's FEDERATED re-run bit-identical on regret, knowledge, cumReward).
  - C5 MONOTONE: **HELD** (every replica's knowledge ≥ own observations everywhere).
  - **VARIANCE COLLAPSE (finding of record)**: mean per-seed per-replica sd of total pseudo-regret — isolated **22.36**, federated **5.92** (**3.78× compression**), dithered 10.08 (partial). Mean regret: isolated 105.73, federated 101.94, dithered 103.29.
- **Counts as failure**: any HELD→FAILED flip without rerunning; any threshold change post hoc (none — the bars were in the runner before execution); a merged receipt disagreeing with its chunk raws.

## Negative controls

- NC-B1 injects a value-flipped diff under its stale id into a merge source: the substrate must reject it and seal the rejection (the fold never sees forged rewards).
- NC-B2 re-merges identical knowledge: the fold must neither double-count nor shrink — the append-only unique-cell design makes duplicate-observation folding impossible.

## Perf note of record

The naive per-step `state()` fold over the substrate's topological DAG was measured **quadratic** (27 s per 2000-step isolated episode); the shipped agent folds incrementally (O(new diffs)) and proves equivalence against one canonical `state()` fold at run end, fail-closed. Merge cost is superlinear in knowledge size: the 10-seed ensemble ran ~3.5 min/seed across 4 chunk processes.
