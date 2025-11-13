import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import * as path from 'path';

/**
 * Creates an ESLint rule with proper documentation URL
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/robertlinde/eslint-plugin-class-validator-type-match#${name}`,
);

type MessageIds = 'incorrectDtoClassName';
type Options = [];

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * ESLint rule to ensure DTO class names match their file naming convention.
 *
 * This rule enforces consistent naming between DTO files and their class names:
 * - Files like `.body.dto.ts`, `.query.dto.ts`, `.param.dto.ts` should have classes named `BodyDto`, `QueryDto`, `ParamDto`
 * - Files like `.dto.ts` should have classes named `Dto`
 *
 * The rule extracts the type identifier (body, query, param, etc.) from the filename
 * and validates that the class name follows the pattern `<Type>Dto` where `<Type>` is capitalized.
 *
 * @example
 * // ✅ Good - file: create-user.body.dto.ts
 * class CreateUserBodyDto {
 *   @IsString()
 *   name!: string;
 * }
 *
 * @example
 * // ❌ Bad - file: create-user.body.dto.ts
 * class CreateUserDto { // Error: Expected CreateUserBodyDto
 *   @IsString()
 *   name!: string;
 * }
 *
 * @example
 * // ✅ Good - file: user.dto.ts
 * class UserDto {
 *   @IsString()
 *   name!: string;
 * }
 *
 * @example
 * // ❌ Bad - file: user.dto.ts
 * class User { // Error: Expected UserDto
 *   @IsString()
 *   name!: string;
 * }
 *
 * @example
 * // ✅ Good - file: update-profile.query.dto.ts
 * class UpdateProfileQueryDto {
 *   @IsString()
 *   filter?: string;
 * }
 */
export default createRule<Options, MessageIds>({
  name: 'dto-filename-match',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure DTO class names match their file naming convention. Files structured like .<type>.dto.ts should have class names like <Type>Dto',
    },
    messages: {
      incorrectDtoClassName:
        'Class name "{{className}}" does not match the DTO file naming convention. Expected class name to end with "{{expectedSuffix}}" based on filename "{{filename}}".',
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context) {
    // Get the filename of the current file being linted
    const filename = context.filename || context.getFilename();
    const basename = path.basename(filename);

    // Pattern to match DTO files: .<type>.dto.ts or .dto.ts
    const dtoPatternWithType = /\.([a-zA-Z]+)\.dto\.ts$/;
    const dtoPatternSimple = /\.dto\.ts$/;

    let expectedSuffix: string | null = null;

    // Check if file matches .<type>.dto.ts pattern (e.g., .body.dto.ts, .query.dto.ts)
    const typeMatch = basename.match(dtoPatternWithType);
    if (typeMatch && typeMatch[1]) {
      const type = typeMatch[1].toLowerCase();
      // Only process if the type is not just "dto" itself
      // (to distinguish .body.dto.ts from .dto.ts)
      if (type !== 'dto') {
        expectedSuffix = `${capitalize(type)}Dto`;
      }
    }

    // Check if file matches .dto.ts pattern (e.g., user.dto.ts)
    if (expectedSuffix === null && dtoPatternSimple.test(basename)) {
      expectedSuffix = 'Dto';
    }

    // If this is not a DTO file, skip validation
    if (expectedSuffix === null) {
      return {};
    }

    return {
      /**
       * Check class declarations to ensure they end with the expected suffix
       */
      ClassDeclaration(node: TSESTree.ClassDeclaration) {
        // Skip anonymous classes
        if (!node.id || !node.id.name) return;

        const className = node.id.name;

        // Check if the class name ends with the expected suffix
        if (!className.endsWith(expectedSuffix!)) {
          context.report({
            node: node.id,
            messageId: 'incorrectDtoClassName',
            data: {
              className,
              expectedSuffix: expectedSuffix!,
              filename: basename,
            },
          });
        }
      },
    };
  },
});
