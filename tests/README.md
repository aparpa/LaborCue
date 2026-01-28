# Tests

This folder contains automated checks (tests) that verify app behavior. A test is a small script that calls a function or renders a component and then checks the result.

## Example Structure

- tests/
  - services/
    - hrvAnalysis.test.ts
  - components/
    - StatusCard.test.tsx

## Example Test

See `tests/services/hrvAnalysis.test.ts` for a simple example.

### How to Write a Test (Simple Pattern)

1. **Arrange**: create sample data or props.
2. **Act**: call the function or render the component.
3. **Assert**: check the result with `expect(...)`.

Example skeleton:

```ts
import { someFunction } from '../../src/someModule';

describe('someFunction', () => {
  it('does the expected thing', () => {
    const input = 1;
    const result = someFunction(input);
    expect(result).toBe(2);
  });
});
```

## How to Run Tests

```
npm test
```

Or run the full pre-PR checks:

```
npm run verify
```

## Notes

If you add TypeScript tests, run `npm install` after pulling because we use `ts-jest`.

## How to Read Results

- **Pass**: you will see `PASS tests/...` and a summary like `Tests: 1 passed`.
- **Fail**: you will see `FAIL tests/...` and an error message showing what was expected vs actual.
