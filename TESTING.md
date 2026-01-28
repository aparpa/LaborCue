# Testing Guide (Beginner Friendly)

This is the one place to learn how testing works in this project.
If you read this file, you should be able to write and run tests without help.

## What is a test?

A test is a small script that checks one behavior. It calls a function or renders a component, then compares the result to what you expected.

If the result matches, the test **passes**. If it does not, the test **fails**.

## Where tests live

All tests go in the `tests/` folder.

Example layout:

- tests/
  - services/
    - hrvAnalysis.test.ts
  - components/
    - StatusCard.test.tsx

Start by reading `tests/services/hrvAnalysis.test.ts`.

## How to write a test (simple pattern)

Use this 3-step pattern:

1. **Arrange**: create inputs (data or props)
2. **Act**: call a function or render a component
3. **Assert**: check the result with `expect(...)`

Example:

```ts
import { someFunction } from '../../src/someModule';

describe('someFunction', () => {
  it('does the expected thing', () => {
    // Arrange
    const input = 1;

    // Act
    const result = someFunction(input);

    // Assert
    expect(result).toBe(2);
  });
});
```

## How to run tests

### macOS / Linux

```
npm test
```

Or run the full pre-PR checks (lint + tests):

```
npm run verify
```

### Generate coverage (HTML report)

```
npm run test:coverage
```

This generates `coverage/index.html`. Open that file in a browser to see per‑file coverage.

### Windows (PowerShell or CMD)

```
npm test
```

Or run the full pre-PR checks:

```
npm run verify
```

### Generate coverage (HTML report)

```
npm run test:coverage
```

This generates `coverage\\index.html`. Open that file in a browser to see per‑file coverage.

## Coverage cleanup (cross‑platform)

Before each `npm test`, we delete the old `coverage/` folder so the report is fresh. This works on Windows, macOS, and Linux.

## How to know if tests passed or failed

- **Pass**: you will see `PASS tests/...` and a summary like `Tests: 1 passed`
- **Fail**: you will see `FAIL tests/...` and an error message showing the mismatch

## If npm is not working on Windows

Use **nvm-windows** to install Node 20, then run tests:

```
nvm install 20
nvm use 20
node -v
npm install
npm run verify
```

## If npm is not working on macOS/Linux

Use `nvm` to install Node 20, then run tests:

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
nvm alias default 20
node -v
npm install
npm run verify
```

## Common beginner mistakes

- **Forgetting to run `npm install`** after pulling new dependencies
- **Running tests from the wrong folder** (run commands from the repo root)
- **Changing code but not updating tests**
- **Ignoring a failing test** — fix or explain it before opening a PR
