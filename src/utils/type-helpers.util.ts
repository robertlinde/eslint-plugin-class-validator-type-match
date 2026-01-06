import type {TSESTree} from '@typescript-eslint/utils';
import type * as ts from 'typescript';

/**
 * Decorators that don't enforce specific types and can work with any type.
 * These are used for validation logic rather than type checking.
 */
export const TYPE_AGNOSTIC_DECORATORS = new Set([
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
export const decoratorTypeMap: Record<string, string[]> = {
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
export function unwrapReadonlyOperator(typeNode: TSESTree.TypeNode): TSESTree.TypeNode {
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
export function isNullableUnion(typeNode: TSESTree.TypeNode): {
  isNullable: boolean;
  baseType: TSESTree.TypeNode | null;
} {
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
export function getTypeReferenceName(typeName: TSESTree.EntityName): string {
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
export function resolveTypeWithChecker(
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
export function getTypeString(
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
export function getArrayElementTypeNode(typeAnnotation: TSESTree.TypeNode): TSESTree.TypeNode | null {
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
export function getTupleElementTypes(typeAnnotation: TSESTree.TypeNode): TSESTree.TypeNode[] {
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
export function isUnionOfLiterals(typeNode: TSESTree.TypeNode): boolean {
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
export function isRecordWithPrimitiveValue(
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
export function getUtilityTypeArgument(
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
export function unwrapUtilityTypeForClassName(typeNode: TSESTree.TypeNode): TSESTree.TypeNode {
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
export function analyzeUnionType(
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
export function isComplexType(
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

    // Check if it's an enum type by using the type checker
    // Enums are type references but should not be treated as complex types
    // They can be validated with @IsEnum instead of @ValidateNested
    if (checker && esTreeNodeMap) {
      const tsNode = esTreeNodeMap.get(unwrapped);
      if (tsNode) {
        try {
          const type = checker.getTypeAtLocation(tsNode);
          // Check if it's an enum type using TypeScript's type flags
          // ts.TypeFlags.Enum = 1 << 10 = 1024
          // ts.TypeFlags.EnumLiteral = 1 << 11 = 2048
          if (type.flags & 1024 || type.flags & 2048) {
            return false;
          }
        } catch {
          // If we can't determine, continue with other checks
        }
      }
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
export function isArrayType(typeAnnotation: TSESTree.TypeNode): boolean {
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
export function isTupleType(typeAnnotation: TSESTree.TypeNode): boolean {
  const unwrapped = unwrapReadonlyOperator(typeAnnotation);
  return unwrapped.type === 'TSTupleType';
}

/**
 * Checks if a type is a union of literals, used for enum-like type definitions.
 */
export function isUnionEnumType(typeNode: TSESTree.TypeNode): boolean {
  return isUnionOfLiterals(typeNode);
}

/**
 * Extracts the enum reference from @IsEnum() decorator argument.
 * Handles both simple identifiers (MyEnum) and member expressions (MyNamespace.MyEnum).
 */
export function getIsEnumArgument(decorator: TSESTree.Decorator): string | null {
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
 * Checks if the @IsEnum decorator argument is an array of enum values.
 * This is a valid class-validator pattern for restricting validation to a subset of enum values.
 *
 * Example:
 *   const WEIGHT_UNITS = [Unit.G, Unit.KG] as const;
 *   @IsEnum(WEIGHT_UNITS)
 *   unit?: Unit;
 *
 * Uses TypeScript type checker to determine if the argument resolves to an array/tuple type.
 */
export function isEnumArgumentArraySubset(
  decorator: TSESTree.Decorator,
  checker: ts.TypeChecker | null,
  esTreeNodeMap: {get(key: TSESTree.Node): ts.Node | undefined} | null,
): boolean {
  if (!checker || !esTreeNodeMap) {
    return false;
  }

  if (decorator.expression.type !== 'CallExpression' || decorator.expression.arguments.length === 0) {
    return false;
  }

  const firstArg = decorator.expression.arguments[0];

  // Get the TypeScript node for the argument
  const tsNode = esTreeNodeMap.get(firstArg);
  if (!tsNode) {
    return false;
  }

  try {
    const type = checker.getTypeAtLocation(tsNode);

    // Check if it's an array type
    if (checker.isArrayType(type)) {
      return true;
    }

    // Check if it's a tuple type (for `as const` arrays)
    if (checker.isTupleType(type)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extracts the class name from @Type(() => ClassName) decorator.
 * Supports both arrow functions and function expressions.
 */
export function getTypeDecoratorClassName(decorator: TSESTree.Decorator): string | null {
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
export function hasEachOption(decorator: TSESTree.Decorator): boolean {
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
export function hasValidateNestedEachOption(decorator: TSESTree.Decorator): boolean {
  return hasEachOption(decorator);
}

/**
 * Validates if a decorator matches the TypeScript type annotation.
 * Handles special cases like @IsEnum validation, nullable unions, and utility types.
 */
export function checkTypeMatch(
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
