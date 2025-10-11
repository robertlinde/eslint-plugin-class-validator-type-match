# eslint-plugin-class-validator-type-match

ESLint plugin to ensure class-validator decorators match TypeScript type annotations.

## Installation

**npm**

```bash
npm install --save-dev eslint-plugin-class-validator-type-match
```

**yarn**

```bash
yarn add -D eslint-plugin-class-validator-type-match
```

## Usage

// .eslintrc.js

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['class-validator-type-match'],
  rules: {
    'class-validator-type-match/decorator-type-match': 'error',
  },
};
```

Or use the recommended config:

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['plugin:class-validator-type-match/recommended'],
};
```

## Example

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['plugin:class-validator-type-match/recommended'],
};
```

## Example

```typescript
import {IsString, IsNumber} from 'class-validator';

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

- `@IsString` → string
- `@IsNumber` / `@IsInt` → number
- `@IsBoolean` → boolean
- `@IsArray` → array or Array<T>
- `@IsDate` → Date
- `@IsObject` → object
