import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import type * as ts from 'typescript';
import {getTypeString} from '../utils/type-helpers.util';

/**
 * Creates an ESLint rule with proper documentation URL
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/robertlinde/eslint-plugin-class-validator-type-match#${name}`,
);

type MessageIds = 'missingDefiniteAssignment';

type Options = [];

/**
 * ESLint rule to ensure properties with decorators use definite assignment assertion (!) when required.
 *
 * This rule validates that:
 * - Properties with decorators that are not optional (no ?)
 * - Don't have an initializer (no = value)
 * - Don't have undefined in their type
 * - Use the definite assignment assertion (!)
 *
 * Note: Properties with | null still require ! unless they also have ?
 *
 * @example
 * // ✅ Good - has definite assignment assertion
 * class User {
 *   @IsString()
 *   name!: string;
 * }
 *
 * @example
 * // ✅ Good - optional property doesn't need !
 * class User {
 *   @IsOptional()
 *   @IsString()
 *   name?: string;
 * }
 *
 * @example
 * // ✅ Good - has initializer
 * class User {
 *   @IsString()
 *   name: string = 'default';
 * }
 *
 * @example
 * // ✅ Good - has undefined in type
 * class User {
 *   @IsString()
 *   name: string | undefined;
 * }
 *
 * @example
 * // ❌ Bad - missing definite assignment assertion
 * class User {
 *   @IsString()
 *   name: string;
 * }
 *
 * @example
 * // ❌ Bad - null doesn't count, still needs !
 * class User {
 *   @IsString()
 *   name: string | null;
 * }
 */
export default createRule<Options, MessageIds>({
  name: 'definite-assignment-match',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure properties with decorators use definite assignment assertion (!) when they are not optional, not initialized, and do not have undefined in their type',
    },
    messages: {
      missingDefiniteAssignment:
        'Property {{propertyName}} with type {{propertyType}} requires definite assignment assertion (!). Change to: {{propertyName}}!: {{propertyType}}',
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
         * Check for missing definite assignment assertion (!)
         * Properties with decorators that are:
         * - Not optional (no ?)
         * - Not initialized (no = value)
         * - Don't have undefined in their type
         * Should use the definite assignment assertion (!)
         * Note: Properties with | null still require ! unless they also have ?
         */
        const isOptionalProperty = node.optional === true;
        const hasInitializer = node.value !== undefined && node.value !== null;
        const hasDefiniteAssignment = node.definite === true;
        const hasUndefinedInType =
          typeAnnotation.type === 'TSUndefinedKeyword' ||
          (typeAnnotation.type === 'TSUnionType' && typeAnnotation.types.some((t) => t.type === 'TSUndefinedKeyword'));

        // If property is not optional, not initialized, doesn't have undefined in type,
        // and doesn't have definite assignment, report an error
        if (!isOptionalProperty && !hasInitializer && !hasUndefinedInType && !hasDefiniteAssignment) {
          const propertyName = node.key.type === 'Identifier' ? node.key.name : 'property';
          context.report({
            node,
            messageId: 'missingDefiniteAssignment',
            data: {
              propertyName,
              propertyType: actualType,
            },
            fix(fixer) {
              // Find position after property key (and after optional marker if present)
              // We need to insert ! before the : type annotation
              const keyEnd = node.key.range[1];
              return fixer.insertTextAfterRange([keyEnd, keyEnd], '!');
            },
          });
        }
      },
    };
  },
});
