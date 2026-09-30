// signed_bandit.test.mjs — v0.1.1 signed-sheet federation suite (SG1–SG4).
//
// Failure conditions are stated per test. DETERMINISM DISCIPLINE (inherited from the
// substrate's signed suite): Ed25519 key generation uses crypto-grade entropy, so
// `did` values differ from run to run — no test pins key bytes or did strings; every
// signed assertion is RELATIONAL (verify/reject outcomes, counts, or bit-exact
// equality against an unsigned twin run driven by the same seeds). Suite re-runs are
// therefore deterministic even though key material is not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sign as edSign } from "node:crypto";
import { QuiltBanditAgent, DriftingBandit } from "../src/bandit.mjs";
import { SignedQuiltBanditAgent } from "../src/signed_bandit.mjs";
import { Replica, merge } from "../vendor/replica.mjs";
import { verifyDiff, generateKeypair } from "../vendor/signed.mjs";
import { makeDiff, verifyDiff as verifyDiffId } from "../vendor/diff.mjs";

// mirrors runCondition's seeding + gossip-ring sync (agent i merges from (i+1)%K),
// parameterized over the agent class so signed/unsigned twins share one protocol.
function ringRun(Agent, { banditSeed, replicas = 3, steps = 150, sync = 50, eps = 0.1, arms = 4 }) {
  const bandit = new DriftingBandit({ arms, seed: banditSeed });
  const agents = Array.from({ length: replicas }, (_, i) =>
    new Agent({ name: `r${i + 1}`, arms, seed: banditSeed * 100 + i + 1, eps }));
  for (let t = 0; t < steps; t++) {
    bandit.step();
    for (const a of agents) a.play(bandit, t);
    if (sync > 0 && (t + 1) % sync === 0) {
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i], b = agents[(i + 1) % agents.length];
        if (typeof a.syncFromSigned === "function") a.syncFromSigned(b);
        else a.syncFrom(b);
      }
    }
  }
  return { bandit, agents };
}

test("SG1: two signed agents sync — all diffs verify, knowledge = union, fold + regret bit-identical to the unsigned twin", () => {
  const STEPS = 100;
  const play = (A, B) => {
    const bandit = new DriftingBandit({ arms: 4, seed: 77 });
    for (let t = 0; t < STEPS; t++) { bandit.step(); A.play(bandit, t); B.play(bandit, t); }
  };
  // signed pair … and its unsigned twin (same bandit seed, same agent seeds)
  const sa = new SignedQuiltBanditAgent({ name: "r1", arms: 4, seed: 7701, eps: 0.1 });
  const sb = new SignedQuiltBanditAgent({ name: "r2", arms: 4, seed: 7702, eps: 0.1 });
  play(sa, sb);
  const stats = sa.syncFromSigned(sb);
  const ua = new QuiltBanditAgent({ name: "r1", arms: 4, seed: 7701, eps: 0.1 });
  const ub = new QuiltBanditAgent({ name: "r2", arms: 4, seed: 7702, eps: 0.1 });
  play(ua, ub);
  ua.syncFrom(ub);

  // identity: dids are well-formed, distinct, and exactly what exportPublic returns
  for (const a of [sa, sb]) {
    assert.ok(a.did.startsWith("did:key:z"), "agent identity must be a did:key:z did");
    assert.deepEqual(a.exportPublic(), { did: a.did });
  }
  assert.notEqual(sa.did, sb.did, "federation members must have distinct identities");
  // authorship: every known diff is authored by a member did (agents ARE their dids)
  for (const d of sa.rep.diffs.values()) {
    assert.ok(d.author === sa.did || d.author === sb.did, `unexpected author on ${d.id}`);
  }
  // all diffs verify: intact AND validly signed under the author did (full check)
  for (const d of sa.rep.diffs.values()) assert.equal(verifyDiff(d), true, `diff ${d.id} must verify`);
  // knowledge = union; the merge applied exactly the sender's honest diffs
  assert.equal(sa.rep.diffCount(), sa.n + sb.n);
  assert.equal(stats.applied, sb.n);
  // receipt chains verify on BOTH sides
  assert.ok(sa.rep.verifyReceipts(), "receiver receipt chain must verify");
  assert.ok(sb.rep.verifyReceipts(), "sender receipt chain must verify");
  // THE SEMANTICS INVARIANT: signing must not change the RL. Fold, regret, and
  // cumReward are bit-exact against the unsigned twin (rewards are 0/1, so per-arm
  // sums are exact integers — DAG-order differences cannot perturb them).
  assert.deepEqual(sa.policyTable(), ua.policyTable());
  assert.deepEqual(sb.policyTable(), ub.policyTable());
  assert.equal(sa.regret, ua.regret);
  assert.equal(sb.regret, ub.regret);
  assert.equal(sa.cumReward, ua.cumReward);
  // canonical substrate fold == incremental fold on the signed coordinator
  assert.ok(sa.verifyPolicyAgainstState());
});

test("SG2 (negative control): a cross-key forgery is rejected + receipted by the signed coordinator; the SAME injection is accepted by an unsigned sheet", () => {
  // Federation members: bob (merge source, has observations) + coord (signed
  // coordinator, no own observations). Control pair: identical seeds, no injection.
  const mkSource = () => {
    const bob = new SignedQuiltBanditAgent({ name: "bob", arms: 4, seed: 909, eps: 0.1 });
    const bandit = new DriftingBandit({ arms: 4, seed: 908 });
    for (let t = 0; t < 40; t++) { bandit.step(); bob.play(bandit, t); }
    return bob;
  };
  const bob = mkSource();
  const bob2 = mkSource(); // control source (same trajectory, fresh keys)
  const coord = new SignedQuiltBanditAgent({ name: "coord", arms: 4, seed: 910, eps: 0.1 });
  const coord2 = new SignedQuiltBanditAgent({ name: "coord", arms: 4, seed: 910, eps: 0.1 });

  // The imposter: own keypair, NOT a federation member. It forges an observation
  // diff in the victim's namespace CLAIMING the member's did as author, with the id
  // recomputed over the forged payload (self-consistent — passes the content-hash/id
  // gate) but SIGNED WITH THE IMPOSTER'S KEY. signDiff() refuses to build this (an
  // honest signer cannot claim another identity), so the forger drops to raw
  // node:crypto — the honest attack model: the honest library's guards do not bind
  // the attacker.
  const imposter = generateKeypair();
  const forged = {
    sheet: "bandit",
    cell: "arm:3:obs:bob:999",
    op: "set",
    value: 1,
    prev: null,
    author: bob.did, // <-- identity theft: claims the member's did
    ts: 77,
    parents: ["GENESIS"],
  };
  // self-consistent id over the forged payload (imposter recomputes it)
  const d = makeDiff(forged);
  d.sig = edSign(null, Buffer.from(d.id, "hex"), imposter.privateKey).toString("base64");
  Object.assign(forged, d);
  // sanity: the forgery is id-consistent (it would pass the id gate) and IS signed
  assert.equal(verifyDiffId(forged).ok, true, "forgery must be self-consistent to be a real test");
  assert.equal(typeof forged.sig, "string");

  // (a) direct probe — the receive path's verdict, receipt payloads are hashed so
  // the precise reason is pinned via receive()'s return on this identical diff:
  const verdict = coord.rep.receive(forged);
  assert.equal(verdict.accepted, false, "forgery must be rejected");
  assert.match(verdict.reason, /signature does not verify/);

  // (b) the attack as the mission states it: inject into the MERGE SOURCE's diffs
  // Map (Byzantine source), then merge into the signed coordinator.
  bob.rep.diffs.set(forged.id, forged);
  const before = coord.rep.diffCount(); // 0 — coord has no own observations
  const stats = coord.syncFromSigned(bob);
  // rejected: the forged diff NEVER entered the coordinator's knowledge …
  assert.equal(coord.rep.diffs.has(forged.id), false, "forgery must not enter knowledge");
  assert.equal(coord.rep.diffCount(), before + bob.n, "knowledge = own + sender's HONEST diffs only");
  assert.equal(stats.applied, bob.n);
  // … and BOTH rejections are receipted with the dedicated kind "reject-sig"
  const rej = coord.rep.receipts.filter((r) => r.kind === "reject-sig");
  assert.equal(rej.length, 2, "probe + merge rejections must each be receipted");
  assert.ok(coord.rep.verifyReceipts(), "receipt chain must verify across the rejections");
  // control: the no-attack coordinator saw ZERO rejections — the reject-sigs above
  // are attributable to the forgery and nothing else — and folds identically.
  coord2.syncFromSigned(bob2);
  assert.equal(coord2.rep.receipts.filter((r) => r.kind === "reject-sig").length, 0);
  assert.equal(coord.rep.diffCount(), coord2.rep.diffCount());
  assert.deepEqual(coord.policyTable(), coord2.policyTable());

  // THE DOCUMENTED DOWNGRADE ASYMMETRY (substrate NC5 / vendor/replica.mjs P6
  // header), now asserted at the RL layer ON PURPOSE: the EXACT SAME forged diff
  // (same bytes, same Map-injection into a merge source) is ACCEPTED by an unsigned
  // sheet, because unsigned replicas never examine `sig` — v0.2.0 behavior kept
  // byte-for-byte. This is the documented risk, not a bug being smuggled in:
  // signatures protect the sheets that enforce them, and the unsigned coordinator's
  // fold below is visibly POISONED by the fake observation.
  const forgerSrc = new Replica("forger-src", "bandit");
  forgerSrc.diffs.set(forged.id, forged);
  const unsignedCoord = new QuiltBanditAgent({ name: "uc", arms: 4, seed: 911, eps: 0.1 });
  const r = merge(forgerSrc, unsignedCoord.rep);
  // failure of THIS assertion would mean unsigned sheets examine signatures — they
  // must not (backward-compat contract); the asymmetry is confirmed, not regretted:
  assert.equal(r.applied, 1, "DOWNGRADE ASYMMETRY: the same forgery is accepted unsigned");
  assert.equal(unsignedCoord.rep.diffs.has(forged.id), true);
  // … and it poisons the fold: the fake reward is folded into arm 3
  assert.equal(unsignedCoord.policyTable().sum[3], forged.value);
  assert.equal(unsignedCoord.policyTable().cnt[3], 1);
});

test("SG3: signing with your key but claiming a different author throws at write time (substrate gate)", () => {
  const a = new SignedQuiltBanditAgent({ name: "s3", arms: 4, seed: 501, eps: 0.1 });
  const before = a.rep.diffCount();
  // the agent's OWN key, someone else's claimed authorship — the substrate's
  // signed-sheet local gate refuses (authorship must BE the proof)
  assert.throws(
    () => a.rep.set("arm:0:obs:s3:0", 1, { author: "r-pretender", privateKey: a.keys.privateKey, ts: 1 }),
    TypeError,
  );
  // the refusal is receipted and nothing was written
  assert.ok(a.rep.receipts.some((r) => r.kind === "reject-sig"), "refusal must be receipted");
  assert.equal(a.rep.diffCount(), before, "the refused write must not land");
  // companion pin: the key IS required — a local write without privateKey throws too
  assert.throws(() => a.rep.set("arm:0:obs:s3:1", 1, { ts: 2 }), TypeError);
  assert.equal(a.rep.diffCount(), before);
  assert.ok(a.rep.verifyReceipts());
});

test("SG4: mini federated run (3 agents, 150 steps, sync 50) fully signed — regrets bit-identical to the unsigned equivalents, every diff verifies", () => {
  const cfg = { banditSeed: 4242, replicas: 3, steps: 150, sync: 50, eps: 0.1, arms: 4 };
  const sig = ringRun(SignedQuiltBanditAgent, cfg);
  const uns = ringRun(QuiltBanditAgent, cfg);
  // regrets + rewards + folds bit-identical to the unsigned equivalents (same seeds)
  assert.deepEqual(sig.agents.map((a) => a.regret), uns.agents.map((a) => a.regret));
  assert.deepEqual(sig.agents.map((a) => a.cumReward), uns.agents.map((a) => a.cumReward));
  assert.deepEqual(
    sig.agents.map((a) => a.policyTable()),
    uns.agents.map((a) => a.policyTable()),
  );
  // per signed agent: receipt chain verifies, canonical fold check passes, and EVERY
  // diff in the knowledge set carries a valid signature (walk + verify each) from a
  // federation member's did
  const dids = sig.agents.map((a) => a.did);
  for (const a of sig.agents) {
    assert.ok(a.rep.verifyReceipts(), `receipt chain must verify for ${a.name}`);
    assert.ok(a.verifyPolicyAgainstState(), `canonical fold check must pass for ${a.name}`);
    for (const d of a.rep.diffs.values()) {
      assert.equal(verifyDiff(d), true, `diff ${d.id} must carry a valid signature`);
      assert.ok(dids.includes(d.author), `diff ${d.id} author must be a federation member`);
    }
  }
  // ring knowledge pattern is IDENTICAL signed vs unsigned (same protocol, same
  // accept behavior on honest diffs). Receipted protocol note: with the sequential
  // in-round ring (i merges from (i+1)%K, immediately), the final write chunk of the
  // ring's tail needs one MORE sync round to reach every coordinator — at 150 steps
  // the sink holds the full union (3*steps) and the others sit one chunk short. This
  // shape is the unsigned protocol's own (the twin run shows the same pattern), not
  // a signing effect; monotonicity holds everywhere.
  assert.deepEqual(
    sig.agents.map((a) => a.rep.diffCount()),
    uns.agents.map((a) => a.rep.diffCount()),
  );
  const sink = sig.agents.reduce((m, a) => (a.rep.diffCount() > m.rep.diffCount() ? a : m), sig.agents[0]);
  assert.equal(sink.rep.diffCount(), cfg.replicas * cfg.steps, "the ring sink holds the full union");
  for (const a of sig.agents) {
    assert.ok(a.rep.diffCount() >= a.n, `knowledge must be monotone (>= own observations) for ${a.name}`);
  }
});
