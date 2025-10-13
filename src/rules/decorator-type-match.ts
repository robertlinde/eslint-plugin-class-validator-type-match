import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import type * as ts from 'typescript';

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
  | 'unnecessaryValidateNested'
  | 'invalidEachOption'
  | 'missingTypeDecorator'
  | 'tupleValidationWarning'
  | 'multiTypeUnionWarning'
  | 'mixedComplexityUnionWarning'
  | 'pickOmitWarning';
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
 * Extracts the name from a TSQualifiedName or Identifier
 */
function getTypeReferenceName(typeName: TSESTree.EntityName): string {
  if (typeName.type === 'Identifier') {
    return typeName.name;
  }

  // Handle TSQualifiedName (e.g., MyNamespace.MyEnum)
  if (typeName.type === 'TSQualifiedName') {
    const parts: string[] = [];
    let current: TSESTree.Node = typeName;

    while (current.type === 'TSQualifiedName') {
      if (current.right.type === 'Identifier') {
        parts.unshift(current.right.name);
      }
      current = current.left;
    }

    if (current.type === 'Identifier') {
      parts.unshift(current.name);
    }

    return parts.join('.');
  }

  return '';
}

/**
 * Uses TypeScript's type checker to resolve the actual type, handling type aliases.
 * Returns the resolved type string, or null if it cannot be determined.
 */
function resolveTypeWithChecker(
  typeNode: TSESTree.TypeNode,
  checker: ts.TypeChecker | null,
  esTreeNodeMap: {get(key: TSESTree.Node): ts.Node | undefined} | null,
): string | null {
  if (!checker || !esTreeNodeMap) {
    return null;
  }

  const tsNode = esTreeNodeMap.get(typeNode);
  if (!tsNode) {
    return null;
  }

  try {
    const type = checker.getTypeAtLocation(tsNode);

    // Check for primitive types using TypeScript's type flags
    if (type.flags & (1 << 2)) return 'string'; // ts.TypeFlags.String
    if (type.flags & (1 << 3)) return 'number'; // ts.TypeFlags.Number
    if (type.flags & (1 << 4)) return 'boolean'; // ts.TypeFlags.Boolean

    // Check if it's an array type
    if (checker.isArrayType(type)) {
      return 'array';
    }

    // Check if it's a tuple type
    // TypeScript's ObjectType has objectFlags property, but it's not exposed in the public types
    if ('objectFlags' in type && (type as ts.ObjectType).objectFlags & 8) {
      // ts.ObjectFlags.Tuple = 8
      return 'array';
    }

    // For other types, fall back to AST analysis
    return null;
  } catch {
    return null;
  }
}

/**
 * Converts a TypeScript type node to its string representation for validation purposes.
 * Handles primitives, arrays, tuples, type references, literals, unions, and intersections.
 * Returns null for types that cannot be validated.
 *
 * Can optionally use TypeScript's type checker to resolve type aliases.
 */
function getTypeString(
  typeNode: TSESTree.TypeNode,
  checker: ts.TypeChecker | null = null,
  esTreeNodeMap: {get(key: TSESTree.Node): ts.Node | undefined} | null = null,
): string | null {
  // Try to resolve with type checker first (handles type aliases)
  if (checker && esTreeNodeMap) {
    const resolved = resolveTypeWithChecker(typeNode, checker, esTreeNodeMap);
    if (resolved) {
      return resolved;
    }
  }

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
    case 'TSTemplateLiteralType':
      return 'string';
    case 'TSTypeReference':
      return getTypeReferenceName(unwrapped.typeName);
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
      // Check if intersection contains a primitive type (branded types)
      for (const type of unwrapped.types) {
        const typeStr = getTypeString(type, checker, esTreeNodeMap);
        if (typeStr === 'string' || typeStr === 'number' || typeStr === 'boolean') {
          return typeStr;
        }
      }
      return 'intersection';
  }
  return null;
}

/**
 * Extracts the element type from an array type annotation.
 * Supports T[] and Array<T> syntax.
 * For tuple types, returns null since they require per-element validation.
 */
function getArrayElementTypeNode(typeAnnotation: TSESTree.TypeNode): TSESTree.TypeNode | null {
  const unwrapped = unwrapReadonlyOperator(typeAnnotation);

  // Handle Type[] syntax
  if (unwrapped.type === 'TSArrayType') {
    return unwrapped.elementType;
  }

  // Handle Array<Type> and ReadonlyArray<Type> syntax
  if (
    unwrapped.type === 'TSTypeReference' &&
    unwrapped.typeName.type === 'Identifier' &&
    (unwrapped.typeName.name === 'Array' || unwrapped.typeName.name === 'ReadonlyArray') &&
    unwrapped.typeArguments?.params[0]
  ) {
    return unwrapped.typeArguments.params[0];
  }

  // Tuples require special handling
  if (unwrapped.type === 'TSTupleType') {
    return null;
  }

  return null;
}

/**
 * Gets all element types from a tuple type.
 */
function getTupleElementTypes(typeAnnotation: TSESTree.TypeNode): TSESTree.TypeNode[] {
  const unwrapped = unwrapReadonlyOperator(typeAnnotation);

  if (unwrapped.type === 'TSTupleType') {
    return unwrapped.elementTypes.map((element) => {
      // Handle named tuple elements: [name: Type]
      if (element.type === 'TSNamedTupleMember') {
        return element.elementType;
      }
      return element;
    });
  }

  return [];
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
 * Checks if a type reference is a Record utility type with a primitive value type.
 * Record<string, number> = not complex
 * Record<string, Address> = complex
 */
function isRecordWithPrimitiveValue(
  typeNode: TSESTree.TypeNode,
  checker: ts.TypeChecker | null,
  esTreeNodeMap: {get(key: TSESTree.Node): ts.Node | undefined} | null,
): boolean {
  const unwrapped = unwrapReadonlyOperator(typeNode);

  if (unwrapped.type !== 'TSTypeReference') {
    return false;
  }

  const typeName = getTypeReferenceName(unwrapped.typeName);
  if (typeName !== 'Record') {
    return false;
  }

  // Check if it has type arguments
  if (!unwrapped.typeArguments || unwrapped.typeArguments.params.length < 2) {
    return false;
  }

  // Get the value type (second type argument)
  const valueType = unwrapped.typeArguments.params[1];
  const valueTypeStr = getTypeString(valueType, checker, esTreeNodeMap);

  // If value type is a primitive, Record is not complex
  return valueTypeStr === 'string' || valueTypeStr === 'number' || valueTypeStr === 'boolean';
}

/**
 * Gets the underlying type from utility types like Partial, Required, Pick, Omit, etc.
 * Returns null if not a supported utility type or if type arguments are missing.
 */
function getUtilityTypeArgument(
  typeNode: TSESTree.TypeNode,
): {utilityType: string; typeArgument: TSESTree.TypeNode; allTypeArguments: TSESTree.TypeNode[]} | null {
  const unwrapped = unwrapReadonlyOperator(typeNode);

  if (unwrapped.type !== 'TSTypeReference') {
    return null;
  }

  const typeName = getTypeReferenceName(unwrapped.typeName);
  const supportedUtilityTypes = [
    'Partial',
    'Required',
    'Pick',
    'Omit',
    'Readonly',
    'NonNullable',
    'Extract',
    'Exclude',
    'ReadonlyArray',
  ];

  if (!supportedUtilityTypes.includes(typeName)) {
    return null;
  }

  // All these utility types have at least one type argument
  if (!unwrapped.typeArguments || unwrapped.typeArguments.params.length === 0) {
    return null;
  }

  return {
    utilityType: typeName,
    typeArgument: unwrapped.typeArguments.params[0],
    allTypeArguments: unwrapped.typeArguments.params,
  };
}

/**
 * Unwraps utility types to get the base type reference for @Type decorator suggestions.
 * For Pick<User, 'name'> -> returns User
 * For Partial<Address> -> returns Address
 */
function unwrapUtilityTypeForClassName(typeNode: TSESTree.TypeNode): TSESTree.TypeNode {
  let current = typeNode;

  // Keep unwrapping utility types until we hit the base type
  while (true) {
    const utilityInfo = getUtilityTypeArgument(current);
    if (!utilityInfo) {
      break;
    }

    // Use the first argument, assuming it's the source type for most utility types
    current = utilityInfo.typeArgument;
  }

  return current;
}

/**
 * Analyzes a union type to determine its composition.
 * Returns information about what types are present in the union.
 * Uses isComplexType to accurately classify each union member.
 */
function analyzeUnionType(
  typeNode: TSESTree.TypeNode,
  checker: ts.TypeChecker | null = null,
  esTreeNodeMap: {get(key: TSESTree.Node): ts.Node | undefined} | null = null,
): {
  isNullable: boolean;
  hasMultiplePrimitives: boolean;
  hasMultipleComplexTypes: boolean;
  hasMixedComplexity: boolean;
  nonNullTypes: TSESTree.TypeNode[];
  primitiveTypes: string[];
  complexTypes: TSESTree.TypeNode[];
} {
  const result = {
    isNullable: false,
    hasMultiplePrimitives: false,
    hasMultipleComplexTypes: false,
    hasMixedComplexity: false,
    nonNullTypes: [] as TSESTree.TypeNode[],
    primitiveTypes: [] as string[],
    complexTypes: [] as TSESTree.TypeNode[],
  };

  if (typeNode.type !== 'TSUnionType') {
    return result;
  }

  for (const type of typeNode.types) {
    if (type.type === 'TSNullKeyword' || type.type === 'TSUndefinedKeyword') {
      result.isNullable = true;
      continue;
    }

    result.nonNullTypes.push(type);

    // Use isComplexType for accurate classification
    const typeIsComplex = isComplexType(type, checker, esTreeNodeMap);

    if (typeIsComplex) {
      result.complexTypes.push(type);
    } else {
      // It's a simple/primitive type
      const typeStr = getTypeString(type, checker, esTreeNodeMap);
      if (typeStr) {
        result.primitiveTypes.push(typeStr);
      }
    }
  }

  result.hasMultiplePrimitives = result.primitiveTypes.length > 1;
  result.hasMultipleComplexTypes = result.complexTypes.length > 1;
  result.hasMixedComplexity = result.primitiveTypes.length > 0 && result.complexTypes.length > 0;

  return result;
}

/**
 * Determines if a type requires @ValidateNested decorator for proper validation.
 * Complex types include objects, class instances, type literals, and intersections.
 * Arrays of complex types are also considered complex.
 * Built-in types with complex generic parameters are checked selectively.
 * Union types are complex if any non-null/undefined member is complex.
 */
function isComplexType(
  typeNode: TSESTree.TypeNode,
  checker: ts.TypeChecker | null = null,
  esTreeNodeMap: {get(key: TSESTree.Node): ts.Node | undefined} | null = null,
): boolean {
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
  if (unwrapped.type === 'TSUnionType') {
    const unionAnalysis = analyzeUnionType(unwrapped, checker, esTreeNodeMap);
    // If there are any complex types in the union, it's complex
    return unionAnalysis.complexTypes.length > 0;
  }

  // Intersection types: check if any member is a primitive (branded types)
  if (unwrapped.type === 'TSIntersectionType') {
    // If intersection contains a primitive, treat as primitive (branded type)
    for (const type of unwrapped.types) {
      const typeStr = getTypeString(type, checker, esTreeNodeMap);
      if (typeStr === 'string' || typeStr === 'number' || typeStr === 'boolean') {
        return false;
      }
    }
    // Otherwise, it's a complex intersection
    return true;
  }

  // Arrays are complex if their elements are complex
  if (unwrapped.type === 'TSArrayType') {
    return isComplexType(unwrapped.elementType, checker, esTreeNodeMap);
  }

  // Tuples are complex if any element is complex
  if (unwrapped.type === 'TSTupleType') {
    const elements = getTupleElementTypes(unwrapped);
    return elements.some((element) => isComplexType(element, checker, esTreeNodeMap));
  }

  // Check for type references (class names, interfaces, etc.)
  if (unwrapped.type === 'TSTypeReference') {
    const typeName = getTypeReferenceName(unwrapped.typeName);

    // Common built-in types that don't require @ValidateNested
    const builtInTypes = ['String', 'Number', 'Boolean', 'Date'];

    // Types that can't be validated even with generic parameters
    const nonValidatableTypes = ['Promise', 'Map', 'Set'];

    if (nonValidatableTypes.includes(typeName)) {
      return false;
    }

    // Check for utility types - delegate to the underlying type
    const utilityTypeInfo = getUtilityTypeArgument(unwrapped);
    if (utilityTypeInfo) {
      // ReadonlyArray<T> behaves like Array<T>
      if (utilityTypeInfo.utilityType === 'ReadonlyArray') {
        return isComplexType(utilityTypeInfo.typeArgument, checker, esTreeNodeMap);
      }

      // Partial<T>, Required<T>, Readonly<T>, Pick<T, K>, Omit<T, K>
      // For complexity checking, we need to use the type checker if available
      if (['Partial', 'Required', 'Readonly', 'Pick', 'Omit'].includes(utilityTypeInfo.utilityType)) {
        // Try to resolve with type checker first for Pick/Omit
        if (
          checker &&
          esTreeNodeMap &&
          (utilityTypeInfo.utilityType === 'Pick' || utilityTypeInfo.utilityType === 'Omit')
        ) {
          const resolved = resolveTypeWithChecker(unwrapped, checker, esTreeNodeMap);
          if (resolved) {
            // If type checker resolved it to a primitive, it's not complex
            return resolved !== 'string' && resolved !== 'number' && resolved !== 'boolean' && resolved !== 'Date';
          }
        }

        // Fall back to checking if the underlying type is complex
        // Note: Pick/Omit always create object types, but if we can't resolve with type checker,
        // we check the source type. This may produce false positives for Pick<Complex, 'primitiveField'>
        // but it's safer than false negatives.
        return isComplexType(utilityTypeInfo.typeArgument, checker, esTreeNodeMap);
      }

      // NonNullable<T> - check if the underlying type is complex
      if (utilityTypeInfo.utilityType === 'NonNullable') {
        return isComplexType(utilityTypeInfo.typeArgument, checker, esTreeNodeMap);
      }

      // Extract<T, U> and Exclude<T, U> - check the first type argument
      if (utilityTypeInfo.utilityType === 'Extract' || utilityTypeInfo.utilityType === 'Exclude') {
        return isComplexType(utilityTypeInfo.typeArgument, checker, esTreeNodeMap);
      }
    }

    // Record<K, V> with primitive V is not complex
    if (isRecordWithPrimitiveValue(unwrapped, checker, esTreeNodeMap)) {
      return false;
    }

    // Array<T> needs to check the element type
    if (typeName === 'Array' && unwrapped.typeArguments?.params[0]) {
      return isComplexType(unwrapped.typeArguments.params[0], checker, esTreeNodeMap);
    }

    // Other built-in types are not complex
    if (builtInTypes.includes(typeName)) {
      return false;
    }

    return true;
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
    (unwrapped.typeName.name === 'Array' || unwrapped.typeName.name === 'ReadonlyArray')
  ) {
    return true;
  }

  if (unwrapped.type === 'TSTupleType') {
    return true;
  }

  return false;
}

/**
 * Checks if a type is a tuple type.
 */
function isTupleType(typeAnnotation: TSESTree.TypeNode): boolean {
  const unwrapped = unwrapReadonlyOperator(typeAnnotation);
  return unwrapped.type === 'TSTupleType';
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
 * Handles special cases like @IsEnum validation, nullable unions, and utility types.
 */
function checkTypeMatch(
  decorator: string,
  typeAnnotation: TSESTree.TypeNode,
  actualType: string,
  checker: ts.TypeChecker | null,
  esTreeNodeMap: {get(key: TSESTree.Node): ts.Node | undefined} | null,
): boolean {
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
    if (typeAnnotation.type === 'TSTypeReference') {
      return expectedTypes.includes('type-reference');
    }
    return false;
  }

  // For utility types, unwrap to the underlying type
  const utilityTypeInfo = getUtilityTypeArgument(typeAnnotation);
  if (utilityTypeInfo && utilityTypeInfo.utilityType !== 'ReadonlyArray') {
    // Recursively check the underlying type
    const underlyingType = getTypeString(utilityTypeInfo.typeArgument, checker, esTreeNodeMap);
    if (underlyingType) {
      return checkTypeMatch(decorator, utilityTypeInfo.typeArgument, underlyingType, checker, esTreeNodeMap);
    }
  }

  // For nullable unions (T | null | undefined), validate against the base type
  const nullableCheck = isNullableUnion(typeAnnotation);
  if (nullableCheck.isNullable && nullableCheck.baseType) {
    const baseTypeString = getTypeString(nullableCheck.baseType, checker, esTreeNodeMap);
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
 * - Nested arrays (Address[][])
 * - Type literals
 * - class-transformer decorators
 * - Enum types (both TypeScript enums and union types)
 * - Literal types (e.g., "admin", 25)
 * - Intersection types (e.g., Profile & Settings)
 * - Branded types (string & { __brand: 'UserId' })
 * - @Type(() => ClassName) decorator matching
 * - Readonly arrays (readonly T[])
 * - Tuple types ([T, U])
 * - Nullable unions (T | null | undefined)
 * - Unnecessary @ValidateNested on primitive arrays
 * - Decorators with { each: true } option for array element validation
 * - Template literal types (`user-${string}`)
 * - Namespace/qualified type references (MyNamespace.MyEnum)
 * - Invalid { each: true } on non-array types
 * - Missing @Type decorator when @ValidateNested is present
 * - Type aliases (via TypeScript type checker)
 * - Record<K, V> utility types with primitive values
 * - Utility types: Partial<T>, Required<T>, Pick<T, K>, Omit<T, K>, ReadonlyArray<T>, NonNullable<T>, Extract<T, U>, Exclude<T, U>
 * - Multi-type unions with explicit warnings for complex scenarios
 * - Mixed complexity unions (primitive | complex types)
 */
export default createRule<Options, MessageIds>({
  name: 'decorator-type-match',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure class-validator decorators match TypeScript type annotations, including arrays of objects, nested objects, enum types, literal types, intersection types, readonly arrays, tuple types, nullable unions, @Type decorator matching, { each: true } option handling, template literals, namespace references, type aliases, branded types, Record utility types, and other utility types (Partial, Required, Pick, Omit, ReadonlyArray, NonNullable, Extract, Exclude). Provides explicit warnings for multi-type unions.',
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
      invalidEachOption:
        'Decorator @{{decorator}} has { each: true } option but property type is not an array. Remove { each: true } or change type to an array.',
      missingTypeDecorator:
        'Complex type {{actualType}} with @ValidateNested() requires @Type(() => {{className}}) decorator for proper transformation.',
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

        const hasValidateNested = decorators.includes('ValidateNested');
        const hasIsEnum = decorators.includes('IsEnum');
        const hasTypeDecorator = decorators.includes('Type');

        // Validate @IsEnum argument matches the type annotation for enum type references
        if (hasIsEnum && typeAnnotation.type === 'TSTypeReference') {
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
            if (enumArg && enumArg !== typeName) {
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

                // Check if @Type decorator is present for complex element types
                if (!hasTypeDecorator) {
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
                  ? getTypeReferenceName(utilityInfo.typeArgument.typeName)
                  : 'unknown';

              context.report({
                node,
                messageId: 'pickOmitWarning',
                data: {
                  utilityType: utilityInfo.utilityType,
                  baseType: baseTypeName,
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

        // Check if complex non-array types with @ValidateNested also have @Type
        if (
          !isArrayType(typeAnnotation) &&
          isComplexType(typeAnnotation, checker, esTreeNodeMap) &&
          hasValidateNested &&
          !hasTypeDecorator
        ) {
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
      },
    };
  },
});
