import {RuleTester} from '@typescript-eslint/rule-tester';
import * as vitest from 'vitest';
import rule from '../definite-assignment-match';

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;

const ruleTester = new RuleTester();

ruleTester.run('definite-assignment-match', rule, {
  valid: [
    // Correct usage of !
    {
      code: `
        class User {
          @IsString()
          name!: string;
        }
      `,
    },
    // No ! is also fine
    {
      code: `
        class User {
          @IsString()
          name: string;
        }
      `,
    },
    // Optional property without !
    {
      code: `
        class User {
          @IsOptional()
          @IsString()
          name?: string;
        }
      `,
    },
    // Initializer without !
    {
      code: `
        class User {
          @IsString()
          name: string = 'default';
        }
      `,
    },
    // Undefined in type without !
    {
      code: `
        class User {
          @IsString()
          name: string | undefined;
        }
      `,
    },
    // No decorators - skipped
    {
      code: `
        class User {
          name!: string;
        }
      `,
    },
    // No type annotation - skipped
    {
      code: `
        class User {
          @IsString()
          name!;
        }
      `,
    },
    // Complex type with !
    {
      code: `
        class Address {}
        class User {
          @ValidateNested()
          address!: Address;
        }
      `,
    },
    // Array type with !
    {
      code: `
        class User {
          @IsString({ each: true })
          tags!: string[];
        }
      `,
    },
    // Nullable type without undefined (valid with !)
    {
      code: `
        class User {
          @IsString()
          name!: string | null;
        }
      `,
    },
  ],
  invalid: [
    // ! with initializer
    {
      code: `
        class User {
          @IsString()
          name!: string = 'default';
        }
      `,
      output: `
        class User {
          @IsString()
          name: string = 'default';
        }
      `,
      errors: [
        {
          messageId: 'incorrectDefiniteAssignment',
          data: {
            propertyName: 'name',
            reason: 'has an initializer',
          },
        },
      ],
    },
    // ! with undefined in type
    {
      code: `
        class User {
          @IsString()
          name!: string | undefined;
        }
      `,
      output: `
        class User {
          @IsString()
          name: string | undefined;
        }
      `,
      errors: [
        {
          messageId: 'incorrectDefiniteAssignment',
          data: {
            propertyName: 'name',
            reason: 'has undefined in its type',
          },
        },
      ],
    },
    // ! with undefined in nullable union type
    {
      code: `
        class User {
          @IsString()
          name!: string | null | undefined;
        }
      `,
      output: `
        class User {
          @IsString()
          name: string | null | undefined;
        }
      `,
      errors: [
        {
          messageId: 'incorrectDefiniteAssignment',
          data: {
            propertyName: 'name',
            reason: 'has undefined in its type',
          },
        },
      ],
    },
    // ! with number type and initializer
    {
      code: `
        class User {
          @IsNumber()
          age!: number = 0;
        }
      `,
      output: `
        class User {
          @IsNumber()
          age: number = 0;
        }
      `,
      errors: [
        {
          messageId: 'incorrectDefiniteAssignment',
          data: {
            propertyName: 'age',
            reason: 'has an initializer',
          },
        },
      ],
    },
  ],
});
