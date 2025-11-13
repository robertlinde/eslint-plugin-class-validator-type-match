import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import type * as ts from 'typescript';
import {
  isComplexType,
  isArrayType,
  isTupleType,
  getArrayElementTypeNode,
  getTupleElementTypes,
  getTypeString,
  hasValidateNestedEachOption,
  analyzeUnionType,
  isUnionOfLiterals,
  getUtilityTypeArgument,
  TYPE_AGNOSTIC_DECORATORS,
  decoratorTypeMap,
} from '../utils/type-helpers.util';

/**
 * Creates an ESLint rule with proper documentation URL
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/robertlinde/eslint-plugin-class-validator-type-match#${name}`,
);

type MessageIds =
  | 'nestedArrayMismatch'
  | 'missingValidateNested'
  | 'missingEachOption'
  | 'unnecessaryValidateNested'
  | 'tupleValidationWarning'
  | 'multiTypeUnionWarning'
  | 'mixedComplexityUnionWarning'
  | 'pickOmitWarning';

type Options = [];

/**
 * ESLint rule to ensure @ValidateNested decorator is correctly applied for complex types.
 *
 * This rule validates that:
 * - Complex types have @ValidateNested() decorator
 * - Arrays of complex types use @ValidateNested({ each: true })
 * - Primitive types don't incorrectly use @ValidateNested
 * - Tuple types are handled appropriately
 * - Union types with multiple complex types are flagged
 * - Utility types like Pick/Omit are handled correctly
 *
 * @example
 * // ✅ Good - complex type with @ValidateNested
 * class User {
 *   @ValidateNested()
 *   address!: Address;
 * }
 *
 * @example
 * // ✅ Good - array of complex types with { each: true }
 * class User {
 *   @ValidateNested({ each: true })
 *   addresses!: Address[];
 * }
 *
 * @example
 * // ❌ Bad - complex type missing @ValidateNested
 * class User {
 *   @IsDefined()
 *   address!: Address;
 * }
 *
 * @example
 * // ❌ Bad - array of complex types missing { each: true }
 * class User {
 *   @ValidateNested()
 *   addresses!: Address[];
 * }
 *
 * @example
 * // ❌ Bad - primitive array with @ValidateNested
 * class User {
 *   @ValidateNested()
 *   tags!: string[];
 * }
 */
export default createRule<Options, MessageIds>({
  name: 'validate-nested-match',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure @ValidateNested decorator is correctly applied for complex types, arrays of complex types, and validates against improper usage on primitive types',
    },
    messages: {
      nestedArrayMismatch:
        'Array contains complex type {{elementType}}. Add @ValidateNested({ each: true }) decorator to validate array elements.',
      missingValidateNested: 'Complex type {{actualType}} requires @ValidateNested() decorator for proper validation.',
      missingEachOption:
        'Array of complex types requires @ValidateNested({ each: true }), but only @ValidateNested() was found.',
      unnecessaryValidateNested:
        'Array of primitive type {{elementType}} does not need @ValidateNested(). Remove @ValidateNested() or use @{{decorator}}({ each: true }) instead.',
      tupleValidationWarning:
        'Tuple type contains complex elements. Consider using a regular array with @ValidateNested({ each: true }) or validate elements individually.',
      multiTypeUnionWarning:
        'Union type contains multiple complex types ({{types}}). Discriminated unions require custom validation logic - consider splitting into separate properties or using a custom validator.',
      mixedComplexityUnionWarning:
        'Union type mixes simple and complex types ({{primitives}} | {{complexTypes}}). This requires careful validation - simple types need type validators while complex types need @ValidateNested(). Consider using discriminated unions or custom validators.',
      pickOmitWarning:
        'Type {{utilityType}}<{{baseType}}, ...> may be picking/omitting primitive fields. If the resulting type is primitive, use the appropriate primitive decorator instead of @ValidateNested(). If complex, @ValidateNested() is correct.',
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
       * Analyzes class property definitions to validate @ValidateNested usage
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
        const actualType = getTypeString(typeAnnotation, checker, esTreeNodeMap);

        // Skip if we couldn't determine the type
        if (!actualType) return;

        const hasValidateNested = decorators.includes('ValidateNested');

        // Special handling for tuple types
        if (isTupleType(typeAnnotation)) {
          const elements = getTupleElementTypes(typeAnnotation);
          const hasComplexElements = elements.some((element) => isComplexType(element, checker, esTreeNodeMap));

          if (hasComplexElements) {
            context.report({
              node,
              messageId: 'tupleValidationWarning',
              data: {},
            });
          }
        }

        // Special handling for multi-type unions - only warn for truly problematic cases
        if (typeAnnotation.type === 'TSUnionType' && !isUnionOfLiterals(typeAnnotation)) {
          const unionAnalysis = analyzeUnionType(typeAnnotation, checker, esTreeNodeMap);

          // Only warn about unions with multiple complex types (genuinely hard to validate)
          // Don't warn about multi-primitive unions (string | number) as they're common and not necessarily wrong
          if (unionAnalysis.hasMultipleComplexTypes) {
            const complexTypeNames = unionAnalysis.complexTypes
              .map((t) => getTypeString(t, checker, esTreeNodeMap) || 'unknown')
              .join(' | ');

            context.report({
              node,
              messageId: 'multiTypeUnionWarning',
              data: {
                types: complexTypeNames,
              },
            });
          }

          // Warn about unions mixing primitives and complex types (requires different decorators)
          if (unionAnalysis.hasMixedComplexity) {
            const complexTypeNames = unionAnalysis.complexTypes
              .map((t) => getTypeString(t, checker, esTreeNodeMap) || 'unknown')
              .join(' | ');

            context.report({
              node,
              messageId: 'mixedComplexityUnionWarning',
              data: {
                primitives: unionAnalysis.primitiveTypes.join(' | '),
                complexTypes: complexTypeNames,
              },
            });
          }
        }

        // Validate arrays of complex types have proper nested validation
        if (isArrayType(typeAnnotation) && !isTupleType(typeAnnotation)) {
          const elementTypeNode = getArrayElementTypeNode(typeAnnotation);

          if (elementTypeNode) {
            const elementTypeName = getTypeString(elementTypeNode, checker, esTreeNodeMap);
            const isElementComplex = isComplexType(elementTypeNode, checker, esTreeNodeMap);

            if (isElementComplex && elementTypeName) {
              // Complex element type - requires @ValidateNested({ each: true })
              if (!hasValidateNested) {
                context.report({
                  node,
                  messageId: 'nestedArrayMismatch',
                  data: {
                    elementType: elementTypeName,
                  },
                });
              } else {
                // Validate { each: true } option is present for array nested validation
                const validateNestedDecorator = node.decorators?.find((d) => {
                  if (d.expression.type === 'Identifier' && d.expression.name === 'ValidateNested') {
                    return true;
                  }
                  if (
                    d.expression.type === 'CallExpression' &&
                    d.expression.callee.type === 'Identifier' &&
                    d.expression.callee.name === 'ValidateNested'
                  ) {
                    return true;
                  }
                  return false;
                });

                if (validateNestedDecorator && !hasValidateNestedEachOption(validateNestedDecorator)) {
                  context.report({
                    node,
                    messageId: 'missingEachOption',
                    data: {},
                  });
                }
              }
            } else if (!isElementComplex && hasValidateNested && elementTypeName) {
              // Primitive element type - @ValidateNested is unnecessary
              // Find an appropriate array validator decorator to suggest
              const arrayValidatorDecorator = decorators.find(
                (d) => decoratorTypeMap[d] && decoratorTypeMap[d].includes(elementTypeName),
              );

              context.report({
                node,
                messageId: 'unnecessaryValidateNested',
                data: {
                  elementType: elementTypeName,
                  decorator: arrayValidatorDecorator || 'IsString',
                },
              });
            }
          }
        }

        // Validate complex object types have @ValidateNested decorator
        const hasTypedDecorator = decorators.some((d) => !TYPE_AGNOSTIC_DECORATORS.has(d) && decoratorTypeMap[d]);

        if (
          !isArrayType(typeAnnotation) &&
          isComplexType(typeAnnotation, checker, esTreeNodeMap) &&
          !hasTypedDecorator
        ) {
          // Complex types should have @ValidateNested()
          if (!hasValidateNested && decorators.length > 0) {
            // Check if it's a Pick/Omit type that might be a false positive
            const utilityInfo = getUtilityTypeArgument(typeAnnotation);

            if (utilityInfo && (utilityInfo.utilityType === 'Pick' || utilityInfo.utilityType === 'Omit')) {
              // Provide a more helpful message for Pick/Omit
              const baseTypeName =
                utilityInfo.typeArgument.type === 'TSTypeReference'
                  ? getTypeString(utilityInfo.typeArgument, checker, esTreeNodeMap)
                  : 'unknown';

              context.report({
                node,
                messageId: 'pickOmitWarning',
                data: {
                  utilityType: utilityInfo.utilityType,
                  baseType: baseTypeName || 'unknown',
                },
              });
            } else {
              // Standard complex type warning
              context.report({
                node,
                messageId: 'missingValidateNested',
                data: {
                  actualType,
                },
              });
            }
          }
        }
      },
    };
  },
});
