import {RuleTester} from '@typescript-eslint/rule-tester';
import * as vitest from 'vitest';
import rule from '../decorator-type-match';

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;

const ruleTester = new RuleTester();

ruleTester.run('decorator-type-match', rule, {
  valid: [
    // Basic type matches
    {
      code: `
        class User {
          @IsString()
          name!: string;
        }
      `,
    },
    {
      code: `
        class User {
          @IsNumber()
          age!: number;
        }
      `,
    },
    {
      code: `
        class User {
          @IsBoolean()
          active!: boolean;
        }
      `,
    },
    {
      code: `
        class User {
          @IsDate()
          createdAt!: Date;
        }
      `,
    },
    // Array with { each: true }
    {
      code: `
        class User {
          @IsString({ each: true })
          tags!: string[];
        }
      `,
    },
    {
      code: `
        class User {
          @IsNumber({}, { each: true })
          scores!: number[];
        }
      `,
    },
    // Nullable unions
    {
      code: `
        class User {
          @IsString()
          name!: string | null;
        }
      `,
    },
    {
      code: `
        class User {
          @IsNumber()
          age!: number | undefined;
        }
      `,
    },
    // Enum types
    {
      code: `
        enum Status { ACTIVE, INACTIVE }
        class User {
          @IsEnum(Status)
          status!: Status;
        }
      `,
    },
    // Union of literal types (valid for @IsEnum)
    {
      code: `
        class User {
          @IsEnum(['active', 'inactive'])
          status!: 'active' | 'inactive';
        }
      `,
    },
    // Type-agnostic decorators should not trigger
    {
      code: `
        class User {
          @IsOptional()
          name?: string;
        }
      `,
    },
    {
      code: `
        class User {
          @IsDefined()
          name!: string;
        }
      `,
    },
    // Integer types
    {
      code: `
        class User {
          @IsInt()
          count!: number;
        }
      `,
    },
    // Positive/Negative number validators
    {
      code: `
        class User {
          @IsPositive()
          amount!: number;
        }
      `,
    },
    {
      code: `
        class User {
          @IsNegative()
          debt!: number;
        }
      `,
    },
    // UUID, email, etc. - all are string types
    {
      code: `
        class User {
          @IsUUID()
          id!: string;
        }
      `,
    },
    {
      code: `
        class User {
          @IsEmail()
          email!: string;
        }
      `,
    },
    // Array types
    {
      code: `
        class User {
          @IsArray()
          items!: string[];
        }
      `,
    },
    // Object type
    {
      code: `
        class User {
          @IsObject()
          metadata!: object;
        }
      `,
    },
    // @IsObject with Record<K, V> - Record is an object type
    {
      code: `
        class User {
          @IsObject()
          permissions!: Record<string, boolean>;
        }
      `,
    },
    // @IsNotEmptyObject with Record<K, V>
    {
      code: `
        class User {
          @IsNotEmptyObject()
          settings!: Record<string, string>;
        }
      `,
    },
    // @IsObject with Partial<T>
    {
      code: `
        interface Config { foo: string; bar: number; }
        class User {
          @IsObject()
          config!: Partial<Config>;
        }
      `,
    },
    // @IsObject with Pick<T, K>
    {
      code: `
        interface User { id: string; name: string; email: string; }
        class UpdateDto {
          @IsObject()
          data!: Pick<User, 'name' | 'email'>;
        }
      `,
    },
    // @IsObject with Omit<T, K>
    {
      code: `
        interface User { id: string; name: string; password: string; }
        class PublicUser {
          @IsObject()
          user!: Omit<User, 'password'>;
        }
      `,
    },
    // @IsObject with Required<T>
    {
      code: `
        interface Config { foo?: string; bar?: number; }
        class User {
          @IsObject()
          config!: Required<Config>;
        }
      `,
    },
    // @IsObject with Readonly<T>
    {
      code: `
        interface Config { foo: string; }
        class User {
          @IsObject()
          config!: Readonly<Config>;
        }
      `,
    },
    // Using Array<T> generic syntax
    {
      code: `
        class User {
          @IsString({ each: true })
          tags!: Array<string>;
        }
      `,
    },
    // @IsEnum with array and { each: true }
    {
      code: `
        enum Role { ADMIN, USER }
        class User {
          @IsEnum(Role, { each: true })
          roles!: Role[];
        }
      `,
    },
    // No type annotation - should skip
    {
      code: `
        class User {
          @IsString()
          name;
        }
      `,
    },
    // URL string validator
    {
      code: `
        class User {
          @IsUrl()
          website!: string;
        }
      `,
    },
    // Phone number validator
    {
      code: `
        class User {
          @IsPhoneNumber()
          phone!: string;
        }
      `,
    },
    // Decimal number validator
    {
      code: `
        class User {
          @IsDecimal()
          price!: string;
        }
      `,
    },
    // IsNotEmpty with string
    {
      code: `
        class User {
          @IsNotEmpty()
          name!: string;
        }
      `,
    },
  ],
  invalid: [
    // Type mismatch: @IsString with number
    {
      code: `
        class User {
          @IsString()
          age!: number;
        }
      `,
      errors: [
        {
          messageId: 'mismatch',
          data: {
            decorator: 'IsString',
            actualType: 'number',
            expectedTypes: 'string',
          },
        },
      ],
    },
    // Type mismatch: @IsNumber with string
    {
      code: `
        class User {
          @IsNumber()
          name!: string;
        }
      `,
      errors: [
        {
          messageId: 'mismatch',
          data: {
            decorator: 'IsNumber',
            actualType: 'string',
            expectedTypes: 'number',
          },
        },
      ],
    },
    // Type mismatch: @IsBoolean with string
    {
      code: `
        class User {
          @IsBoolean()
          name!: string;
        }
      `,
      errors: [
        {
          messageId: 'mismatch',
          data: {
            decorator: 'IsBoolean',
            actualType: 'string',
            expectedTypes: 'boolean',
          },
        },
      ],
    },
    // Invalid { each: true } on non-array
    {
      code: `
        class User {
          @IsString({ each: true })
          name!: string;
        }
      `,
      errors: [
        {
          messageId: 'invalidEachOption',
          data: {
            decorator: 'IsString',
          },
        },
      ],
    },
    // @IsDate with string
    {
      code: `
        class User {
          @IsDate()
          name!: string;
        }
      `,
      errors: [
        {
          messageId: 'mismatch',
          data: {
            decorator: 'IsDate',
            actualType: 'string',
            expectedTypes: 'Date',
          },
        },
      ],
    },
    // @IsEnum mismatch
    {
      code: `
        enum Status { ACTIVE, INACTIVE }
        enum Role { ADMIN, USER }
        class User {
          @IsEnum(Role)
          status!: Status;
        }
      `,
      errors: [
        {
          messageId: 'enumMismatch',
          data: {
            enumArg: 'Role',
            actualType: 'Status',
          },
        },
      ],
    },
    // @IsInt with string
    {
      code: `
        class User {
          @IsInt()
          name!: string;
        }
      `,
      errors: [
        {
          messageId: 'mismatch',
          data: {
            decorator: 'IsInt',
            actualType: 'string',
            expectedTypes: 'number',
          },
        },
      ],
    },
    // @IsEmail with number
    {
      code: `
        class User {
          @IsEmail()
          age!: number;
        }
      `,
      errors: [
        {
          messageId: 'mismatch',
          data: {
            decorator: 'IsEmail',
            actualType: 'number',
            expectedTypes: 'string',
          },
        },
      ],
    },
    // @IsArray with non-array type
    {
      code: `
        class User {
          @IsArray()
          name!: string;
        }
      `,
      errors: [
        {
          messageId: 'mismatch',
          data: {
            decorator: 'IsArray',
            actualType: 'string',
            expectedTypes: 'array or Array',
          },
        },
      ],
    },
    // @IsObject with string
    {
      code: `
        class User {
          @IsObject()
          name!: string;
        }
      `,
      errors: [
        {
          messageId: 'mismatch',
          data: {
            decorator: 'IsObject',
            actualType: 'string',
            expectedTypes: 'object',
          },
        },
      ],
    },
    // @IsUrl with number
    {
      code: `
        class User {
          @IsUrl()
          website!: number;
        }
      `,
      errors: [
        {
          messageId: 'mismatch',
          data: {
            decorator: 'IsUrl',
            actualType: 'number',
            expectedTypes: 'string',
          },
        },
      ],
    },
    // @IsUUID with boolean
    {
      code: `
        class User {
          @IsUUID()
          id!: boolean;
        }
      `,
      errors: [
        {
          messageId: 'mismatch',
          data: {
            decorator: 'IsUUID',
            actualType: 'boolean',
            expectedTypes: 'string',
          },
        },
      ],
    },
    // Invalid { each: true } on non-array with @IsNumber
    {
      code: `
        class User {
          @IsNumber({}, { each: true })
          score!: number;
        }
      `,
      errors: [
        {
          messageId: 'invalidEachOption',
          data: {
            decorator: 'IsNumber',
          },
        },
      ],
    },
  ],
});
