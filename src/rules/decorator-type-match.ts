import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

/**
 * Creates an ESLint rule with proper documentation URL
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/robertlinde/eslint-plugin-class-validator-type-match#${name}`,
);

type MessageIds =
  | 'mismatch'
  | 'nestedArrayMismatch'
  | 'missingValidateNested'
  | 'enumMismatch'
  | 'typeMismatch'
  | 'missingEachOption'
  | 'unnecessaryValidateNested';
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
  'IsNotEmpty',
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
 */
const decoratorTypeMap: Record<string, string[]> = {
  // String validators
  IsString: ['string'],
  IsAlpha: ['string'],
  IsAlphanumeric: ['string'],
  IsAscii: ['string'],
  IsBase32: ['string'],
  IsBase64: ['string'],
  IsBIC: ['string'],
  IsBtcAddress: ['string'],
  IsByteLength: ['string'],
  IsCreditCard: ['string'],
  IsCurrency: ['string'],
  IsDataURI: ['string'],
  IsDecimal: ['string'],
  IsEmail: ['string'],
  IsEthereumAddress: ['string'],
  IsFQDN: ['string'],
  IsFirebasePushId: ['string'],
  IsFullWidth: ['string'],
  IsHalfWidth: ['string'],
  IsHash: ['string'],
  IsHexColor: ['string'],
  IsHSL: ['string'],
  IsIBAN: ['string'],
  IsIdentityCard: ['string'],
  IsIP: ['string'],
  IsIPRange: ['string'],
  IsISBN: ['string'],
  IsISIN: ['string'],
  IsISO8601: ['string'],
  IsISO31661Alpha2: ['string'],
  IsISO31661Alpha3: ['string'],
  IsISO4217CurrencyCode: ['string'],
  IsISSN: ['string'],
  IsJSON: ['string'],
  IsJWT: ['string'],
  IsLatLong: ['string'],
  IsLocale: ['string'],
  IsLowercase: ['string'],
  IsMACAddress: ['string'],
  IsMD5: ['string'],
  IsMimeType: ['string'],
  IsMilitaryTime: ['string'],
  IsMobilePhone: ['string'],
  IsMongoId: ['string'],
  IsMultibyte: ['string'],
  IsNumberString: ['string'],
  IsOctal: ['string'],
  IsPassportNumber: ['string'],
  IsPhoneNumber: ['string'],
  IsPort: ['string'],
  IsPostalCode: ['string'],
  IsRFC3339: ['string'],
  IsRgbColor: ['string'],
  IsSemVer: ['string'],
  IsStrongPassword: ['string'],
  IsSurrogatePair: ['string'],
  IsTimeZone: ['string'],
  IsUppercase: ['string'],
  IsUrl: ['string'],
  IsUUID: ['string'],
  IsVariableWidth: ['string'],
  IsHexadecimal: ['string'],
  Length: ['string'],
  MaxLength: ['string'],
  MinLength: ['string'],
  Matches: ['string'],
  Contains: ['string'],
  NotContains: ['string'],
  IsDateString: ['string'],

  // Number validators
  IsNumber: ['number'],
  IsInt: ['number'],
  IsPositive: ['number'],
  IsNegative: ['number'],
  IsDivisibleBy: ['number'],
  IsLatitude: ['number'],
  IsLongitude: ['number'],
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
  ArrayContains: ['array', 'Array'],
  ArrayNotContains: ['array', 'Array'],
  ArrayNotEmpty: ['array', 'Array'],
  ArrayUnique: ['array', 'Array'],

  // Object validators
  IsObject: ['object'],
  IsNotEmptyObject: ['object'],
  IsInstance: ['object'],

  // Enum validators - special handling for union types and enum references
  IsEnum: ['enum', 'union-literal', 'type-reference'],
};

/**
 * Removes readonly type operator to access the underlying type.
 * Other type operators like keyof and unique are preserved.
 */
function unwrapReadonlyOperator(typeNode: TSESTree.TypeNode): TSESTree.TypeNode {
  let current = typeNode;
  while (current.type === 'TSTypeOperator' && current.operator === 'readonly') {
    // TSTypeOperator always has a typeAnnotation, but TypeScript types it as possibly undefined
    if (!current.typeAnnotation) {
      break;
    }
    current = current.typeAnnotation;
  }
  return current;
}

/**
 * Determines if a union type represents a nullable value (T | null | undefined)
 * where T is a single non-null/undefined type.
 *
 * @returns Object indicating if the union is nullable and what the base type is
 */
function isNullableUnion(typeNode: TSESTree.TypeNode): {isNullable: boolean; baseType: TSESTree.TypeNode | null} {
  if (typeNode.type !== 'TSUnionType') {
    return {isNullable: false, baseType: null};
  }

  let baseType: TSESTree.TypeNode | null = null;
  let hasNull = false;
  let hasUndefined = false;

  for (const type of typeNode.types) {
    if (type.type === 'TSNullKeyword') {
      hasNull = true;
    } else if (type.type === 'TSUndefinedKeyword') {
      hasUndefined = true;
    } else if (baseType === null) {
      baseType = type;
    } else {
      // More than one non-null/undefined type, not a simple nullable union
      return {isNullable: false, baseType: null};
    }
  }

  // Must have exactly one base type and at least one null/undefined
  if (baseType && (hasNull || hasUndefined)) {
    return {isNullable: true, baseType};
  }

  return {isNullable: false, baseType: null};
}

/**
 * Converts a TypeScript type node to its string representation for validation purposes.
 * Handles primitives, arrays, tuples, type references, literals, unions, and intersections.
 * Returns null for types that cannot be validated.
 */
function getTypeString(typeNode: TSESTree.TypeNode): string | null {
  const unwrapped = unwrapReadonlyOperator(typeNode);

  switch (unwrapped.type) {
    case 'TSStringKeyword':
      return 'string';
    case 'TSNumberKeyword':
      return 'number';
    case 'TSBooleanKeyword':
      return 'boolean';
    case 'TSArrayType':
      return 'array';
    case 'TSTupleType':
      return 'array';
    case 'TSTypeReference':
      if (unwrapped.typeName.type === 'Identifier') {
        return unwrapped.typeName.name;
      }
      break;
    case 'TSTypeLiteral':
      return 'object';
    case 'TSUnionType':
      return 'union';
    case 'TSLiteralType':
      if (unwrapped.literal.type === 'Literal') {
        if (typeof unwrapped.literal.value === 'string') return 'string';
        if (typeof unwrapped.literal.value === 'number') return 'number';
        if (typeof unwrapped.literal.value === 'boolean') return 'boolean';
      }
      return 'literal';
    case 'TSIntersectionType':
      return 'intersection';
  }
  return null;
}

/**
 * Extracts the element type from an array type annotation.
 * Supports T[] and Array<T> syntax.
 * Returns null for tuple types since they don't have a single element type.
 */
function getArrayElementTypeNode(typeAnnotation: TSESTree.TypeNode): TSESTree.TypeNode | null {
  const unwrapped = unwrapReadonlyOperator(typeAnnotation);

  // Handle Type[] syntax
  if (unwrapped.type === 'TSArrayType') {
    return unwrapped.elementType;
  }

  // Handle Array<Type> syntax
  if (
    unwrapped.type === 'TSTypeReference' &&
    unwrapped.typeName.type === 'Identifier' &&
    unwrapped.typeName.name === 'Array' &&
    unwrapped.typeArguments?.params[0]
  ) {
    return unwrapped.typeArguments.params[0];
  }

  // Tuples don't have a single element type to validate
  if (unwrapped.type === 'TSTupleType') {
    return null;
  }

  return null;
}

/**
 * Checks if a type is a union of literal types (e.g., 'active' | 'inactive').
 * These are typically used for enum-like type definitions.
 */
function isUnionOfLiterals(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === 'TSUnionType') {
    return typeNode.types.every((type) => type.type === 'TSLiteralType');
  }
  return false;
}

/**
 * Determines if a type requires @ValidateNested decorator for proper validation.
 * Complex types include objects, class instances, type literals, and intersections.
 * Built-in types with complex generic parameters are also considered complex.
 * Union types are complex if any non-null/undefined member is complex.
 */
function isComplexType(typeNode: TSESTree.TypeNode): boolean {
  const unwrapped = unwrapReadonlyOperator(typeNode);

  // Type literals are always complex
  if (unwrapped.type === 'TSTypeLiteral') {
    return true;
  }

  // Union types of literals are not complex (they're enum-like)
  if (isUnionOfLiterals(unwrapped)) {
    return false;
  }

  // Union types are complex if any non-null/undefined member is complex
  // This handles cases like: Address | null, Address | undefined, Address | Profile
  if (unwrapped.type === 'TSUnionType') {
    return unwrapped.types.some((type) => {
      // Skip null and undefined - they don't affect complexity
      if (type.type === 'TSNullKeyword' || type.type === 'TSUndefinedKeyword') {
        return false;
      }
      // Recursively check if this union member is complex
      return isComplexType(type);
    });
  }

  // Intersection types are complex
  if (unwrapped.type === 'TSIntersectionType') {
    return true;
  }

  // Check for type references (class names, interfaces, etc.)
  if (unwrapped.type === 'TSTypeReference' && unwrapped.typeName.type === 'Identifier') {
    const typeName = unwrapped.typeName.name;
    // Common built-in types that don't require @ValidateNested
    // This list focuses on types commonly used in validation contexts
    const builtInTypes = ['String', 'Number', 'Boolean', 'Date', 'Array', 'Promise', 'Map', 'Set'];

    // Built-in types with complex generic parameters are considered complex
    if (builtInTypes.includes(typeName) && unwrapped.typeArguments?.params) {
      for (const param of unwrapped.typeArguments.params) {
        if (isComplexType(param)) {
          return true;
        }
      }
      return false;
    }

    return !builtInTypes.includes(typeName);
  }

  return false;
}

/**
 * Checks if a type represents an array.
 * Handles T[], Array<T>, and tuple types.
 */
function isArrayType(typeAnnotation: TSESTree.TypeNode): boolean {
  const unwrapped = unwrapReadonlyOperator(typeAnnotation);

  if (unwrapped.type === 'TSArrayType') {
    return true;
  }

  if (
    unwrapped.type === 'TSTypeReference' &&
    unwrapped.typeName.type === 'Identifier' &&
    unwrapped.typeName.name === 'Array'
  ) {
    return true;
  }

  if (unwrapped.type === 'TSTupleType') {
    return true;
  }

  return false;
}

/**
 * Checks if a type is a union of literals, used for enum-like type definitions.
 */
function isUnionEnumType(typeNode: TSESTree.TypeNode): boolean {
  return isUnionOfLiterals(typeNode);
}

/**
 * Extracts the enum reference from @IsEnum() decorator argument.
 * Handles both simple identifiers (MyEnum) and member expressions (MyNamespace.MyEnum).
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
 * Extracts the class name from @Type(() => ClassName) decorator.
 * Supports both arrow functions and function expressions.
 */
function getTypeDecoratorClassName(decorator: TSESTree.Decorator): string | null {
  if (decorator.expression.type === 'CallExpression' && decorator.expression.arguments.length > 0) {
    const firstArg = decorator.expression.arguments[0];

    // Handle arrow function: () => ClassName
    if (firstArg.type === 'ArrowFunctionExpression' && firstArg.body.type === 'Identifier') {
      return firstArg.body.name;
    }

    // Handle function expression: function() { return ClassName; }
    if (
      firstArg.type === 'FunctionExpression' &&
      firstArg.body.type === 'BlockStatement' &&
      firstArg.body.body.length > 0
    ) {
      const returnStmt = firstArg.body.body[0];
      if (returnStmt.type === 'ReturnStatement' && returnStmt.argument?.type === 'Identifier') {
        return returnStmt.argument.name;
      }
    }
  }

  return null;
}

/**
 * Checks if a decorator includes the { each: true } option.
 * Returns false for decorators without parentheses or without the each option.
 * This works for any decorator, not just @ValidateNested.
 *
 * Handles both single and two-parameter decorator signatures:
 * - @IsString({ each: true })
 * - @IsNumber({}, { each: true })
 * - @Min(0, { each: true })
 */
function hasEachOption(decorator: TSESTree.Decorator): boolean {
  // If decorator is used without parentheses (e.g., @IsString), it has no options
  if (decorator.expression.type === 'Identifier') {
    return false;
  }

  if (decorator.expression.type === 'CallExpression') {
    const args = decorator.expression.arguments;

    // Check both first and second arguments for { each: true }
    // Some decorators have validation options as first param: @IsString({ each: true })
    // Others have it as second param: @Min(0, { each: true })
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
}

/**
 * Checks if @ValidateNested decorator includes the { each: true } option.
 * Returns false for decorators without parentheses or without the each option.
 */
function hasValidateNestedEachOption(decorator: TSESTree.Decorator): boolean {
  return hasEachOption(decorator);
}

/**
 * Validates if a decorator matches the TypeScript type annotation.
 * Handles special cases like @IsEnum validation and nullable unions.
 */
function checkTypeMatch(decorator: string, typeAnnotation: TSESTree.TypeNode, actualType: string): boolean {
  const expectedTypes = decoratorTypeMap[decorator];

  // Skip decorators not in our map
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

  // For nullable unions (T | null | undefined), validate against the base type
  const nullableCheck = isNullableUnion(typeAnnotation);
  if (nullableCheck.isNullable && nullableCheck.baseType) {
    const baseTypeString = getTypeString(nullableCheck.baseType);
    if (baseTypeString) {
      return expectedTypes.some((expected) => {
        if (expected === 'array' && baseTypeString === 'Array') return true;
        if (expected === 'Array' && baseTypeString === 'array') return true;
        return expected === baseTypeString;
      });
    }
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
 * - Nullable complex types (Address | null, Address | undefined)
 * - Arrays of nullable complex types ((Address | null)[])
 * - Type literals
 * - class-transformer decorators
 * - Enum types (both TypeScript enums and union types)
 * - Literal types (e.g., "admin", 25)
 * - Intersection types (e.g., Profile & Settings)
 * - @Type(() => ClassName) decorator matching
 * - Readonly arrays (readonly T[])
 * - Tuple types ([T, U])
 * - Nullable unions (T | null | undefined)
 * - Unnecessary @ValidateNested on primitive arrays
 * - Decorators with { each: true } option for array element validation
 */
export default createRule<Options, MessageIds>({
  name: 'decorator-type-match',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure class-validator decorators match TypeScript type annotations, including arrays of objects, nested objects, enum types, literal types, intersection types, readonly arrays, tuple types, nullable unions, @Type decorator matching, and { each: true } option handling',
    },
    messages: {
      mismatch: 'Decorator @{{decorator}} does not match type annotation {{actualType}}. Expected: {{expectedTypes}}',
      nestedArrayMismatch:
        'Array contains complex type {{elementType}}. Add @ValidateNested({ each: true }) decorator to validate array elements.',
      missingValidateNested: 'Complex type {{actualType}} requires @ValidateNested() decorator for proper validation.',
      enumMismatch:
        '@IsEnum({{enumArg}}) does not match type annotation {{actualType}}. Ensure the enum argument matches the type.',
      typeMismatch: '@Type(() => {{typeDecoratorClass}}) does not match type annotation {{actualType}}.',
      missingEachOption:
        'Array of complex types requires @ValidateNested({ each: true }), but only @ValidateNested() was found.',
      unnecessaryValidateNested:
        'Array of primitive type {{elementType}} does not need @ValidateNested(). Remove @ValidateNested() or use @{{decorator}}({ each: true }) instead.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
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
         */
        actualType = getTypeString(typeAnnotation);

        // Skip if we couldn't determine the type
        if (!actualType) return;

        const hasValidateNested = decorators.includes('ValidateNested');
        const hasIsEnum = decorators.includes('IsEnum');

        // Validate @IsEnum argument matches the type annotation for enum type references
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
            if (typeAnnotation.type === 'TSTypeReference' && typeAnnotation.typeName.type === 'Identifier') {
              const tsTypeName = typeAnnotation.typeName.name;

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
            } else if (typeAnnotation.type !== 'TSTypeReference') {
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
              if (elementTypeNode.type === 'TSTypeReference' && elementTypeNode.typeName.type === 'Identifier') {
                const elementTypeName = elementTypeNode.typeName.name;

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
                const elementType = getTypeString(elementTypeNode);
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

        // Validate arrays of complex types have proper nested validation
        if (isArrayType(typeAnnotation)) {
          const elementTypeNode = getArrayElementTypeNode(typeAnnotation);

          // Tuples return null for elementTypeNode, skip nested validation check
          if (elementTypeNode) {
            const elementTypeName = getTypeString(elementTypeNode);
            const isElementComplex = isComplexType(elementTypeNode);

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

          let typeToCheck = actualType;
          let typeNodeToCheck = typeAnnotation;

          // If decorator has { each: true }, validate against array element type
          if (hasEach && isArrayType(typeAnnotation)) {
            const elementTypeNode = getArrayElementTypeNode(typeAnnotation);
            if (elementTypeNode) {
              const elementType = getTypeString(elementTypeNode);
              if (elementType) {
                typeToCheck = elementType;
                typeNodeToCheck = elementTypeNode;
              }
            }
          }

          const matches = checkTypeMatch(decorator, typeNodeToCheck, typeToCheck);

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

        // Validate complex object types have @ValidateNested decorator
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
