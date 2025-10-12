import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

/**
 * Creates an ESLint rule with proper documentation URL
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/robertlinde/eslint-plugin-class-validator-type-match#${name}`,
);

type MessageIds = 'mismatch' | 'nestedArrayMismatch' | 'missingValidateNested' | 'enumMismatch';
type Options = [];

/**
 * Decorators that don't enforce specific types and can work with any type.
 * These are used for validation logic rather than type checking.
 */
const TYPE_AGNOSTIC_DECORATORS = new Set([
  'IsOptional',
  'ValidateNested',
  'IsDefined',
  'IsEmpty',
  'Equals',
  'NotEquals',
  'IsIn',
  'IsNotIn',
  'Type',
  'Exclude',
  'Expose',
  'Transform',
]);

/**
 * Mapping of class-validator decorators to their expected TypeScript types.
 * Only includes decorators that enforce specific types.
 *
 * @example
 * IsString: ["string"] - expects string type
 */
const decoratorTypeMap: Record<string, string[]> = {
  // String validators
  IsString: ['string'],
  IsNotEmpty: [], // Can be any type, but kept for backward compatibility

  // Number validators
  IsNumber: ['number'],
  IsInt: ['number'],
  IsPositive: ['number'],
  IsNegative: ['number'],
  Min: ['number'],
  Max: ['number'],

  // Boolean validators
  IsBoolean: ['boolean'],

  // Date validators
  IsDate: ['Date'],
  MinDate: ['Date'],
  MaxDate: ['Date'],

  // Array validators
  IsArray: ['array', 'Array'],
  ArrayMinSize: ['array', 'Array'],
  ArrayMaxSize: ['array', 'Array'],

  // Object validators
  IsObject: ['object'],

  // Enum validators - special handling for union types and enum references
  IsEnum: ['enum', 'union-literal', 'type-reference'],
};

/**
 * Convert a TypeNode to a string representation
 */
function getTypeString(typeNode: TSESTree.TypeNode): string | null {
  switch (typeNode.type) {
    case 'TSStringKeyword':
      return 'string';
    case 'TSNumberKeyword':
      return 'number';
    case 'TSBooleanKeyword':
      return 'boolean';
    case 'TSArrayType':
      return 'array';
    case 'TSTypeReference':
      if (typeNode.typeName.type === 'Identifier') {
        return typeNode.typeName.name;
      }
      break;
    case 'TSTypeLiteral':
      return 'object';
    case 'TSUnionType':
      return 'union';
    case 'TSLiteralType':
      // Handle literal types like 25 or "hello"
      if (typeNode.literal.type === 'Literal') {
        if (typeof typeNode.literal.value === 'string') return 'string';
        if (typeof typeNode.literal.value === 'number') return 'number';
        if (typeof typeNode.literal.value === 'boolean') return 'boolean';
      }
      return 'literal';
    case 'TSIntersectionType':
      return 'intersection';
  }
  return null;
}

/**
 * Extract the element type node from an array type annotation
 */
function getArrayElementTypeNode(typeAnnotation: TSESTree.TypeNode): TSESTree.TypeNode | null {
  // Handle Type[] syntax
  if (typeAnnotation.type === 'TSArrayType') {
    return typeAnnotation.elementType;
  }

  // Handle Array<Type> syntax
  if (
    typeAnnotation.type === 'TSTypeReference' &&
    typeAnnotation.typeName.type === 'Identifier' &&
    typeAnnotation.typeName.name === 'Array' &&
    typeAnnotation.typeArguments?.params[0]
  ) {
    return typeAnnotation.typeArguments.params[0];
  }

  return null;
}

/**
 * Check if a type annotation is a union type of literals
 */
function isUnionOfLiterals(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === 'TSUnionType') {
    return typeNode.types.every((type) => type.type === 'TSLiteralType');
  }
  return false;
}

/**
 * Check if a type is a complex type (object, class instance, or type literal)
 * Excludes union types of literals which are typically used for enum-like types
 */
function isComplexType(typeNode: TSESTree.TypeNode): boolean {
  // Type literals are always complex
  if (typeNode.type === 'TSTypeLiteral') {
    return true;
  }

  // Union types of literals are not complex (they're enum-like)
  if (isUnionOfLiterals(typeNode)) {
    return false;
  }

  // Intersection types are complex
  if (typeNode.type === 'TSIntersectionType') {
    return true;
  }

  // Check for type references (class names, interfaces, etc.)
  if (typeNode.type === 'TSTypeReference' && typeNode.typeName.type === 'Identifier') {
    const typeName = typeNode.typeName.name;
    // Exclude primitive wrapper types and common built-in types
    const builtInTypes = ['String', 'Number', 'Boolean', 'Date', 'Array', 'Promise', 'Map', 'Set'];
    return !builtInTypes.includes(typeName);
  }

  return false;
}

/**
 * Check if a type annotation represents an array
 */
function isArrayType(typeAnnotation: TSESTree.TypeNode): boolean {
  if (typeAnnotation.type === 'TSArrayType') {
    return true;
  }

  if (
    typeAnnotation.type === 'TSTypeReference' &&
    typeAnnotation.typeName.type === 'Identifier' &&
    typeAnnotation.typeName.name === 'Array'
  ) {
    return true;
  }

  return false;
}

/**
 * Check if a type annotation is a union type of literals (enum-like)
 * Used for @IsEnum validation
 */
function isUnionEnumType(typeNode: TSESTree.TypeNode): boolean {
  return isUnionOfLiterals(typeNode);
}

/**
 * Extract the first argument from @IsEnum() decorator
 */
function getIsEnumArgument(decorator: TSESTree.Decorator): string | null {
  if (decorator.expression.type === 'CallExpression' && decorator.expression.arguments.length > 0) {
    const firstArg = decorator.expression.arguments[0];

    // Handle enum reference: @IsEnum(MyEnum)
    if (firstArg.type === 'Identifier') {
      return firstArg.name;
    }

    // Handle member expression: @IsEnum(MyNamespace.MyEnum)
    if (firstArg.type === 'MemberExpression') {
      // Extract the full path
      const parts: string[] = [];
      let current: TSESTree.Node = firstArg;

      while (current.type === 'MemberExpression') {
        if (current.property.type === 'Identifier') {
          parts.unshift(current.property.name);
        }
        current = current.object;
      }

      if (current.type === 'Identifier') {
        parts.unshift(current.name);
      }

      return parts.join('.');
    }
  }

  return null;
}

/**
 * Check if decorator and type match, with special handling for @IsEnum
 */
function checkTypeMatch(decorator: string, typeAnnotation: TSESTree.TypeNode, actualType: string): boolean {
  const expectedTypes = decoratorTypeMap[decorator];

  // Skip decorators not in our map or type-agnostic ones
  if (!expectedTypes || expectedTypes.length === 0) {
    return true;
  }

  // Special handling for @IsEnum
  if (decorator === 'IsEnum') {
    // @IsEnum should work with:
    // 1. Union types of literals: 'active' | 'inactive' -> 'union-literal'
    // 2. Type references (assumed to be enums): UserStatus -> 'type-reference'
    if (isUnionEnumType(typeAnnotation)) {
      return expectedTypes.includes('union-literal');
    }
    if (typeAnnotation.type === 'TSTypeReference' && typeAnnotation.typeName.type === 'Identifier') {
      return expectedTypes.includes('type-reference');
    }
    return false;
  }

  // Standard type matching
  return expectedTypes.some((expected) => {
    if (expected === 'array' && actualType === 'Array') return true;
    if (expected === 'Array' && actualType === 'array') return true;
    return expected === actualType;
  });
}

/**
 * ESLint rule to ensure class-validator decorators match TypeScript type annotations.
 *
 * This rule prevents common mistakes where the decorator type (e.g., @IsString)
 * doesn't match the actual TypeScript type annotation (e.g., number).
 *
 * Enhanced to handle:
 * - Arrays of objects requiring @ValidateNested({ each: true })
 * - Nested objects requiring @ValidateNested()
 * - Type literals
 * - class-transformer decorators
 * - Enum types (both TypeScript enums and union types)
 * - Literal types (e.g., "admin", 25)
 * - Intersection types (e.g., Profile & Settings)
 *
 * @example
 * // ❌ Bad - will trigger error
 * class User {
 *   @IsString()
 *   name!: number;
 * }
 *
 * @example
 * // ✅ Good - types match
 * class User {
 *   @IsString()
 *   name!: string;
 * }
 *
 * @example
 * // ❌ Bad - array of objects without @ValidateNested
 * class User {
 *   @IsArray()
 *   addresses!: Address[];
 * }
 *
 * @example
 * // ✅ Good - array of objects with @ValidateNested
 * class User {
 *   @IsArray()
 *   @ValidateNested({ each: true })
 *   @Type(() => Address)
 *   addresses!: Address[];
 * }
 *
 * @example
 * // ❌ Bad - complex type without @ValidateNested
 * class User {
 *   @IsDefined()
 *   profile!: Profile;
 * }
 *
 * @example
 * // ✅ Good - complex type with @ValidateNested
 * class User {
 *   @ValidateNested()
 *   @Type(() => Profile)
 *   profile!: Profile;
 * }
 *
 * @example
 * // ❌ Bad - intersection type without @ValidateNested
 * class User {
 *   @IsDefined()
 *   data!: Profile & Settings;
 * }
 *
 * @example
 * // ✅ Good - intersection type with @ValidateNested
 * class User {
 *   @ValidateNested()
 *   data!: Profile & Settings;
 * }
 *
 * @example
 * // ✅ Good - literal type
 * class User {
 *   @IsString()
 *   role!: "admin";
 * }
 *
 * @example
 * // ❌ Bad - @IsEnum with wrong enum type
 * class User {
 *   @IsEnum(UserRole)
 *   status!: UserStatus;
 * }
 *
 * @example
 * // ✅ Good - @IsEnum matches enum type
 * class User {
 *   @IsEnum(UserStatus)
 *   status!: UserStatus;
 * }
 *
 * @example
 * // ✅ Good - union type with @IsEnum
 * class User {
 *   @IsEnum({ ACTIVE: 'active', INACTIVE: 'inactive' })
 *   status!: 'active' | 'inactive';
 * }
 *
 * @example
 * // ❌ Bad - enum type used with wrong decorator
 * class User {
 *   @IsString()
 *   status!: UserStatus;  // Should use @IsEnum, will report type mismatch
 * }
 */
export default createRule<Options, MessageIds>({
  name: 'decorator-type-match',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure class-validator decorators match TypeScript type annotations, including arrays of objects, nested objects, enum types, literal types, and intersection types',
    },
    messages: {
      mismatch: 'Decorator @{{decorator}} does not match type annotation {{actualType}}. Expected: {{expectedTypes}}',
      nestedArrayMismatch:
        'Array contains complex type {{elementType}}. Add @ValidateNested({ each: true }) decorator to validate array elements.',
      missingValidateNested: 'Complex type {{actualType}} requires @ValidateNested() decorator for proper validation.',
      enumMismatch:
        '@IsEnum({{enumArg}}) does not match type annotation {{actualType}}. Ensure the enum argument matches the type.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      /**
       * Analyzes class property definitions to check if decorators match type annotations
       * @param node - The PropertyDefinition AST node to analyze
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
         */
        actualType = getTypeString(typeAnnotation);

        // Skip if we couldn't determine the type
        if (!actualType) return;

        const hasValidateNested = decorators.includes('ValidateNested');
        const hasIsEnum = decorators.includes('IsEnum');

        // Check for @IsEnum with type reference (enum) - validate the argument matches
        if (hasIsEnum && typeAnnotation.type === 'TSTypeReference' && typeAnnotation.typeName.type === 'Identifier') {
          const isEnumDecorator = node.decorators?.find(
            (d) =>
              d.expression.type === 'CallExpression' &&
              d.expression.callee.type === 'Identifier' &&
              d.expression.callee.name === 'IsEnum',
          );

          if (isEnumDecorator) {
            const enumArg = getIsEnumArgument(isEnumDecorator);

            // For TypeScript enum references, the argument should match the type
            if (enumArg && enumArg !== typeAnnotation.typeName.name) {
              context.report({
                node,
                messageId: 'enumMismatch',
                data: {
                  enumArg,
                  actualType: typeAnnotation.typeName.name,
                },
              });
            }
          }
        }

        // Check for arrays of complex types
        if (isArrayType(typeAnnotation)) {
          const elementTypeNode = getArrayElementTypeNode(typeAnnotation);

          if (elementTypeNode && isComplexType(elementTypeNode)) {
            const elementTypeName = getTypeString(elementTypeNode);

            if (!hasValidateNested && elementTypeName) {
              context.report({
                node,
                messageId: 'nestedArrayMismatch',
                data: {
                  elementType: elementTypeName,
                },
              });
            }
          }
        }

        /**
         * Check each decorator against the actual type.
         * Report an error if there's a mismatch.
         */
        for (const decorator of decorators) {
          // Skip type-agnostic decorators
          if (TYPE_AGNOSTIC_DECORATORS.has(decorator)) continue;

          const matches = checkTypeMatch(decorator, typeAnnotation, actualType);

          // Report mismatch
          if (!matches) {
            const expectedTypes = decoratorTypeMap[decorator];
            context.report({
              node,
              messageId: 'mismatch',
              data: {
                decorator,
                actualType,
                expectedTypes: expectedTypes?.join(' or ') || 'unknown',
              },
            });
          }
        }

        // Check for complex object types (not arrays) needing @ValidateNested
        const hasTypedDecorator = decorators.some((d) => !TYPE_AGNOSTIC_DECORATORS.has(d) && decoratorTypeMap[d]);

        if (!isArrayType(typeAnnotation) && isComplexType(typeAnnotation) && !hasTypedDecorator) {
          // Complex types should have @ValidateNested()
          if (!hasValidateNested && decorators.length > 0) {
            context.report({
              node,
              messageId: 'missingValidateNested',
              data: {
                actualType,
              },
            });
          }
        }
      },
    };
  },
});
