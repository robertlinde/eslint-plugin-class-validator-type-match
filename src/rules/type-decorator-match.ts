import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import type * as ts from 'typescript';
import {
  isComplexType,
  isArrayType,
  getArrayElementTypeNode,
  getTypeString,
  getTypeReferenceName,
  getTypeDecoratorClassName,
  isNullableUnion,
  unwrapUtilityTypeForClassName,
} from '../utils/type-helpers.util';

/**
 * Creates an ESLint rule with proper documentation URL
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/robertlinde/eslint-plugin-class-validator-type-match#${name}`,
);

type MessageIds = 'typeMismatch' | 'missingTypeDecorator';

type Options = [];

/**
 * ESLint rule to ensure @Type(() => ClassName) decorator matches TypeScript type annotations.
 *
 * This rule validates that:
 * - @Type decorator class name matches the TypeScript type
 * - Complex types with @ValidateNested also have @Type decorator
 * - Handles arrays, nullable types, and utility types correctly
 *
 * @example
 * // ✅ Good - @Type matches type annotation
 * class User {
 *   @Type(() => Address)
 *   @ValidateNested()
 *   address!: Address;
 * }
 *
 * @example
 * // ✅ Good - @Type matches array element type
 * class User {
 *   @Type(() => Address)
 *   @ValidateNested({ each: true })
 *   addresses!: Address[];
 * }
 *
 * @example
 * // ❌ Bad - @Type class name doesn't match type
 * class User {
 *   @Type(() => Profile)
 *   @ValidateNested()
 *   address!: Address;
 * }
 *
 * @example
 * // ❌ Bad - missing @Type with @ValidateNested
 * class User {
 *   @ValidateNested()
 *   address!: Address;
 * }
 */
export default createRule<Options, MessageIds>({
  name: 'type-decorator-match',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure @Type(() => ClassName) decorator matches TypeScript type annotations and is present when needed for class-transformer integration',
    },
    messages: {
      typeMismatch: '@Type(() => {{typeDecoratorClass}}) does not match type annotation {{actualType}}.',
      missingTypeDecorator:
        'Complex type {{actualType}} with @ValidateNested() requires @Type(() => {{className}}) decorator for proper transformation.',
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
       * Analyzes class property definitions to validate @Type decorator usage
       */
      PropertyDefinition(node: TSESTree.PropertyDefinition) {
        // Skip if no decorators present
        if (!node.decorators || node.decorators.length === 0) return;
        // Skip if no type annotation
        if (!node.typeAnnotation) return;

        /**
         * Extract decorator names from the property.
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
        const hasTypeDecorator = decorators.includes('Type');

        // Validate @Type(() => ClassName) matches the TypeScript type annotation
        const typeDecorator = node.decorators?.find(
          (d) =>
            d.expression.type === 'CallExpression' &&
            d.expression.callee.type === 'Identifier' &&
            d.expression.callee.name === 'Type',
        );

        if (typeDecorator) {
          const typeClassName = getTypeDecoratorClassName(typeDecorator);

          // For non-array types, check if @Type matches the TypeScript type
          if (typeClassName && !isArrayType(typeAnnotation)) {
            if (typeAnnotation.type === 'TSTypeReference') {
              const tsTypeName = getTypeReferenceName(typeAnnotation.typeName);

              if (typeClassName !== tsTypeName) {
                context.report({
                  node,
                  messageId: 'typeMismatch',
                  data: {
                    typeDecoratorClass: typeClassName,
                    actualType: tsTypeName,
                  },
                });
              }
            } else {
              // @Type is used with a primitive type
              context.report({
                node,
                messageId: 'typeMismatch',
                data: {
                  typeDecoratorClass: typeClassName,
                  actualType,
                },
              });
            }
          }

          // For array types, check if @Type matches the array element type
          if (typeClassName && isArrayType(typeAnnotation)) {
            const elementTypeNode = getArrayElementTypeNode(typeAnnotation);
            if (elementTypeNode) {
              if (elementTypeNode.type === 'TSTypeReference') {
                const elementTypeName = getTypeReferenceName(elementTypeNode.typeName);

                if (typeClassName !== elementTypeName) {
                  context.report({
                    node,
                    messageId: 'typeMismatch',
                    data: {
                      typeDecoratorClass: typeClassName,
                      actualType: `${elementTypeName}[]`,
                    },
                  });
                }
              } else {
                // @Type is used with an array of primitives
                const elementType = getTypeString(elementTypeNode, checker, esTreeNodeMap);
                if (elementType) {
                  context.report({
                    node,
                    messageId: 'typeMismatch',
                    data: {
                      typeDecoratorClass: typeClassName,
                      actualType: `${elementType}[]`,
                    },
                  });
                }
              }
            }
          }
        }

        // Check if complex non-array types with @ValidateNested also have @Type
        if (
          !isArrayType(typeAnnotation) &&
          isComplexType(typeAnnotation, checker, esTreeNodeMap) &&
          hasValidateNested &&
          !hasTypeDecorator
        ) {
          // Check if there's an @IsEnum decorator (single enum doesn't need each: true)
          // This indicates it's an enum and doesn't need @Type
          const hasIsEnum = decorators.includes('IsEnum');

          if (!hasIsEnum) {
            let typeToCheck = typeAnnotation;

            // Handle nullable complex types: Address | null | undefined
            const nullableCheck = isNullableUnion(typeAnnotation);
            if (nullableCheck.isNullable && nullableCheck.baseType) {
              typeToCheck = nullableCheck.baseType;
            }

            // Unwrap utility types to get the base class name
            const unwrappedType = unwrapUtilityTypeForClassName(typeToCheck);

            if (unwrappedType.type === 'TSTypeReference') {
              const className = getTypeReferenceName(unwrappedType.typeName);
              const displayType = getTypeString(typeToCheck, checker, esTreeNodeMap);
              context.report({
                node,
                messageId: 'missingTypeDecorator',
                data: {
                  actualType: displayType || className,
                  className,
                },
              });
            }
          }
        }

        // Check if array of complex types with @ValidateNested also have @Type
        if (isArrayType(typeAnnotation) && hasValidateNested && !hasTypeDecorator) {
          const elementTypeNode = getArrayElementTypeNode(typeAnnotation);
          if (elementTypeNode) {
            const isElementComplex = isComplexType(elementTypeNode, checker, esTreeNodeMap);

            // Check if there's an @IsEnum decorator with { each: true }
            // This indicates the array elements are enums and don't need @Type
            const hasIsEnumWithEach =
              decorators.includes('IsEnum') &&
              node.decorators?.some((d) => {
                if (
                  d.expression.type === 'CallExpression' &&
                  d.expression.callee.type === 'Identifier' &&
                  d.expression.callee.name === 'IsEnum'
                ) {
                  // Check if it has { each: true }
                  const args = d.expression.arguments;
                  for (let i = 0; i < Math.min(args.length, 2); i++) {
                    const arg = args[i];
                    if (arg.type === 'ObjectExpression') {
                      const hasEach = arg.properties.some((prop) => {
                        if (
                          prop.type === 'Property' &&
                          prop.key.type === 'Identifier' &&
                          prop.key.name === 'each' &&
                          prop.value.type === 'Literal'
                        ) {
                          return prop.value.value === true;
                        }
                        return false;
                      });
                      if (hasEach) return true;
                    }
                  }
                }
                return false;
              });

            if (isElementComplex && !hasIsEnumWithEach) {
              let elementTypeToCheck = elementTypeNode;

              // Handle nullable element types: (Address | null)[]
              const nullableCheck = isNullableUnion(elementTypeNode);
              if (nullableCheck.isNullable && nullableCheck.baseType) {
                elementTypeToCheck = nullableCheck.baseType;
              }

              // Unwrap utility types to get the base class name
              const unwrappedType = unwrapUtilityTypeForClassName(elementTypeToCheck);

              if (unwrappedType.type === 'TSTypeReference') {
                const className = getTypeReferenceName(unwrappedType.typeName);
                const displayType = getTypeString(elementTypeNode, checker, esTreeNodeMap);
                context.report({
                  node,
                  messageId: 'missingTypeDecorator',
                  data: {
                    actualType: `${displayType}[]`,
                    className,
                  },
                });
              }
            }
          }
        }
      },
    };
  },
});
