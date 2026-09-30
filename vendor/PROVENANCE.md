# vendored: quilt-neighbourhood substrate

Pinned provenance — do not edit by hand.

- Source: github.com/SuperInstance/quilt-neighbourhood
- Commit: a99fbd265369c9afa091303ccfc372753d4c9ad9 (v0.3.0, DID-signed diffs)
- Files: src/{canonical,diff,replica,signed}.mjs copied verbatim into vendor/
- Reason: the substrate publishes to GitHub Packages (npm.pkg.github.com), which needs
  registry auth; vendoring keeps this repo dependency-free and reproducible offline.
- Upgrade path: re-copy from a newer release and update the pin above. If a vendored
  file's sha256 changes without this pin changing, this receipt is void.

sha256 pins:
627fe55724a2649e0fcd72517f35cbddf3333595c479a046d43c97297790f997  canonical.mjs
fe6f706beadd9d302179c7f0d526d24f622a9ce432355a805c9e9781aaf87835  diff.mjs
b60551eaf7296e553862d0225557a3f10cd064da38365a119028ea3a3ec5ea51  replica.mjs
196196826a52e304bfb87f811b588f8261f099df6e527727bd2c462ee4ca672a  signed.mjs
