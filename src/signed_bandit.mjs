// signed_bandit.mjs — v0.1.1 signed-sheet federation ("provenance-proof RL").
//
// DESIGN OF RECORD (composition over mutation — bandit.mjs and vendor/ are untouched):
//   Agents become DID identities. A SignedQuiltBanditAgent IS a QuiltBanditAgent whose
//   Replica is constructed with the substrate's v0.3.0 signed-sheet schema
//   (`{ schema: { signed: true } }`, vendor/replica.mjs P6) and whose Ed25519 keypair
//   is generated at construction (vendor/signed.mjs generateKeypair). Every local
//   observation write passes the private key (opts.privateKey — the substrate's
//   signed-sheet local gate): the diff's author becomes the signing key's did
//   (`did:key:z` + base32 of the raw public key), and the diff carries an Ed25519
//   signature over its 32-byte content-addressed id. A forged or unattributed
//   observation can therefore never enter the fold: on every merge, the substrate's
//   receive() path verifies each incoming diff's signature under the public key
//   EMBEDDED IN ITS AUTHOR DID and drops+receipts (kind "reject-sig") anything that
//   fails — no coordinator-side code needed, the gate IS the substrate.
//
// SIGNING MUST NOT CHANGE SEMANTICS (the load-bearing invariant, pinned by SG1/SG4):
//   `sig` is an overlay excluded from id/canonical computation (vendor/diff.mjs), so
//   authorship lives at the IDENTITY level, never the VALUE level. Observation cells
//   keep their names (`arm:<k>:obs:<name>:<n>`), values, and fold membership; the
//   read-time fold (sum/count per arm) and the pseudo-regret depend only on cell+value.
//   Therefore a signed run and an unsigned run with the same seeds produce BIT-EXACT
//   policy tables and regrets — signed federation buys provenance, not different RL.
//   (Reward values are 0/1, so per-arm sums are small exact integers: fold order,
//   which is topo-order-over-diff-ids and can legitimately differ between a signed
//   and an unsigned DAG, cannot perturb them.)
//
// DETERMINISM DISCIPLINE (inherited from the substrate's signed suite): Ed25519
//   key generation uses crypto-grade entropy, so `did` values differ per run; no
//   test may pin key bytes or did strings. Every signed assertion is RELATIONAL
//   (verify/reject outcomes, bit-exact equality against an unsigned twin run with
//   the same seeds) — the suite stays deterministic across re-runs.
import { QuiltBanditAgent } from "./bandit.mjs";
import { merge } from "../vendor/replica.mjs";
import { generateKeypair } from "../vendor/signed.mjs";

export class SignedQuiltBanditAgent extends QuiltBanditAgent {
  constructor({ name, arms, seed, sheet = "bandit", eps = 0.1 }) {
    // The Replica is signed at construction: every accepted diff must carry a valid
    // Ed25519 signature over its id (P6). Key generation happens after super() — the
    // replica needs no key until the first write, and _localSigner enforces custody
    // per write (a write without the key throws; SG3 pins this gate).
    super({ name, arms, seed, sheet, eps, schema: { schema: { signed: true } } });
    this.keys = generateKeypair(); // { did, publicKey, privateKey } — custody: this object only
    this.did = this.keys.did; // public field: the agent's federated identity
  }

  // Local writes must pass the keypair (substrate signed-sheet gate). The author is
  // NOT passed explicitly: it defaults to the signing key's did, so authorship IS the
  // proof. (Passing an explicit author that differs from the key's did throws — the
  // substrate refuses to let a signer claim someone else's identity; pinned by SG3.)
  observe(k, reward, ts) {
    const cell = `arm:${k}:obs:${this.name}:${this.n}`;
    this.n++;
    this.rep.set(cell, reward, { privateKey: this.keys.privateKey, ts });
  }

  // Ring merge, exactly as the unsigned agent's syncFrom — the substrate verifies
  // signatures on receive automatically on a signed sheet (vendor/replica.mjs
  // receive -> verifyDiffForSheet): each incoming diff must carry a valid Ed25519
  // sig over its id, verifiable under the author did's embedded public key.
  // Failures are dropped and receipted with kind "reject-sig" (missing/malformed
  // sig, unparseable did, cross-key signature, off-allowlist author); id-integrity
  // failures (tampered payload, stale id) keep the plain "reject" kind and fire
  // first. Nothing is checked here that the substrate doesn't already gate — this
  // method exists to NAME the federation contract (signed peers only) and to return
  // the merge stats so callers/tests can audit what was applied.
  syncFromSigned(other) {
    const stats = merge(other.rep, this.rep);
    this._foldNew();
    return stats;
  }

  // Public federated identity — what a coordinator needs to admit this agent
  // (e.g. as a `signed: { authors: [...] }` allowlist entry). Custody of
  // privateKey/publicKey stays local to the agent object.
  exportPublic() {
    return { did: this.did };
  }
}
