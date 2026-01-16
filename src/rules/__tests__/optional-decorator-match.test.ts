import {RuleTester} from '@typescript-eslint/rule-tester';
import * as vitest from 'vitest';
import rule from '../optional-decorator-match';

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;

const ruleTester = new RuleTester();

ruleTester.run('optional-decorator-match', rule, {
  valid: [
    // @IsOptional with optional property
    {
      code: `
        class User {
          @IsOptional()
          @IsString()
          name?: string;
        }
      `,
    },
    // Required property without @IsOptional
    {
      code: `
        class User {
          @IsString()
          name!: string;
        }
      `,
    },
    // Property with default value (skipped by default)
    {
      code: `
        class User {
          @IsString()
          name: string = 'default';
        }
      `,
    },
    // No decorators - should be skipped
    {
      code: `
        class User {
          name?: string;
        }
      `,
    },
    // Custom optional decorator with option
    {
      code: `
        class User {
          @CustomOptional()
          @IsString()
          name?: string;
        }
      `,
      options: [{customOptionalDecorators: ['CustomOptional']}],
    },
    // @IsOptional with null and undefined in union - has redundant undefined
    // This will be in invalid because ? already adds undefined
    // So we'll skip this valid case
    // Private property with # syntax
    {
      code: `
        class User {
          @IsOptional()
          @IsString()
          #name?: string;
        }
      `,
    },
    // Literal property key
    {
      code: `
        class User {
          @IsOptional()
          @IsString()
          'my-name'?: string;
        }
      `,
    },
    // strictNullChecks disabled - undefined union is ok without decorator
    {
      code: `
        class User {
          @IsString()
          name: string | undefined;
        }
      `,
      options: [{strictNullChecks: false}],
    },
    // checkDefaultValues enabled - property with value is checked
    {
      code: `
        class User {
          @IsOptional()
          @IsString()
          name?: string = 'default';
        }
      `,
      options: [{checkDefaultValues: true}],
    },
  ],
  invalid: [
    // Optional property missing @IsOptional
    {
      code: `
        class User {
          @IsString()
          name?: string;
        }
      `,
      errors: [
        {
          messageId: 'missingOptionalDecorator',
        },
      ],
    },
    // @IsOptional without optional syntax
    {
      code: `
        class User {
          @IsOptional()
          @IsString()
          name: string;
        }
      `,
      output: `
        class User {
          @IsOptional()
          @IsString()
          name?: string;
        }
      `,
      errors: [
        {
          messageId: 'missingOptionalSyntax',
        },
      ],
    },
    // @IsOptional with definite assignment (!)
    {
      code: `
        class User {
          @IsOptional()
          @IsString()
          name!: string;
        }
      `,
      errors: [
        {
          messageId: 'conflictingDefiniteAssignment',
        },
      ],
    },
    // Union with undefined missing @IsOptional (strictNullChecks enabled)
    {
      code: `
        class User {
          @IsString()
          name: string | undefined;
        }
      `,
      errors: [
        {
          messageId: 'undefinedUnionWithoutDecorator',
        },
      ],
    },
    // @IsOptional with null in union (should use undefined)
    {
      code: `
        class User {
          @IsOptional()
          @IsString()
          name: string | null;
        }
      `,
      errors: [
        {
          messageId: 'nullUnionIncorrect',
        },
      ],
    },
    // @IsOptional with undefined union but no ? syntax (requires multiple fix passes)
    {
      code: `
        class User {
          @IsOptional()
          @IsString()
          name: string | undefined;
        }
      `,
      output: [
        `
        class User {
          @IsOptional()
          @IsString()
          name?: string | undefined;
        }
      `,
        `
        class User {
          @IsOptional()
          @IsString()
          name?: string;
        }
      `,
      ],
      errors: [
        {
          messageId: 'undefinedUnionWithoutOptional',
        },
      ],
    },
    // Redundant undefined in type with optional syntax
    {
      code: `
        class User {
          @IsOptional()
          @IsString()
          name?: string | undefined;
        }
      `,
      output: `
        class User {
          @IsOptional()
          @IsString()
          name?: string;
        }
      `,
      errors: [
        {
          messageId: 'redundantUndefinedInType',
        },
      ],
    },
  ],
});
