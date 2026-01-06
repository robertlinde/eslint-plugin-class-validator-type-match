import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import type * as ts from 'typescript';
import {
  TYPE_AGNOSTIC_DECORATORS,
  decoratorTypeMap,
  getTypeString,
  checkTypeMatch,
  isArrayType,
  getArrayElementTypeNode,
  hasEachOption,
  getIsEnumArgument,
  getTypeReferenceName,
  isUnionEnumType,
  isEnumArgumentArraySubset,
} from '../utils/type-helpers.util';

/**
 * Creates an ESLint rule with proper documentation URL
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/robertlinde/eslint-plugin-class-validator-type-match#${name}`,
);

type MessageIds = 'mismatch' | 'enumMismatch' | 'invalidEachOption';
type Options = [];

/**
 * ESLint rule to ensure class-validator decorators match TypeScript type annotations.
 *
 * This rule prevents common mistakes where the decorator type (e.g., @IsString)
 * doesn't match the actual TypeScript type annotation (e.g., number).
 *
 * Handles:
 * - Basic type validation (string, number, boolean, array, Date, object, enum)
 * - @IsEnum validation with enum references and union literals
 * - { each: true } option for array element validation
 * - Invalid { each: true } usage on non-array types
 * - Nullable unions (T | null | undefined)
 * - Utility types (Partial, Pick, Omit, etc.)
 * - Template literal types, namespace references, branded types
 *
 * @example
 * // ✅ Good - decorator matches type
 * class User {
 *   @IsString()
 *   name!: string;
 *
 *   @IsNumber()
 *   age!: number;
 * }
 *
 * @example
 * // ❌ Bad - decorator doesn't match type
 * class User {
 *   @IsString()
 *   age!: number; // Error: @IsString does not match type number
 * }
 *
 * @example
 * // ✅ Good - { each: true } for array elements
 * class User {
 *   @IsString({ each: true })
 *   tags!: string[];
 * }
 *
 * @example
 * // ❌ Bad - { each: true } on non-array
 * class User {
 *   @IsString({ each: true })
 *   name!: string; // Error: { each: true } on non-array type
 * }
 */
export default createRule<Options, MessageIds>({
  name: 'decorator-type-match',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure class-validator decorators match TypeScript type annotations, including support for arrays, enums, nullable unions, utility types, and { each: true } option handling',
    },
    messages: {
      mismatch: 'Decorator @{{decorator}} does not match type annotation {{actualType}}. Expected: {{expectedTypes}}',
      enumMismatch:
        '@IsEnum({{enumArg}}) does not match type annotation {{actualType}}. Ensure the enum argument matches the type.',
      invalidEachOption:
        'Decorator @{{decorator}} has { each: true } option but property type is not an array. Remove { each: true } or change type to an array.',
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
      const parserServices = context.sourceCode.parserServices;
      if (parserServices?.program && parserServices?.esTreeNodeToTSNodeMap) {
        checker = parserServices.program.getTypeChecker();
        esTreeNodeMap = parserServices.esTreeNodeToTSNodeMap;
      }
    } catch {
      // Type checker not available, continue with AST-only analysis
    }

    return {
      /**
       * Analyzes class property definitions to validate decorator and type annotation matching
       */
      PropertyDefinition(node: TSESTree.PropertyDefinition) {
        // Skip if no decorators present
        if (!node.decorators || node.decorators.length === 0) return;
        // Skip if no type annotation
        if (!node.typeAnnotation) return;

        /**
         * Extract decorator names from the property.
         * Handles both @Decorator and @Decorator() syntax for maximum compatibility.
         */
        const decorators = node.decorators
          .filter((d) => d.expression.type === 'CallExpression' || d.expression.type === 'Identifier')
          .map((d) => {
            if (d.expression.type === 'CallExpression' && d.expression.callee.type === 'Identifier') {
              return d.expression.callee.name;
            }

            if (d.expression.type === 'Identifier') {
              return d.expression.name;
            }

            return null;
          })
          .filter((name): name is string => name !== null);

        const {typeAnnotation} = node.typeAnnotation;
        let actualType: string | null = null;

        /**
         * Determine the actual TypeScript type from the annotation.
         * Supports primitive types, arrays, type references, literals, and intersections.
         * Uses TypeScript's type checker when available to resolve type aliases.
         */
        actualType = getTypeString(typeAnnotation, checker, esTreeNodeMap);

        // Skip if we couldn't determine the type
        if (!actualType) return;

        const hasIsEnum = decorators.includes('IsEnum');

        // Validate @IsEnum argument matches the type annotation for enum type references
        // Skip this check for array types with { each: true }, as those validate array elements
        if (hasIsEnum && typeAnnotation.type === 'TSTypeReference' && !isArrayType(typeAnnotation)) {
          const isEnumDecorator = node.decorators?.find(
            (d) =>
              d.expression.type === 'CallExpression' &&
              d.expression.callee.type === 'Identifier' &&
              d.expression.callee.name === 'IsEnum',
          );

          if (isEnumDecorator) {
            const enumArg = getIsEnumArgument(isEnumDecorator);
            const typeName = getTypeReferenceName(typeAnnotation.typeName);

            // For TypeScript enum references, the argument should match the type
            // Skip this check if the argument is an array of enum values (subset pattern)
            const isArraySubset = isEnumArgumentArraySubset(isEnumDecorator, checker, esTreeNodeMap);
            if (enumArg && enumArg !== typeName && !isArraySubset) {
              context.report({
                node,
                messageId: 'enumMismatch',
                data: {
                  enumArg,
                  actualType: typeName,
                },
              });
            }
          }
        }

        // Validate @IsEnum works with union of literals
        if (hasIsEnum && isUnionEnumType(typeAnnotation)) {
          // This is valid, no error needed
        }

        /**
         * Validate each type-enforcing decorator matches the actual type
         */
        for (const decorator of decorators) {
          // Skip type-agnostic decorators
          if (TYPE_AGNOSTIC_DECORATORS.has(decorator)) continue;

          // Get the decorator node to check for { each: true }
          const decoratorNode = node.decorators?.find((d) => {
            if (d.expression.type === 'CallExpression' && d.expression.callee.type === 'Identifier') {
              return d.expression.callee.name === decorator;
            }
            if (d.expression.type === 'Identifier') {
              return d.expression.name === decorator;
            }
            return false;
          });

          // Check if this decorator has { each: true } option
          const hasEach = decoratorNode ? hasEachOption(decoratorNode) : false;

          // Validate { each: true } is only used with arrays
          if (hasEach && !isArrayType(typeAnnotation)) {
            context.report({
              node,
              messageId: 'invalidEachOption',
              data: {
                decorator,
              },
            });
            continue;
          }

          let typeToCheck = actualType;
          let typeNodeToCheck = typeAnnotation;

          // If decorator has { each: true }, validate against array element type
          if (hasEach && isArrayType(typeAnnotation)) {
            const elementTypeNode = getArrayElementTypeNode(typeAnnotation);
            if (elementTypeNode) {
              const elementType = getTypeString(elementTypeNode, checker, esTreeNodeMap);
              if (elementType) {
                typeToCheck = elementType;
                typeNodeToCheck = elementTypeNode;
              }
            }
          }

          const matches = checkTypeMatch(decorator, typeNodeToCheck, typeToCheck, checker, esTreeNodeMap);

          // Report mismatch
          if (!matches) {
            const expectedTypes = decoratorTypeMap[decorator];
            context.report({
              node,
              messageId: 'mismatch',
              data: {
                decorator,
                actualType: typeToCheck,
                expectedTypes: expectedTypes?.join(' or ') || 'unknown',
              },
            });
          }
        }
      },
    };
  },
});
