# Testing Checklist (Before Opening a PR)

- [ ] Pull the latest `main` and resolve conflicts if needed.
- [ ] Install dependencies if `package.json` changed: `npm install`.
- [ ] Run lint: `npm run lint`.
- [ ] Run tests: `npm test`.
- [ ] Start the app (if you changed UI): `npx expo start`.

## Quick Commands by OS

### macOS / Linux

```
npm run verify
```

Or directly run the script:

```
npm run verify:unix
```

### Windows (PowerShell or CMD)

```
npm run verify
```

If you use Git Bash, you can also run:

```
npm run verify:unix
```
- [ ] Scan the QR code in Expo Go and verify the affected screens.
- [ ] Update docs if your change alters setup, usage, or behavior.

If any step fails, fix it or note it clearly in the PR description.
