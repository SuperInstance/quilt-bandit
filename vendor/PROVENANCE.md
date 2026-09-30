# vendored: quilt-neighbourhood substrate

Pinned provenance — do not edit by hand.

- Source: github.com/SuperInstance/quilt-neighbourhood
- Commit: 9d6c62028cee58bff42366b202941c183ab6c429 (v0.4.0, P7 epsilon-diff) (v0.4.0, P7 epsilon-diff policy)
- Files: src/{canonical,diff,replica,signed}.mjs copied verbatim into vendor/
- Reason: the substrate publishes to GitHub Packages (npm.pkg.github.com), which needs
  registry auth; vendoring keeps this repo dependency-free and reproducible offline.
- Upgrade path: re-copy from a newer release and update the pin above. If a vendored
  file's sha256 changes without this pin changing, this receipt is void.
- History: v0.3.0 @ a99fbd265369c9afa091303ccfc372753d4c9ad9 (signed sheets) was the
  v0.1.0/v0.1.1 pin; v0.4.0 adds the P7 epsilon-diff gate (backward compatible — the
  v0.1.x suite ran 12/12 unchanged on it before this repo's own sparse layer was added).

sha256 pins (v0.4.0 @ 9d6c620):
627fe55724a2649e0fcd72517f35cbddf3333595c479a046d43c97297790f997  canonical.mjs
fe6f706beadd9d302179c7f0d526d24f622a9ce432355a805c9e9781aaf87835  diff.mjs
bc09758631a78417655fc7423e9e7885fd9c12a81d39f76749e5a935c7447a5e  replica.mjs
196196826a52e304bfb87f811b588f8261f099df6e527727bd2c462ee4ca672a  signed.mjs
