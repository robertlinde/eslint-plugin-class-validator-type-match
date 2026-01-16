import {RuleTester} from '@typescript-eslint/rule-tester';
import * as vitest from 'vitest';
import rule from '../dto-filename-match';

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;

const ruleTester = new RuleTester();

ruleTester.run('dto-filename-match', rule, {
  valid: [
    // *.body.dto.ts with BodyDto suffix
    {
      code: `
        class CreateUserBodyDto {
          @IsString()
          name!: string;
        }
      `,
      filename: 'create-user.body.dto.ts',
    },
    // *.query.dto.ts with QueryDto suffix
    {
      code: `
        class GetUsersQueryDto {
          @IsString()
          filter?: string;
        }
      `,
      filename: 'get-users.query.dto.ts',
    },
    // *.param.dto.ts with ParamDto suffix
    {
      code: `
        class UserParamDto {
          @IsUUID()
          id!: string;
        }
      `,
      filename: 'user.param.dto.ts',
    },
    // *.dto.ts with Dto suffix
    {
      code: `
        class UserDto {
          @IsString()
          name!: string;
        }
      `,
      filename: 'user.dto.ts',
    },
    // Non-DTO file - skipped
    {
      code: `
        class User {
          name!: string;
        }
      `,
      filename: 'user.ts',
    },
    // Multiple classes in a file - all must match
    {
      code: `
        class CreateUserBodyDto {
          @IsString()
          name!: string;
        }
        class UpdateUserBodyDto {
          @IsString()
          name?: string;
        }
      `,
      filename: 'user.body.dto.ts',
    },
    // Response DTO
    {
      code: `
        class UserResponseDto {
          @IsString()
          name!: string;
        }
      `,
      filename: 'user.response.dto.ts',
    },
  ],
  invalid: [
    // *.body.dto.ts without BodyDto suffix
    {
      code: `
        class CreateUserDto {
          @IsString()
          name!: string;
        }
      `,
      filename: 'create-user.body.dto.ts',
      errors: [
        {
          messageId: 'incorrectDtoClassName',
          data: {
            className: 'CreateUserDto',
            expectedSuffix: 'BodyDto',
            filename: 'create-user.body.dto.ts',
          },
        },
      ],
    },
    // *.query.dto.ts without QueryDto suffix
    {
      code: `
        class GetUsersDto {
          @IsString()
          filter?: string;
        }
      `,
      filename: 'get-users.query.dto.ts',
      errors: [
        {
          messageId: 'incorrectDtoClassName',
          data: {
            className: 'GetUsersDto',
            expectedSuffix: 'QueryDto',
            filename: 'get-users.query.dto.ts',
          },
        },
      ],
    },
    // *.dto.ts without Dto suffix
    {
      code: `
        class User {
          @IsString()
          name!: string;
        }
      `,
      filename: 'user.dto.ts',
      errors: [
        {
          messageId: 'incorrectDtoClassName',
          data: {
            className: 'User',
            expectedSuffix: 'Dto',
            filename: 'user.dto.ts',
          },
        },
      ],
    },
    // *.param.dto.ts without ParamDto suffix
    {
      code: `
        class UserDto {
          @IsUUID()
          id!: string;
        }
      `,
      filename: 'user.param.dto.ts',
      errors: [
        {
          messageId: 'incorrectDtoClassName',
          data: {
            className: 'UserDto',
            expectedSuffix: 'ParamDto',
            filename: 'user.param.dto.ts',
          },
        },
      ],
    },
  ],
});
