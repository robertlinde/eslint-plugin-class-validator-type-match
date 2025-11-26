import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import type * as ts from 'typescript';
import {getTypeString} from '../utils/type-helpers.util';

/**
 * Creates an ESLint rule with proper documentation URL
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/robertlinde/eslint-plugin-class-validator-type-match#${name}`,
);

type MessageIds = 'incorrectDefiniteAssignment';

type Options = [];

/**
 * ESLint rule to ensure definite assignment assertion (!) is used correctly with decorators.
 *
 * This rule validates that:
 * - Properties with ! should NOT have:
 *   - Optional marker (?)
 *   - An initializer (= value)
 *   - undefined in their type
 *
 * @example
 * // ✅ Good - ! without optional or initializer
 * class User {
 *   @IsString()
 *   name!: string;
 * }
 *
 * @example
 * // ✅ Good - no ! is also fine for non-optional
 * class User {
 *   @IsString()
 *   name: string;
 * }
 *
 * @example
 * // ✅ Good - optional property without !
 * class User {
 *   @IsOptional()
 *   @IsString()
 *   name?: string;
 * }
 *
 * @example
 * // ✅ Good - has initializer without !
 * class User {
 *   @IsString()
 *   name: string = 'default';
 * }
 *
 * @example
 * // ✅ Good - has undefined in type without !
 * class User {
 *   @IsString()
 *   name: string | undefined;
 * }
 *
 * @example
 * // ❌ Bad - ! with optional property
 * class User {
 *   @IsOptional()
 *   @IsString()
 *   name?!: string;
 * }
 *
 * @example
 * // ❌ Bad - ! with initializer
 * class User {
 *   @IsString()
 *   name!: string = 'default';
 * }
 *
 * @example
 * // ❌ Bad - ! with undefined in type
 * class User {
 *   @IsString()
 *   name!: string | undefined;
 * }
 */
export default createRule<Options, MessageIds>({
  name: 'definite-assignment-match',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure definite assignment assertion (!) is not used with optional properties, initializers, or undefined types',
    },
    messages: {
      incorrectDefiniteAssignment:
        'Property {{propertyName}} should not use definite assignment assertion (!) because it {{reason}}. Remove the ! from: {{propertyName}}!',
    },
    schema: [],
    fixable: 'code',
  },
  defaultOptions: [],
  create(context) {
    // Get TypeScript type checker if available
    let checker: ts.TypeChecker | null = null;
    let esTreeNodeMap: {get(key: TSESTree.Node): ts.Node | undefined} | null = null;

    try {
      const parserServices = context.parserServices;
      if (parserServices?.program && parserServices?.esTreeNodeToTSNodeMap) {
        checker = parserServices.program.getTypeChecker();
        esTreeNodeMap = parserServices.esTreeNodeToTSNodeMap;
      }
    } catch {
      // Type checker not available, continue with AST-only analysis
    }

    return {
      /**
       * Analyzes class property definitions to validate definite assignment assertion usage
       */
      PropertyDefinition(node: TSESTree.PropertyDefinition) {
        // Skip if no decorators present
        if (!node.decorators || node.decorators.length === 0) return;
        // Skip if no type annotation
        if (!node.typeAnnotation) return;

        const {typeAnnotation} = node.typeAnnotation;
        const actualType = getTypeString(typeAnnotation, checker, esTreeNodeMap);

        // Skip if we couldn't determine the type
        if (!actualType) return;

        /**
         * Check for incorrect usage of definite assignment assertion (!)
         * Properties should NOT use ! if they:
         * - Are optional (have ?)
         * - Have an initializer (= value)
         * - Have undefined in their type
         */
        const isOptionalProperty = node.optional === true;
        const hasInitializer = node.value !== undefined && node.value !== null;
        const hasDefiniteAssignment = node.definite === true;
        const hasUndefinedInType =
          typeAnnotation.type === 'TSUndefinedKeyword' ||
          (typeAnnotation.type === 'TSUnionType' && typeAnnotation.types.some((t) => t.type === 'TSUndefinedKeyword'));

        // If property has definite assignment (!), check if it's used incorrectly
        if (hasDefiniteAssignment) {
          const propertyName = node.key.type === 'Identifier' ? node.key.name : 'property';
          let reason: string | null = null;

          if (isOptionalProperty) {
            reason = 'is optional (has ?)';
          } else if (hasInitializer) {
            reason = 'has an initializer';
          } else if (hasUndefinedInType) {
            reason = 'has undefined in its type';
          }

          if (reason) {
            context.report({
              node,
              messageId: 'incorrectDefiniteAssignment',
              data: {
                propertyName,
                reason,
              },
              fix(fixer) {
                // Remove the ! after the property key
                const keyEnd = node.key.range[1];
                // The ! is between the key and the optional marker or colon
                return fixer.removeRange([keyEnd, keyEnd + 1]);
              },
            });
          }
        }
      },
    };
  },
});
