# eslint-plugin-class-validator-types

ESLint plugin to ensure class-validator decorators match TypeScript type annotations.

## Installation

```bash
npm install --save-dev eslint-plugin-class-validator-types
```

## Usage

// .eslintrc.js

```javascript
module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["class-validator-types"],
  rules: {
    "class-validator-types/decorator-type-match": "error",
  },
};
```

Or use the recommended config:

```javascript
module.exports = {
  parser: "@typescript-eslint/parser",
  extends: ["plugin:class-validator-types/recommended"],
};
```

## Example

```typescript
import { IsString, IsNumber } from "class-validator";

class User {
  @IsString()
  name!: number; // ❌ Error: Decorator @IsString does not match type annotation number

  @IsNumber()
  age!: string; // ❌ Error: Decorator @IsNumber does not match type annotation string

  @IsString()
  email!: string; // ✅ Correct
}
```

## Supported Decorators

- @IsString → string
- @IsNumber / @IsInt → number
- @IsBoolean → boolean
- @IsArray → array or Array<T>
- @IsDate → Date
- @IsObject → object
