# SIBLING-STUDY-67i — scout-and-study of four sibling repos (wave-67, lane i)

Author: study lane 67-i (research-only). Date of record: 2026-09-30 (overnight marathon, wave-67).
Method: shallow clones (depth 15) of `SuperInstance/{voxelglyph, murmuration, quilt-gpu-lab, quilt-tools}`
into `/home/z/my-project/study/`, README + key sources + last ~10 commit messages read per repo;
token used transiently for clone/fetch/push only, never echoed or stored (scrub verified after push).
Upstream heads at time of study (all verified via local `git rev-parse HEAD`):

| repo | HEAD | pushed (mission brief) |
|---|---|---|
| voxelglyph | `f1bcfd6` (f1bcfd62b0a8ce76ba6b005b4a8125dce03474aa) | created today ~17:17Z |
| murmuration | `05d114d` (05d114d893ee1def3b8323582de95bf02262065c) | pushed 17:45Z |
| quilt-gpu-lab | `e700da4` (e700da444952d004249ad252561bb8dbec2b2ee2) | hottest lane all day |
| quilt-tools | `af2b451` (af2b451cff52969a75b8c41f2905acc58a935614) | PR #28 merge (convergence-gauge) |

Reading discipline: everything below marked **(speculation)** is inference, not a quote from the
repos. Where a repo already receipts its own limitation, I say so rather than rediscovering it.

---

## 1. SuperInstance/voxelglyph (`f1bcfd6`, 13 commits, 7 files — tiny and sharp)

### (a) Problem it solves
What can a voxel agent actually *read* through `SuperInstance/Syzygy`'s text encoding? Syzygy's
whole observation stack is a function of one number — `syz_luma8 = (77·R + 150·G + 29·B) >> 8`
(BT.601, weights sum 256) — then Braille threshold → Sobel → STE tone → FFT (`FINDINGS.md`
"The seam"). Because that first line is a **rank-one linear map R³→R**, any two materials with
equal luma are indistinguishable *by construction*. `exp1_luma_collision.py` enumerates the RGB
cube (step 5, ~140k triples), buckets by luma, and finds the widest blind spot: luma 140 holds
`(0,240,0)` and `(255,60,255)`, Euclidean distance **403** apart — one colour to Syzygy. For an
8-material task drawn from that class the accuracy ceiling is provably 1/8 = 0.125, independent
of model, data, or budget. `exp2_distillation.py` (same world, three encodings: RGB / WORLD
material-id / SYZYGY text) is **INCONCLUSIVE and labeled so**: all three encodings land at or
below the majority-class baseline (0.4551 / 0.4053 / 0.4942 vs majority) — "below baseline"
means *undertrained* (900 samples, 4000 SGD steps), not *unreadable* (`FINDINGS.md` exp2 section).

### (b) Mechanisms novel vs fleet idioms
- **The provable channel ceiling.** The fleet's receipts program (seals, pre-regs, TEST-RECEIPTs)
  certifies what *was* measured; voxelglyph adds an instrument that certifies what **cannot be
  measured through a channel, ever** — a pre-empirical bound derived from the encoder's algebra
  (rank-one projection), not from a run. Nothing in the fleet's P1–P7/seal idiom does this.
- **Port-as-instrument with constant-level conformance.** `syzygy_port.py` is a line-for-line
  integer port whose header states the doctrine: "If this port disagrees with the C, the
  disagreement is the finding — not a nuisance." Constants copied exactly and spot-verified
  against C (`luma(255,0,0)=76`, `luma(0,255,0)=149`, `luma(0,0,255)=28`, white=255 because the
  weights sum 256). This is a third conformance idiom beyond quilt-nn/attention's scalar-digest
  pair (67-b) and Syzygy's own golden-hash suite (7 suites / 219 checks, re-run before any of
  this work per README provenance).
- **Failure-first experiment reporting.** The README/FINDINGS lead with the failed *first* exp1
  (hand-picked "chromatically different" materials → ceiling 1.0000, demonstrated nothing) and
  the three instrument defects of exp2 (degenerate labels → majority baseline 1.0000; unequal
  input widths 36/12/4 → the comparison measured capacity; an "MLP" that was a single linear
  layer), each of which *inverted* the result before being caught. The stage summary of 67-c/h
  has the same spirit, but voxelglyph makes the inverted-result archaeology the headline.
- **Verified-page idiom.** `site/index.html` runs the real ported integer path and its adversarial
  claim is checkable in-browser: swapping GOAL/HAZARD under the collision palette yields
  **byte-identical** Syzygy text while a human sees two plainly different colours.

### (c) Adaptable into the ML/RL-in-quilts program
- **Encoding-census before training.** Any lane that routes observations through a lossy or
  quantized channel (quilt-attention scalar digests, ternary quantization lanes D2/D7/G3 in
  quilt-gpu-lab, quilt-nn cell features) can enumerate the reachable observation space, bucket by
  the encoder's output, and pre-register the induced ceiling **before** the first training run.
  A later KILL then has two clean flavors: "model failed" vs "representation made it impossible".
- **Minimal-sufficient-encoding question.** FINDINGS' "what to do next": smallest per-cell symbol
  set such that a *linear* policy matches a pixel policy. For the quilt program this is exactly
  the question "how many observation cells does an RL-in-quilt actually need" — a compression
  question with a measurable answer, no renderer required.
- **Honest-inconclusive taxonomy.** exp2's INCONCLUSIVE-with-reasons (budget vs readability
  confound declared) is a cleaner verdict vocabulary than INCONCLUSIVE alone; pairs naturally
  with quilt-tools' four-verdict idiom (see §4).

### (d) Defects / honest-limitation gaps worth receipting
- **Hardcoded absolute path breaks reproduction**: `exp1_luma_collision.py` and
  `exp2_distillation.py` both do `sys.path.insert(0, '/workspace/projects/voxelglyph')` — an
  author-box path. On any other checkout the import fails, so the README's "Run" block is not
  reproducible as shipped. One-line fix (derive from `__file__`); worth an upstream receipt or PR.
- No CI, no tests, no LICENSE file in the tracked tree (verified: 0 LICENSE/COPYING tracked);
  no receipt chain — FINDINGS.md is honest prose, unverifiable by pin.
- exp2's own limitation is self-receipted (undertrained vs unreadable ambiguity) — do not re-receipt
  what the repo already says; the *gap* is that the follow-up (real budget or a 900-sample-learnable
  task) has no registered gate yet.

### (e) Cross-repo integration proposal + sketch
**Proposal: an `encoding-census` pre-gate for quilt-attention/quilt-nn quantized observation
cells, housed as a quilt-gpu-lab QUEUE item.** Sketch:
1. New `experiments/g8_encoding_census.py` (quilt-gpu-lab conventions: SPOOL pre-reg with frozen
   gates, guard.py wrapper, receipt manifest re-seal).
2. Input: a channel map f (e.g. the ternary passband, or attention-cell scalar quantization) and
   the task's K material/observation classes; enumerate or sample the input space (seeded, budgeted).
3. Output: per-class collision table + `ceiling(K) = classes_used / K` bound, sealed into the run's
   pre-reg as a **structural ceiling gate**: any training arm scoring at ceiling is auto-KILLed as
   *channel-dead* rather than *model-weak*.
4. Cross-cite voxelglyph by name in the pre-reg (the quilt-gpu-lab weight-law citation convention)
   so the referral edge can mint when the run books.

---

## 2. SuperInstance/murmuration (`05d114d`, 30 files, ~10 experiments + kernel)

### (a) Problem it solves
Is there collective intelligence with **no objective at any time**? `murmuration/cell.py` is a
first-person cell with a *structural* information barrier (it receives at most `k` neighbour
payloads; `perceive()` cannot reach anything else); `murmuration/swarm.py` is the kernel: cells
drift toward beliefs they agree with, beliefs refresh by **deference to confidence** (adopt when a
peer is markedly more confident: `best.conf > me.conf + 0.03` → `b = 0.85·vote + 0.15·b`), and the
kNN lattice is *rewired every round* (`_reknn`), so neighbourhoods are consequences of geometry.
The surviving finding (`docs/TISSUES.md`): **a d-dimensional opinion space sustains d+1
well-separated, defended tissues under one fixed local rule** — 2-D holds three and refuses a
fourth (3.00 groups, sd 0.000); 3-D holds four (4.00, sd 0.000); 2-D tissues survive a 20% belief
kick (11.0 → 5.5 sep/spread, recovered) and return *sharper* after the kick that destroyed 1-D
(19.2). At d=1 the behaviour is bimodal and the file **refuses to quote its own mean**.

### (b) Mechanisms novel vs fleet idioms
- **The degenerate-measurement rule.** "A relational claim over a constant measurement is vacuously
  true. Any claim resting on a signal with `std == 0` is scored **INCONCLUSIVE, never PASSED** —
  and that rule cuts both ways" (README §"The rule this is built to obey"). It refused the repo's
  own numbers three times. This is a *verdict-function* idiom the fleet's pre-reg gates do not yet
  encode: our gates score direction and margin, not degeneracy.
- **Bimodality refusal.** "A mean over two different phenomena summarises neither" (TISSUES.md on
  the 1-D column whose spread 4.68 > mean 3.69). Directly parallel to 67-f's variance-collapse
  finding (federation regret bimodal: 8 seeds |Δ|≤5.5, one +47.4, one −34.5) — but murmuration
  makes the refusal *mechanical*.
- **Controls before trust, as method.** Two dead mechanisms caught by controls, not code reading:
  averaging's fixed point at the prior (polarization pinned 0.008 — the swarm looked alive, the
  number was dead) and similarity gating that cannot carry a belief across a gap (frozen 0.035,
  sd 0.0000). Plus the **degree-preserving rewiring null** (`rewire_degree_preserving`,
  `sortedness()`) separating spatial sorting from edge-count artefacts — PRIOR-ART.md calls this
  the one genuinely unpublished piece, and is honest that a novel *control* is not a novel *result*.
- **Adversarial prior-art review as a repo artifact.** `docs/PRIOR-ART.md` killed its own claims
  with citations (Cavagna 2010 inverted the murmuration motivation; the partition result is the
  Hegselmann–Krause polarization phase, cluster law 1/(2ε); exp7's "local beats broadcast" was a
  confound — **voice diversity is the driver**, barrier is decoration). The fleet's seals/receipts
  prove execution; nothing yet institutionalizes *literature annihilation of one's own claims*.
- **A bug caught by a later experiment.** The first version of the d+1 tissue claim was a seeding
  bug (three opinions seeded into one spatial band, 16/16 overlap); found by exp10's mechanism
  probe, not by inspection (TISSUES.md). This is the experimental analogue of the fleet's
  fail-closed pin catching drift after the fact.

### (c) Adaptable into the ML/RL-in-quilts program
- **Deference-to-confidence as an alternative Q-fold.** quilt-bandit v0.1.0 pools Q-values by
  read-time mean over observations (67-f design of record), and its herding probe showed naive
  pooling herds; the C4 DITHERING patch FAILED its pre-registered bar (2/10). Murmuration gives a
  third mechanism: **do not average — defer**. A replica adopts a peer's arm estimate only when the
  peer's evidence (pull count / inverse-variance) is markedly higher; otherwise it keeps its own
  and loses confidence when surrounded by confident disagreement. This attacks herding at the
  aggregation rule instead of at the exploration schedule. (Speculation: it may simply reintroduce
  stubbornness; that is what the pre-reg bar is for.)
- **Degeneracy gates in experiment receipts.** Any quilt-bandit / quilt-neighbourhood experiment
  receipt that reports a mean over replicas should be required to ship (i) a spread, (ii) a
  bimodality check (e.g. mode separation vs spread), (iii) an auto-downgrade to INCONCLUSIVE when
  the signal is degenerate. 67-f already *reports* variance collapse; the rule would make such
  findings structurally unmissable in future runs.
- **Rewiring null for sync-topology claims.** quilt-bandit chose gossip-ring over all-pairs on
  perf (139s vs 184s per 2000 steps). For *outcome* claims about sync topology ("ring converges"),
  a degree-preserving rewiring control is the honest null — adopt as a standard arm.

### (d) Defects / honest-limitation gaps worth receipting
- **Reproducibility is prose, not pins.** No CI, no tests, no LICENSE (0 tracked), no receipt
  chain: `experiments/*_results.json` are committed but unchained; nothing re-derives them.
  A `receipts/manifest.json`-style seal (quilt-gpu-lab idiom) over results + kernel would close it.
- **The mechanism is unresolved, by the repo's own account**: exp10's ORDERING vs
  MUTUAL-NON-ADJACENCY discriminating test found the exp8 bug *before* either prediction could be
  evaluated; the corrected exp8 shows 1-D is not a clean two-way limit, so ORDERING needs
  restating (TISSUES.md "The mechanism is still not known"). `exp10_results.json` holds survival
  data (1-D per-opinion survival ≈ 0.33–0.38) but the discriminating prediction is unsettled.
- The d+1 law is tested only at d∈{1,2,3}, n∈{3,4}, corner-seeded geometry — TISSUES.md receipts
  this itself ("extrapolating past that is arithmetic, not evidence").
- JEV probe (`jev_control.py`) requires an API key via env (`TYPESAFEAI_KEY`, name only in docs —
  no value in tree); conclusion "the JEV probe does not discriminate" is booked, which is honest.

### (e) Cross-repo integration proposal + sketch
**Proposal: quilt-bandit v0.2.0 — "deference fold" pre-registered against variance collapse.**
Sketch:
1. New `experiment/train_bandit_deference.mjs` on the vendored quilt-neighbourhood substrate
   (a99fbd2 pins untouched): fold rule per arm = keep own mean unless a neighbour replica's
   observation count for that arm exceeds ours by a factor θ (pre-register θ=2.0) *and* the
   neighbour's arm-mean confidence interval excludes ours; on defer, blend 0.85/0.15 toward the
   more-evidenced mean (murmuration's numbers, made explicit as gates).
2. Pre-reg file frozen before fire (quilt-gpu-lab `proposals/runs/` convention): primary gate
   ≥8/10 seeds with federation regret ≤ iso-best + margin (the 67-f C3 bar verbatim), secondary
   **ungated** arm: per-replica regret spread ratio fed/most-recent-C3 — the two-sided design that
   paid off for W5b/W5b2 (see §3).
3. Degeneracy gate from this repo: if spread-fed/iso < some floor *or* the delta distribution is
   bimodal (mode-separation test), verdict is INCONCLUSIVE even if the mean passes.
4. Receipt the herding probe as the mechanism-level prior: naive pooling herds (67-f), averaging
   has a fixed point at the prior (murmuration) — cite both by repo name in the pre-reg.

---

## 3. SuperInstance/quilt-gpu-lab (`e700da4`, 1155 tracked files — the marathon's engine room)

### (a) Problem it solves
A standing ML experiment loop on the fleet's RTX 4050 (6 GB, WSL2): cron (~2 h) claims the first
unchecked item in `QUEUE.md`, runs it under `guard.py` (preflight + in-flight VRAM ≥1 GB / ≤80 °C
watchdog + 30-min wall clock), appends verdicts to `RESULTS.md` (3071 lines), checks the box.
Every verdict is KEEP / KILL / INCONCLUSIVE / ABORTED / PREMISE-ABSENT / REFUTED / NAME / NONE /
PARTIAL-* — and the ledger keeps all of them. Recent history (last ~14 commits, all 09-30):
W5b KILL → W5b2 KEEP (antirank default, +8.35% 4/5), H1 KILL, FD1 KILL, F1 PREMISE-ABSENT,
W5a REFUTED, QG1-residual NAME (swap/wire-order convention, Fisher 7.0e-19, BH 28/28) → QG1c NONE
→ QG1d spawned, D23b KILL (angles = degraded mirror of coupling, non-monotone 0.75 at T=200 vs
0.90 bar), AG1 PARTIAL-SUB+OM (Syzygy aggregation mechanisms transfer; agreement-class selector
fails as their E5 predicted) → AG2 spawned.

### (b) Mechanisms novel vs fleet idioms
- **Frozen pre-reg files + fire-time pins.** `proposals/runs/*.md` committed BEFORE fire with
  named gates and "no post-hoc change" clauses; amendments only pre-fire and declared (H1's
  3-cell→2-cell pattern after smoke voided every seed — `4a4dfb1`). Fire-time sha256 pins of the
  runner into `receipts/manifest.json` (`W5a` booking cites `27a625…`-style pins). The fleet has
  pre-registrations (quilt-jepa registration-*.json); quilt-gpu-lab's version is *file-per-run,
  gate-named, amendment-disciplined* and wired to a cron that fires without a human.
- **The dirty-tree seal guard.** The d23b "phantom seal" autopsy (`receipts/manifest-repair-2026-09-30-d23b.md`):
  two seals hashed a working-tree state git never saw; the pin only caught it on a clean clone.
  Remedy in `tools/receipt_manifest.py`: sealing with dirty sealed paths **exits 2** unless
  `--allow-dirty` records a `sealed_from_dirty_tree` admission row — converting the class from
  pin-caught-later to refused-at-seal-time. This is a genuinely new receipt-layer mechanism.
- **Two-sided pre-registered design.** W5b's pre-reg registered antirank as an *ungated
  exploratory* arm; the gated primary (lifetime) KILLed while the ungated secondary won 3/3, and
  W5b2 confirmed it on fresh seeds at confirmation-grade gates (+8.35%, 4/5). "The elements that
  flip are where the round error lives" is now pre-registered, confirmed evidence.
- **The PREMISE-ABSENT verdict.** F1's frozen G3 instruction: if the claimed regime does not
  reproduce (r_pfifo 1.001 < 3.0), the finding is about the *claim's fragility*, not a pass/fail
  of the mechanism — a verdict class the fleet lacks (we have KILL/INCONCLUSIVE, not "the premise
  is absent").
- **PROPOSER (the mutation-proposal organ).** `proposals/PROPOSER.md`: deterministic scorer over
  the ledger — `score = past × gem × falsifiability`, past = mean of verdict bases (KEEP +1,
  INCONCLUSIVE +0.25, QUEUED 0, KILL −1, KILL-with-validated-diagnostic +0.5) × polarity, gem
  status multipliers (SEEDED 1.0 → FIRED 0.5), product so "a candidate weak on any axis cannot
  ride the others"; queue-precedence with 0.8 overlap penalty; nothing self-proposed fires
  without human review (WECO lesson: selection pressure, not generation, is where honesty lives).
- **Spool + rotation discipline.** `SPOOL.md` = pre-registration queue with claims and gates
  before scripts exist; night cron alternates GPU item / PR-SWEEP / SCOUT (`proposals/night-spool-2026-09-30.md`,
  PR-SWEEP #1–#5), with steals receipted (e.g. weight-law by-name citation → RECEIPT-CITE lane).
- **Name-the-doctrine pins.** `tests/test_receipts.py` pin 4/5 fail if the README's doctrine
  provenance stops naming `SuperInstance/AI-Writings algebra.md` (five-opcode WAL) or the
  referral edge `aw-quint-opcode → gl-ledgers` — citation drift becomes a RED test.

### (c) Adaptable into the ML/RL-in-quilts program
- **Everything in (b) is the wave-68 experiment discipline**, ready to import into
  quilt-bandit/quilt-neighbourhood lanes: file-per-run pre-regs with named gates; fire-time sha256
  pins; the two-sided design; PREMISE-ABSENT as a first-class verdict; dirty-tree refusal at
  receipt-writing time (our vendor/PROVENANCE.md pins are the local analogue).
- **Antirank primacy as a mechanism import.** W5b2's confirmed result (commit-count-ASCENDING
  precision allocation; instability marks where round error lives) is directly relevant to any
  ternary/quantized weight-cell lane in quilt-nn/quilt-attention and to which weight-rows get
  exact treatment in a P5 numeric merge.
- **AG1/AG2 aggregation findings** map onto how replicas should combine judgments: consensus
  repairs substitution, union repairs omission, but agreement-class *selection* fails — relevant
  to how quilt-neighbourhood folds concurrent sets beyond P5 means.
- **The proposer score** is a candidate replacement for how wave-68 ranks its own priced ideas.

### (d) Defects / honest-limitation gaps worth receipting
- **Repo hygiene: build artifacts committed.** 634 tracked files under `experiments/wg1_wgsl/target/`
  (Rust `target/release/.fingerprint/…` etc.), 3 `.pyc` files (`__pycache__/guard.cpython-314.pyc`,
  `tests/__pycache__/test_receipts.cpython-312.pyc`, `tools/__pycache__/receipt_manifest.cpython-312.pyc`),
  and 31 root-level `*.log` files. `.gitignore` covers none of these. Bloats clones and risks
  stale-artifact confusion — exactly the drift class the manifest exists to catch.
- **No CI workflow**, while `tests/test_receipts.py` exists (6/6 receipt pins, FAIL-first doctrine).
  By the 67-e decision table (tests exist + no workflow → seed), this repo is the most obvious
  remaining CI-seeding target in the fleet: `python -m unittest discover -s tests` plus a manifest
  freshness check would run in seconds on ubuntu-latest.
- **Manual double-fire coordination.** QUEUE carries "IN FLIGHT … do NOT double-fire — conductor
  take note" markers and hand-written "booking one-shot" notes (08:4x/09:1x). Cron + humans + night
  agents coordinate by prose. (Speculation: a claim-and-lease row in a sealed ledger would close
  the race, but the current record shows no actual double-fire incident — flag as design tension.)
- D23b's "gates were registered in the experiment source, not as a frozen proposals/runs/ pre-reg"
  was self-receipted as a discipline miss — the remedy is already the repo convention; no action
  beyond noting the third instance of the QUEUE-drift backfill class (D22/E13/E13b/D23b).

### (e) Cross-repo integration proposal + sketch
**Proposal: import the pre-reg + two-sided + dirty-guard discipline as wave-68's standing
experiment law, and upstream the dirty-guard's missing twin (CI) back into quilt-gpu-lab.**
Sketch:
1. quilt-bandit/quilt-neighbourhood: create `proposals/runs/<ID>-<name>.md` template — claim,
   lane, frozen gates (KEEP/KILL thresholds numeric), budget, seeds, pre-declared exploratory arm,
   no-post-hoc clause; commit BEFORE the runner exists (SPOOL convention).
2. At fire time, pin the runner's sha256 into the run's receipt (we already hash receipts; the pin
   binds code to verdict).
3. Add the dirty-tree refusal to our receipt regeneration path: refuse to write a TEST-RECEIPT or
   merged receipt while sealed paths are dirty, with an explicit `--allow-dirty` admission row if
   ever needed (mirror of `receipt_manifest.py` lines 47–102).
4. Upstream, in the other direction: PR to quilt-gpu-lab seeding `.github/workflows/ci.yml`
   (`unittest discover -s tests` + `python tools/receipt_manifest.py` dry check; node not needed).
   Per 67-e law: local suite first (6/6), history-independent, no shallow-checkout sensitivity.

---

## 4. SuperInstance/quilt-tools (`af2b451`, the 11-tool layer)

### (a) Problem it solves
Eleven working tools grown on the Quilt reactive engine (vendored `vendor/quilt-core/`), one shared
harness (`src/toolkit.mjs`: `sheet()`, `check()/done()`, `WitnessLog` fnv1a64 chain ported from
quilt-cloudflare `ocean.ts`, `SysOne` degrade-honest heuristics, `localEmbed`), **94 self-checks**,
three GAN-bred "bloodlines" of behaviorally-exact divergent implementations with their own
verifiers (pager-band 860/860, witness-fnv 832/832, cosine-sparse 828/828), and a lab where live
model studies book REFUSED rows rather than retrying them away. The 11th tool, `convergence-gauge`
(19/19 checks, merged as PR #28, commit `2618bc7`), certifies training-curve convergence.

### (b) Mechanisms novel vs fleet idioms
- **convergence-gauge's three-part certification** (`tools/convergence-gauge.mjs`, 360 lines, zero-dep,
  exports `converge`/`makeGauge`/`DEFAULTS`):
  - *flat-tail latch*: maximal suffix with range (max−min) ≤ tolerance, latch after `minLen`
    samples — a frozen plateau and a bounded-noise plateau certify identically;
  - *two-sided CUSUM change-point scan* on the deltas (up-side raw, down-side sign-flipped; slack
    k = tolerance, h = 4·tolerance, Page 1954, one pass) so a CONVERGED verdict also says whether
    the path held a regime shift;
  - *hysteresis* borrowed from fleet-pager's paging bands: after latching, an excursion within
    tolerance×hysteresis is booked but does not flip; only a stray beyond the band un-certifies
    ("page-flapping, but for the stop button").
  Plus the **double-entry idiom**: the sheet program re-implements the policy and a pin asserts
  core verdict == sheet verdict ("two implementations, one answer"); NaN/non-numeric/bad-config
  refusals are loud receipts; LATCH/RE-LATCH/FLIP transitions drain into the witness chain.
  Unlike its siblings, it exports its core so RL/NN lanes can import it.
- **The referral graph + weight law** (`src/referral_graph.mjs`, `experiments/REFERRAL_GRAPH.md`):
  ideas are nodes, referrals are hash-chained LINK rows; weight law PENDING=0.05 / VERIFIED=1.0
  (merged PR **in the target repo** naming the source in-repo) / REFUTED=0 with the scar kept;
  currency flows INTO the repo where the citation lands (the substrate enforces direction; pulse
  guesses were overruled — edge #10 HONESTY ON DIRECTION). Eleven edges booked over 09-26→09-30,
  each with receipt PR#, merge SHA, and falsification condition; **never self-upgraded** — the
  09:11 pulse ran the weight-law check by hand for edge #11 (AI-Writings#70's KAT instrument
  bridged by jev-quilt#47, pinned by commit + sha256 as executable constants).
- **The trust lever** (`viewTrusted({trust, default: 0})`, PR #17 porting jev-quilt `commons.py`
  G11): blind view mass is buyable by junk self-citations; trust re-scales every edge by the
  TARGET repo's earned trust, unseen sources default 0, trust≡1 reduces exactly to the blind view
  (pinned). Anti-Goodhart by construction.
- **Citation-verify guard** (`3dd7e0d`): `gh search prs` **ranks, not filters** — a live run
  surfaced an irrelevant PR; the tool now requires literal hint text in title/body/diff before
  presenting a CANDIDATE; fails are FUZZY-REJECTED, gh errors VERIFY-UNKNOWN, both surfaced never
  booked (Pin 12).
- **Four-verdict honesty idiom**: CONFIRMED (re-executed, holds) / REFUTED (re-executed, fails) /
  SIMULATED (asserted, never executed) / MEASURED (executed, nothing claimed) — naming the two
  dodges (SIMULATED, MEASURED) that would otherwise pass unlabeled.
- **LEGIBILITY.md** (`e54ff07`): a read-only pass grading the repo against fleet-legend obligations
  L4 ("what this does NOT do" — missing in 55/100 fleet repos) and L5 ("what to do when it fails" —
  59/100), with every finding predicate-checked against the tree and an explicit section "What we
  deliberately did NOT write" ("a completer that invents a receipt or a failure mode produces a
  confident lie, and a confident lie is worse than a blank space").

### (c) Adaptable into the ML/RL-in-quilts program
- **convergence-gauge is the direct certification instrument for quilt-bandit/quilt-neighbourhood
  runs** (67-open already flagged the pattern): push per-episode pseudo-regret (or per-arm pull
  rate) curves; refuse to book a verdict while the curve is NOT_CONVERGED or INSUFFICIENT; keep
  change_points in the receipt so a "converged" verdict that rode a regime shift is visible; reuse
  the LATCH/FLIP ops as receipt kinds. Sizing note: `DEFAULTS = {window 8, tolerance 1e-3,
  minLen 24, hysteresis 2}` are tuned for loss-scale curves; bandit pseudo-regret needs its own
  frozen tolerance (pre-register it).
- **The referral weight law as wave-68's doctrine-flow accounting.** Cross-repo adoptions become
  edges booked PENDING with a declared upgrade path, flipped VERIFIED only by a merged PR in the
  target repo that names the source. This gives the marathon a *measurable* adoption metric and a
  standing anti-Goodhart guard (never self-upgrade; human verifies load-bearing).
- **The trust lever as graded admission control.** quilt-neighbourhood v0.3.0's signed-sheet
  allowlist is binary (member/stranger). `viewTrusted`'s shape — earned, revocable, default-0 —
  is the natural upgrade if coordinator-run federated rounds ever need graded trust.
- **Four-verdict idiom** for our own README/TEST-RECEIPT claims (SIMULATED vs MEASURED is exactly
  the distinction between the v0.1.0 ensemble receipts and any future mocked dry-run).

### (d) Defects / honest-limitation gaps worth receipting
- **CI exercises only 1 of 11 tools.** `.github/workflows/ci.yml` runs `npm run check` (syntax
  only), `node tools/fleet-pager.mjs` (flagship), and the gan-elites verifiers. The other ten
  tools' 87 self-checks are not exercised by CI even though README ships the loop command. One
  CI step closes it: `for f in tools/*.mjs; do node $f || exit 1; done`.
- **LEGIBILITY-confirmed gaps, still open**: no automated tests wired to a runner (the self-checks
  live inside tool mains; a census predicate sees no `tests/`), no LICENSE file (0 tracked; note
  `package.json` declares `"license": "MIT"` — a declaration/file mismatch worth one commit), no
  `test` script in package.json.
- **Human-flip dependency in the weight law.** The law's honesty ("never self-upgraded") is
  enforced by manual pulses; the discovery watcher surfaces candidates but a human must verify and
  flip. Honest by design, but it makes VERIFIED status lag merges by hours and does not scale past
  the current pulse cadence. (Speculation: a two-key rule — watcher proposes, a second lane
  confirms — would keep the no-self-upgrade property while removing the single-operator bottleneck.)
- Engine is a vendored dist with provenance README — fine — but `QUILT_DIST` override means CI and
  laptop can silently test different engines if the env leaks into a run.

### (e) Cross-repo integration proposal + sketch
**Proposal: `quilt-bandit v0.2.0 vendors or imports convergence-gauge's exported core and books
verdicts only on certified curves — and the adoption itself becomes a referral-graph edge.**
Sketch:
1. Copy `tools/convergence-gauge.mjs`'s core (it is dependency-free and explicitly exported for
   "RL / NN training ops" per its header) into `quilt-bandit/vendor/` with a PROVENANCE.md pin
   (repo, commit `2618bc7`, sha256) — mirroring the vendored quilt-neighbourhood discipline.
2. Instrument the ensemble runner: every episode appends its pseudo-regret curve; verdict
   booking requires `converge(curve, params).verdict === 'CONVERGED'` with pre-registered params;
   `change_points` recorded in the merged receipt; FLIP/LATCH ops appended to a WitnessLog chain
   (toolkit idiom) so the certification itself is tamper-evident.
3. Cross-check: quilts-side, assert the certified anchor equals the mean of the last window used
   by the pre-registered bound check (double-entry, one line, catches integration drift).
4. Book the adoption: edge `qt-convergence-gauge → qb-certified-verdicts` as PENDING in a
   quilt-bandit docs file with the upgrade path named ("on merge, quilt-tools'
   referral_graph.seed.mjs may add the VERIFIED edge after human verification") — the weight law
   requires the citation to land in the TARGET repo, which is exactly this commit's README.

---

## ADOPTIONS FOR WAVE-68 (ranked; effort S <1 lane-day, M ≈1 lane, L >1 lane)

1. **Pre-reg law import (quilt-gpu-lab → all wave-68 ML/RL lanes).** File-per-run frozen
   `proposals/runs/*.md` with named numeric gates, budget, seeds, pre-declared ungated exploratory
   arm, no-post-hoc clause; fire-time sha256 pin of the runner; PREMISE-ABSENT accepted as a
   verdict class. **Effort S. Expected value: highest per token** — it converts 67-f's
   already-good ensemble discipline into the gold standard and makes every later KILL
   self-defending.
2. **Degenerate-measurement rule + bimodality refusal (murmuration → all experiment receipts).**
   Any reported mean ships with spread + a mode-separation check; degenerate (spread-free) or
   bimodal signals auto-downgrade to INCONCLUSIVE, never PASSED — codified in the receipt writer,
   not in prose. Directly retroactive to 67-f's variance-collapse receipts (the +3.79 mean over a
   bimodal sample is exactly the case the rule forbids summarizing). **Effort S. Expected value:
   high; makes the fleet's most valuable finding class (variance collapse) structurally
   unmissable.**
3. **convergence-gauge certification for verdict booking (quilt-tools → quilt-bandit v0.2.0).**
   Vendor the exported zero-dep core with a PROVENANCE pin; no verdict books on a
   NOT_CONVERGED/INSUFFICIENT curve; change_points + LATCH/FLIP ops in the receipt chain. **Effort
   S–M. Expected value: prevents both premature KILLs (still-descending) and false KEEPs
   (non-stationary plateaus) in every future training/bandit run.**
4. **Dirty-tree seal guard + CI seeding, both directions (quilt-gpu-lab ↔ our repos).** Import the
   refuse-to-seal-when-dirty guard (exit 2 / admission row) into quilt-neighbourhood and
   quilt-bandit receipt paths; upstream a CI workflow to quilt-gpu-lab running its own 6/6 receipt
   pins (it is the biggest fleet repo still without CI despite having a FAIL-first test suite).
   **Effort S (ours) / M (upstream PR). Expected value: kills the phantom-seal class fleet-wide;
   the d23b autopsy proves the pin alone is not enough.**
5. **Deference-fold experiment (murmuration mechanism → quilt-bandit v0.2.0).** Replace the
   read-time mean fold with confidence/evidence-gated deference (θ=2.0 evidence ratio, 0.85/0.15
   blend), pre-registered ≥8/10 against the C3 bar, ungated secondary: fed/iso spread ratio;
   degeneracy gate per adoption #2; gossip-ring unchanged. Hypothesis of record: herding is a
   fixed-point property of mean-pooling (murmuration's averaging lesson) — attack the aggregation,
   not the exploration schedule (dithering FAILED 2/10). **Effort M. Expected value: first
   mechanistic shot at the variance-collapse finding; even a KILL localizes the collapse to the
   fold rule vs the sync topology.**

Runner-ups (unpriced, for the queue): voxelglyph's encoding-census pre-gate for quantized
observation channels (M); antirank precision allocator for ternary weight-cell lanes (S, after
upstream replication); referral weight-law adoption accounting for wave-68 (S); four-verdict
labels in our READMEs (S); LEGIBILITY-style L4/L5 self-audit for quilt-bandit (S).

---

## Honest uncertainty of this study
- Study depth per repo was bounded (README + key sources + ~10 commits): quilt-gpu-lab's 1155
  tracked files include ~60 experiment modules — I read the ledgers, guard, manifest tool, receipt
  tests, and four pre-reg/booking arcs (QG1*/W5*/H1/FD1/F1/AG1) but not every experiment body.
  Anything mechanism-level claimed about those bodies is (speculation).
- murmuration's exp10 status and the "d+1 tissues" law boundary are reported from the repo's own
  docs (TISSUES.md), not re-derived here.
- voxelglyph's `site/syzygy.js` was not audited; the exp1 enumeration is honest at step 5 (~140k of
  16.7M RGB triples) — collision structure at finer steps is (speculation) likely richer, not poorer.
- The wg1_wgsl/target count (634) and log counts are from `git ls-files` at `e700da4`; upstream may
  have moved since.
