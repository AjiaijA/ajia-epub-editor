# Maintenance and Release Process

The hosted application and GitHub release must correspond to the same reviewed
commit and release archive.

## Routine maintenance

- CI runs on every push and pull request and once a week.
- Dependabot checks npm dependencies weekly.
- Review dependency updates in small groups and keep `package-lock.json`
  committed.
- Re-run real-browser and reader smoke tests when archive, XML, preview, or
  export code changes.
- Never use a user-owned EPUB as a committed fixture.

## Change workflow

1. Create a focused branch from `main`.
2. Add a regression test using self-authored input.
3. Update both English and Chinese UI/documentation where user behavior changes.
4. Run:

   ```text
   npm ci
   npm run check
   npm run test:coverage
   npm run test:e2e
   npm run release:package
   npm audit
   ```

5. Merge only after CI passes.

## Release workflow

1. Set the same stable version in `package.json` and `src/release.ts`.
2. Build twice and confirm the release ZIP SHA-256 is deterministic.
3. Deploy the ZIP to a new versioned site directory.
4. Run the online Playwright flow against the staged directory.
5. Atomically switch the stable site route; retain the previous directory.
6. Run the online flow again against the stable URL.
7. Push the reviewed commit to `main` and wait for CI.
8. Create an annotated `vX.Y.Z` tag and GitHub Release with the ZIP and SHA-256
   sidecar.
9. Update the `/tools/` entry if the URL or product description changed.

If the site verification fails, switch the symlink back to the previous
version and do not move or recreate the Git tag.
