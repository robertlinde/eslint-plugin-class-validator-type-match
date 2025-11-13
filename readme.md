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
    'class-validator-type-match/validate-nested-match': 'error',
    'class-validator-type-match/type-decorator-match': 'error',
    'class-validator-type-match/definite-assignment-match': 'error',
    'class-validator-type-match/dto-filename-match': 'error',
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

### Configuration Presets

- **`recommended`** - All rules enabled (best for most projects)
- **`strict`** - All rules enabled with strict settings
- **`basic`** - Only core type matching rules (decorator-type-match, optional-decorator-match, definite-assignment-match, dto-filename-match)

```javascript
// Use basic preset for less strict validation
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['plugin:class-validator-type-match/basic'],
};
```

## Rules

### `decorator-type-match`

Ensures class-validator decorators match TypeScript type annotations for primitive types.

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

  @IsString({each: true})
  tags!: string[]; // ✅ Correct - validates array elements

  @IsString({each: true})
  username!: string; // ❌ Error: { each: true } on non-array type
}
```

### `validate-nested-match`

Ensures `@ValidateNested()` decorator is correctly applied for complex types.

**Examples:**

```typescript
import {ValidateNested, IsString} from 'class-validator';

class User {
  @ValidateNested()
  address!: Address; // ✅ Correct - complex type with @ValidateNested

  @ValidateNested({each: true})
  addresses!: Address[]; // ✅ Correct - array of complex types with { each: true }

  @IsString()
  profile!: Profile; // ❌ Error: Complex type requires @ValidateNested()

  @ValidateNested()
  tags!: string[]; // ❌ Error: Primitive array doesn't need @ValidateNested

  @ValidateNested()
  history!: Event[]; // ❌ Error: Missing { each: true } for array of complex types
}
```

### `type-decorator-match`

Ensures `@Type(() => ClassName)` decorator matches TypeScript type annotations.

**Examples:**

```typescript
import {Type, ValidateNested} from 'class-validator';

class User {
  @Type(() => Address)
  @ValidateNested()
  address!: Address; // ✅ Correct - @Type matches type

  @Type(() => Profile)
  @ValidateNested()
  address!: Address; // ❌ Error: @Type(() => Profile) doesn't match Address

  @ValidateNested()
  contact!: Contact; // ❌ Error: Missing @Type(() => Contact)

  @Type(() => Item)
  @ValidateNested({each: true})
  items!: Item[]; // ✅ Correct - @Type matches array element type
}
```

### `definite-assignment-match`

Ensures properties with decorators use definite assignment assertion (`!`) when required.

**Examples:**

```typescript
import {IsString, IsOptional} from 'class-validator';

class User {
  @IsString()
  name!: string; // ✅ Correct - has definite assignment

  @IsString()
  email: string; // ❌ Error: Missing definite assignment assertion (!)

  @IsOptional()
  @IsString()
  bio?: string; // ✅ Correct - optional property doesn't need !

  @IsString()
  nickname: string = 'default'; // ✅ Correct - has initializer

  @IsString()
  description: string | undefined; // ✅ Correct - has undefined in type
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

### `dto-filename-match`

Ensures DTO class names match their file naming convention.

**File Naming Rules:**

- Files structured like `.<type>.dto.ts` (e.g., `.body.dto.ts`, `.query.dto.ts`, `.param.dto.ts`) should have class names ending with `<Type>Dto` (e.g., `BodyDto`, `QueryDto`, `ParamDto`)
- Files structured like `.dto.ts` should have class names ending with `Dto`

**Examples:**

```typescript
// File: create-user.body.dto.ts
import {IsString, IsEmail} from 'class-validator';

export class CreateUserBodyDto {
  // ✅ Correct - ends with BodyDto
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;
}

// File: create-user.body.dto.ts
export class CreateUserDto {
  // ❌ Error: Expected class name to end with "BodyDto"
  @IsString()
  name!: string;
}

// File: update-profile.query.dto.ts
export class UpdateProfileQueryDto {
  // ✅ Correct - ends with QueryDto
  @IsString()
  filter?: string;
}

// File: user.dto.ts
export class UserDto {
  // ✅ Correct - ends with Dto
  @IsString()
  id!: string;
}

// File: user.dto.ts
export class User {
  // ❌ Error: Expected class name to end with "Dto"
  @IsString()
  id!: string;
}

// File: get-user.param.dto.ts
export class GetUserParamDto {
  // ✅ Correct - ends with ParamDto
  @IsString()
  userId!: string;
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
- `@Type`
- `@Transform`

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
