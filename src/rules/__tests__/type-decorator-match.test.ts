import {RuleTester} from '@typescript-eslint/rule-tester';
import * as vitest from 'vitest';
import rule from '../type-decorator-match';

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;

const ruleTester = new RuleTester();

ruleTester.run('type-decorator-match', rule, {
  valid: [
    // @Type matches type annotation
    {
      code: `
        class Address {}
        class User {
          @Type(() => Address)
          @ValidateNested()
          address!: Address;
        }
      `,
    },
    // @Type matches array element type
    {
      code: `
        class Address {}
        class User {
          @Type(() => Address)
          @ValidateNested({ each: true })
          addresses!: Address[];
        }
      `,
    },
    // Primitive wrapper class match
    {
      code: `
        class User {
          @Type(() => Number)
          age!: number;
        }
      `,
    },
    {
      code: `
        class User {
          @Type(() => String)
          name!: string;
        }
      `,
    },
    {
      code: `
        class User {
          @Type(() => Boolean)
          active!: boolean;
        }
      `,
    },
    // Array of primitive wrappers
    {
      code: `
        class User {
          @Type(() => Number)
          scores!: number[];
        }
      `,
    },
    // No @ValidateNested - doesn't require @Type
    {
      code: `
        class Address {}
        class User {
          @IsDefined()
          address!: Address;
        }
      `,
    },
    // Enum with @IsEnum doesn't need @Type
    {
      code: `
        enum Status { ACTIVE, INACTIVE }
        class User {
          @ValidateNested()
          @IsEnum(Status)
          status!: Status;
        }
      `,
    },
    // No decorators
    {
      code: `
        class Address {}
        class User {
          address!: Address;
        }
      `,
    },
    // Array with @IsEnum({ each: true }) doesn't need @Type
    {
      code: `
        enum Role { ADMIN, USER }
        class User {
          @ValidateNested({ each: true })
          @IsEnum(Role, { each: true })
          roles!: Role[];
        }
      `,
    },
  ],
  invalid: [
    // @Type class name doesn't match type
    {
      code: `
        class Address {}
        class Profile {}
        class User {
          @Type(() => Profile)
          @ValidateNested()
          address!: Address;
        }
      `,
      errors: [
        {
          messageId: 'typeMismatch',
          data: {
            typeDecoratorClass: 'Profile',
            actualType: 'Address',
          },
        },
      ],
    },
    // @Type class name doesn't match array element type
    {
      code: `
        class Address {}
        class Profile {}
        class User {
          @Type(() => Profile)
          @ValidateNested({ each: true })
          addresses!: Address[];
        }
      `,
      errors: [
        {
          messageId: 'typeMismatch',
          data: {
            typeDecoratorClass: 'Profile',
            actualType: 'Address[]',
          },
        },
      ],
    },
    // Missing @Type with @ValidateNested for complex type
    {
      code: `
        class Address {}
        class User {
          @ValidateNested()
          address!: Address;
        }
      `,
      errors: [
        {
          messageId: 'missingTypeDecorator',
          data: {
            actualType: 'Address',
            className: 'Address',
          },
        },
      ],
    },
    // Missing @Type with @ValidateNested for array of complex types
    {
      code: `
        class Address {}
        class User {
          @ValidateNested({ each: true })
          addresses!: Address[];
        }
      `,
      errors: [
        {
          messageId: 'missingTypeDecorator',
          data: {
            actualType: 'Address[]',
            className: 'Address',
          },
        },
      ],
    },
    // @Type with wrong primitive wrapper
    {
      code: `
        class User {
          @Type(() => String)
          age!: number;
        }
      `,
      errors: [
        {
          messageId: 'typeMismatch',
          data: {
            typeDecoratorClass: 'String',
            actualType: 'number',
          },
        },
      ],
    },
    // Missing @Type with @ValidateNested for nullable complex type
    {
      code: `
        class Address {}
        class User {
          @ValidateNested()
          address!: Address | null;
        }
      `,
      errors: [
        {
          messageId: 'missingTypeDecorator',
          data: {
            actualType: 'Address',
            className: 'Address',
          },
        },
      ],
    },
    // @Type with wrong wrapper for array of primitives
    {
      code: `
        class User {
          @Type(() => String)
          scores!: number[];
        }
      `,
      errors: [
        {
          messageId: 'typeMismatch',
          data: {
            typeDecoratorClass: 'String',
            actualType: 'number[]',
          },
        },
      ],
    },
    // Missing @Type with @ValidateNested for array of nullable complex types
    {
      code: `
        class Address {}
        class User {
          @ValidateNested({ each: true })
          addresses!: (Address | null)[];
        }
      `,
      errors: [
        {
          messageId: 'missingTypeDecorator',
          data: {
            actualType: 'union[]',
            className: 'Address',
          },
        },
      ],
    },
  ],
});
