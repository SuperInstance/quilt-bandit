# TEST-RECEIPT — quilt-bandit

Receipt three-elements: what was run, what came back, what counts as failure.

## v0.1.1 — signed federation (SG1–SG4)

- **Run**: `node --test test/*.test.mjs` — Node v24.21.0, Linux container. Suite re-run 5× back-to-back: **12/12 pass every time** (8 v0.1.0 tests untouched + 4 new: SG1–SG4). Ed25519 key material is fresh per run (substrate entropy); all signed assertions are relational (verify/reject outcomes, counts, bit-exact equality against an unsigned twin with the same seeds), so re-runs are deterministic — no pinned key bytes.
- **Came back**:
  - **SG1**: two signed agents, 100 steps, one ring merge — every diff in the union verifies (intact AND validly signed under its author did), knowledge = own+sender exactly (100+100), receipt chains verify both sides, and the **fold + regret + cumReward are bit-identical to the unsigned twin run** (same seeds) — signing changed nothing at the value level, as designed.
  - **SG2 (negative control, the forgery outcome of record)**: an imposter with its OWN keypair (not a member) forged an observation diff claiming a member's did as author, with the id recomputed over the forged payload (self-consistent — passes the content-hash/id gate) and signed with the imposter's key (raw node:crypto — signDiff correctly refuses to build this; the honest library's guards do not bind the attacker). On merge into a signed coordinator the forgery was **REJECTED and RECEIPTED: kind `reject-sig`** (reason pinned via receive(): "signature does not verify under the author did's embedded public key"); knowledge after the attack = exactly the sender's honest diffs; the attack run's fold is **bit-identical to the no-attack control run** (zero reject-sigs there); the receipt chain verifies across the rejections. The **documented downgrade asymmetry was confirmed by assertion**: the SAME forged bytes injected the SAME way are ACCEPTED by an unsigned sheet (applied=1) and poison its fold (fake reward folded into arm 3) — unsigned replicas never examine sig; signatures protect the sheets that enforce them.
  - **SG3**: a write passing the agent's own key but a foreign `author` threw TypeError at the substrate gate, the refusal was receipted `reject-sig`, nothing landed; a keyless write threw likewise. (Both sealed; chain verifies.)
  - **SG4**: 3 agents × 150 steps × sync 50, fully signed — regrets, cumReward, and policy tables **bit-identical to the unsigned equivalents** (same agent/bandit seeds); every diff in every agent's knowledge set walks + verifies under a federation member's did; receipt chains verify; canonical fold check passes per agent. Knowledge counts signed == unsigned exactly (protocol pattern identical). Receipted protocol note: with the sequential in-round ring, the final write chunk of the ring's tail needs one more sync round to reach every coordinator — at 150 steps the sink holds the full union (450) and the others one chunk short; identical to the unsigned twin, monotone everywhere — a protocol shape, not a signing effect.
  - Signing cost: negligible at suite scale (12-test suite ≈ 1.5 s wall; SG4's 450 signed diffs + full walk ≈ 0.5 s). No perf regression was measured for the RL loop beyond one Ed25519 sign per observation (write) and one verify per received diff (merge) — the substrate gate's own cost.
- **Counts as failure**: a forgery accepted by a signed sheet, or accepted-but-unreceipted; a reject-sig breaking the receipt chain; ANY signed-vs-unsigned divergence in fold/regret/cumReward; an unsigned diff verifying; the unsigned-acceptance asymmetry flipping (unsigned sheets must NOT examine sigs — backward compat).

## v0.1.0 — base suite (B1–B6, NC-B1, NC-B2)

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

## Negative controls (v0.1.0)

- NC-B1 injects a value-flipped diff under its stale id into a merge source: the substrate must reject it and seal the rejection (the fold never sees forged rewards). v0.1.1 adds SG2: the *self-consistent* cross-key forgery (recomputed id, real signature — wrong key), which the id gate alone cannot catch; only the signature layer stops it.
- NC-B2 re-merges identical knowledge: the fold must neither double-count nor shrink — the append-only unique-cell design makes duplicate-observation folding impossible.

## Perf note of record

The naive per-step `state()` fold over the substrate's topological DAG was measured **quadratic** (27 s per 2000-step isolated episode); the shipped agent folds incrementally (O(new diffs)) and proves equivalence against one canonical `state()` fold at run end, fail-closed. Merge cost is superlinear in knowledge size: the 10-seed ensemble ran ~3.5 min/seed across 4 chunk processes.

---

# TEST-RECEIPT — quilt-bandit v0.2.0 (sparse gossip)

- **Run**: `node --test test/*.test.mjs` — Node v24.21.0. **Came back**: 17 tests, **17 pass / 0 fail** (v0.1.1's 12 + SP1–SP5). Substrate re-vendored to quilt-neighbourhood v0.4.0 (9d6c620, P7); provenance pins updated; full suite stayed green on the new vendor (backward compatibility confirmed).
- **SP1 catch of record**: the sparse agent originally did NOT register `arm:*` numeric — concurrent rate sets resolved by P3 id-tiebreak, caught by SP1's estimator-consistency check (1 vs 0.8333), fixed before any measurement. The suite policed its own lane.
- **Estimator receipt**: sparse = agent-equal pooled rate (mean of per-agent rates under P5); dense = observation-equal pooled rate (mean over every pull). They agree within float-association noise (<= 1e-12, SP1) and are bit-exact on identical rates; they are NOT bit-identical in general (last-bit association) — receipted, not hidden.
- **Probe of record** (10 seeds, `receipts/experiment-v0.2.0.chunk*.json`):
  - P1 SPARSE <= 1.15 x DENSE regret on >= 7/10 seeds: **FAILED — 5/10** (mean ratio 1.167; per-seed ratios [1.000, 1.000, 1.594, 0.772, 1.067, 1.633, 1.156, 1.267, 1.182, 0.997] — sparse is better on 2 seeds, within-band on 3, pays a real regret tax on the rest).
  - P2 SPARSE diffs < 50% of DENSE on >= 9/10 seeds: **HELD — 10/10**. DENSE 51,500 diffs vs SPARSE 2,878 mean (per-agent emits ~487, i.e. skip-ratio ~75% of checkpoint writes) — **17.9x communication reduction**.
  - P3 integrity (chains verify) and P4 determinism (re-run bit-identical): **HELD**.
- **The trade-off of record**: P7 sparse gossip buys an ~18x communication reduction for ~17% mean regret cost at this scale (drift 0.01, 1500 steps, 6 replicas). Both sides sealed verbatim; no threshold surgery. The operating point (epsilon, sync cadence, rate-vs-observation cells) is now a measured dial, not a design guess.
