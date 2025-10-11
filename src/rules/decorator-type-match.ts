import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

/**
 * Creates an ESLint rule with proper documentation URL
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/robertlinde/eslint-plugin-class-validator-type-match#${name}`,
);

type MessageIds = 'mismatch';
type Options = [];

/**
 * Mapping of class-validator decorators to their expected TypeScript types.
 * Empty arrays indicate decorators that can accept any type.
 *
 * @example
 * IsString: ["string"] - expects string type
 * IsOptional: [] - accepts any type
 */
const decoratorTypeMap: Record<string, string[]> = {
  // String validators
  IsString: ['string'],
  IsNotEmpty: [], // Can be any type

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

  // Enum validators
  IsEnum: ['enum'],

  // Type-agnostic validators (no type checking)
  IsOptional: [],
  ValidateNested: [],
  IsDefined: [],
  IsEmpty: [],
  Equals: [],
  NotEquals: [],
  IsIn: [],
  IsNotIn: [],
};

/**
 * ESLint rule to ensure class-validator decorators match TypeScript type annotations.
 *
 * This rule prevents common mistakes where the decorator type (e.g., @IsString)
 * doesn't match the actual TypeScript type annotation (e.g., number).
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
 */
export default createRule<Options, MessageIds>({
  name: 'decorator-type-match',
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure class-validator decorators match TypeScript type annotations',
      recommended: 'recommended',
    },
    messages: {
      mismatch: 'Decorator @{{decorator}} does not match type annotation {{actualType}}. Expected: {{expectedTypes}}',
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
         * Handles both @Decorator and @Decorator() syntax.
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
         * Supports primitive types, arrays, and type references.
         */
        switch (typeAnnotation.type) {
          case 'TSStringKeyword': {
            actualType = 'string';

            break;
          }

          case 'TSNumberKeyword': {
            actualType = 'number';

            break;
          }

          case 'TSBooleanKeyword': {
            actualType = 'boolean';

            break;
          }

          case 'TSArrayType': {
            actualType = 'array';

            break;
          }

          case 'TSTypeReference': {
            if (typeAnnotation.typeName.type === 'Identifier') {
              actualType = typeAnnotation.typeName.name;
            }

            break;
          }
          // No default
        }

        // Skip if we couldn't determine the type
        if (!actualType) return;

        /**
         * Check each decorator against the actual type.
         * Report an error if there's a mismatch.
         */
        for (const decorator of decorators) {
          const expectedTypes = decoratorTypeMap[decorator];

          // Skip decorators not in our map
          if (!expectedTypes) continue;
          // Skip type-agnostic decorators (empty array)
          if (expectedTypes.length === 0) continue;

          /**
           * Check if the actual type matches any of the expected types.
           * Handles both 'array' and 'Array' as equivalent.
           */
          const matches = expectedTypes.some((expected) => {
            if (expected === 'array' && actualType === 'Array') return true;
            if (expected === 'Array' && actualType === 'array') return true;
            return expected === actualType;
          });

          // Report mismatch
          if (!matches) {
            context.report({
              node,
              messageId: 'mismatch',
              data: {
                decorator,
                actualType,
                expectedTypes: expectedTypes.join(' or '),
              },
            });
          }
        }
      },
    };
  },
});
