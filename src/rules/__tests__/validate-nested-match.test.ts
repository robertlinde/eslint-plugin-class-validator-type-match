import {RuleTester} from '@typescript-eslint/rule-tester';
import * as vitest from 'vitest';
import rule from '../validate-nested-match';

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;

const ruleTester = new RuleTester();

ruleTester.run('validate-nested-match', rule, {
  valid: [
    // Complex type with @ValidateNested
    {
      code: `
        class Address {}
        class User {
          @ValidateNested()
          @Type(() => Address)
          address!: Address;
        }
      `,
    },
    // Array of complex types with @ValidateNested({ each: true })
    {
      code: `
        class Address {}
        class User {
          @ValidateNested({ each: true })
          @Type(() => Address)
          addresses!: Address[];
        }
      `,
    },
    // Primitive types don't need @ValidateNested
    {
      code: `
        class User {
          @IsString()
          name!: string;
        }
      `,
    },
    // Array of primitives with appropriate decorator
    {
      code: `
        class User {
          @IsString({ each: true })
          tags!: string[];
        }
      `,
    },
    // Enum array with @IsEnum({ each: true })
    {
      code: `
        enum Role { ADMIN, USER }
        class User {
          @IsEnum(Role, { each: true })
          roles!: Role[];
        }
      `,
    },
    // No decorators - should be skipped
    {
      code: `
        class Address {}
        class User {
          address!: Address;
        }
      `,
    },
    // Date type (not considered complex)
    {
      code: `
        class User {
          @IsDate()
          createdAt!: Date;
        }
      `,
    },
  ],
  invalid: [
    // Complex type missing @ValidateNested
    {
      code: `
        class Address {}
        class User {
          @IsDefined()
          address!: Address;
        }
      `,
      errors: [
        {
          messageId: 'missingValidateNested',
        },
      ],
    },
    // Array of complex types missing @ValidateNested
    {
      code: `
        class Address {}
        class User {
          @IsDefined()
          addresses!: Address[];
        }
      `,
      errors: [
        {
          messageId: 'nestedArrayMismatch',
        },
      ],
    },
    // Array of complex types with @ValidateNested but missing { each: true }
    {
      code: `
        class Address {}
        class User {
          @ValidateNested()
          @Type(() => Address)
          addresses!: Address[];
        }
      `,
      errors: [
        {
          messageId: 'missingEachOption',
        },
      ],
    },
    // Primitive array with unnecessary @ValidateNested
    {
      code: `
        class User {
          @ValidateNested()
          tags!: string[];
        }
      `,
      errors: [
        {
          messageId: 'unnecessaryValidateNested',
        },
      ],
    },
    // Tuple with complex elements (warning)
    {
      code: `
        class Address {}
        class User {
          @IsDefined()
          pair!: [Address, string];
        }
      `,
      errors: [
        {
          messageId: 'tupleValidationWarning',
        },
      ],
    },
    // Union with multiple complex types (warning) - reports 2 errors
    {
      code: `
        class Address {}
        class Profile {}
        class User {
          @IsDefined()
          data!: Address | Profile;
        }
      `,
      errors: [
        {
          messageId: 'multiTypeUnionWarning',
        },
        {
          messageId: 'missingValidateNested',
        },
      ],
    },
    // Mixed complexity union (primitives + complex types) - reports 2 errors
    {
      code: `
        class Address {}
        class User {
          @IsDefined()
          value!: string | Address;
        }
      `,
      errors: [
        {
          messageId: 'mixedComplexityUnionWarning',
        },
        {
          messageId: 'missingValidateNested',
        },
      ],
    },
    // Pick/Omit utility type warning
    {
      code: `
        class Address {
          street!: string;
          city!: string;
        }
        class User {
          @IsDefined()
          partial!: Pick<Address, 'street'>;
        }
      `,
      errors: [
        {
          messageId: 'pickOmitWarning',
        },
      ],
    },
    // Omit utility type warning
    {
      code: `
        class Address {
          street!: string;
          city!: string;
        }
        class User {
          @IsDefined()
          partial!: Omit<Address, 'city'>;
        }
      `,
      errors: [
        {
          messageId: 'pickOmitWarning',
        },
      ],
    },
    // Number array with unnecessary @ValidateNested
    {
      code: `
        class User {
          @ValidateNested()
          scores!: number[];
        }
      `,
      errors: [
        {
          messageId: 'unnecessaryValidateNested',
        },
      ],
    },
  ],
});
