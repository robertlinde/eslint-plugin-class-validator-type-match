# eslint-plugin-class-validator-type-match

ESLint plugin to ensure class-validator decorators match TypeScript type annotations and optional property syntax.

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

### Manual Configuration

```javascript
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['class-validator-type-match'],
  rules: {
    'class-validator-type-match/decorator-type-match': 'error',
    'class-validator-type-match/optional-decorator-match': 'error',
  },
};
```

### Recommended Configuration

```javascript
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['plugin:class-validator-type-match/recommended'],
};
```

## Rules

### `decorator-type-match`

Ensures class-validator decorators match TypeScript type annotations.

**Examples:**

```typescript
import {IsString, IsNumber, IsBoolean} from 'class-validator';

class User {
  @IsString()
  name!: number; // ❌ Error: Decorator @IsString does not match type annotation number

  @IsNumber()
  age!: string; // ❌ Error: Decorator @IsNumber does not match type annotation string

  @IsString()
  email!: string; // ✅ Correct

  @IsBoolean()
  isActive!: boolean; // ✅ Correct
}
```

### `optional-decorator-match`

Ensures `@IsOptional()` decorator usage matches TypeScript optional property syntax (`?`).

**Examples:**

```typescript
import {IsOptional, IsString} from 'class-validator';

class User {
  @IsOptional()
  @IsString()
  name?: string; // ✅ Correct - decorator and syntax match

  @IsOptional()
  @IsString()
  email: string; // ❌ Error: Has @IsOptional() but property is not optional

  @IsOptional()
  @IsString()
  phone!: string; // ❌ Error: @IsOptional() conflicts with definite assignment

  @IsString()
  username?: string; // ❌ Error: Property is optional but missing @IsOptional()
}
```

## Supported Decorators

### Type Validators

- `@IsString` → `string`
- `@IsNumber` / `@IsInt` / `@IsPositive` / `@IsNegative` → `number`
- `@Min` / `@Max` → `number`
- `@IsBoolean` → `boolean`
- `@IsArray` / `@ArrayMinSize` / `@ArrayMaxSize` → `array` or `Array<T>`
- `@IsDate` / `@MinDate` / `@MaxDate` → `Date`
- `@IsObject` → `object`
- `@IsEnum` → `enum`

### Type-Agnostic Validators

The following decorators work with any type and are not checked by `decorator-type-match`:

- `@IsOptional`
- `@ValidateNested`
- `@IsDefined`
- `@IsEmpty`
- `@IsNotEmpty`
- `@Equals`
- `@NotEquals`
- `@IsIn`
- `@IsNotIn`

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
