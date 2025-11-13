import {ESLintUtils, TSESLint, type TSESTree} from '@typescript-eslint/utils';

/**
 * Creates an ESLint rule with proper documentation URL
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/robertlinde/eslint-plugin-class-validator-type-match#${name}`,
);

type MessageIds =
  | 'missingOptionalDecorator'
  | 'missingOptionalSyntax'
  | 'conflictingDefiniteAssignment'
  | 'undefinedUnionWithoutDecorator'
  | 'undefinedUnionWithoutOptional'
  | 'nullUnionIncorrect'
  | 'redundantUndefinedInType';

type Options = [
  {
    /**
     * Whether to treat `Type | undefined` as requiring @IsOptional()
     * @default true
     */
    strictNullChecks?: boolean;
    /**
     * Whether to check properties with default values
     * @default false
     */
    checkDefaultValues?: boolean;
    /**
     * Custom decorator names to check (in addition to IsOptional)
     * @default []
     */
    customOptionalDecorators?: string[];
  },
];

/**
 * ESLint rule to ensure @IsOptional() decorator usage matches TypeScript optional syntax.
 *
 * This rule enforces consistency between class-validator's @IsOptional() decorator
 * and TypeScript's optional property syntax (?).
 *
 * @example
 * // ✅ Good - decorator and syntax match
 * class User {
 *   @IsOptional()
 *   @IsString()
 *   name?: string;
 * }
 *
 * @example
 * // ❌ Bad - has @IsOptional() but property is not optional
 * class User {
 *   @IsOptional()
 *   @IsString()
 *   name: string;
 * }
 *
 * @example
 * // ❌ Bad - property is optional but missing @IsOptional()
 * class User {
 *   @IsString()
 *   name?: string;
 * }
 *
 * @example
 * // ❌ Bad - @IsOptional() conflicts with definite assignment
 * class User {
 *   @IsOptional()
 *   @IsString()
 *   name!: string;
 * }
 *
 * @example
 * // ❌ Bad - union with undefined but missing @IsOptional()
 * class User {
 *   @IsString()
 *   name: string | undefined;
 * }
 *
 * @example
 * // ❌ Bad - @IsOptional() with null instead of undefined
 * class User {
 *   @IsOptional()
 *   @IsString()
 *   value: string | null; // Should be value?: string or value: string | undefined
 * }
 */
export default createRule<Options, MessageIds>({
  name: 'optional-decorator-match',
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure @IsOptional() decorator usage matches TypeScript optional property syntax',
    },
    messages: {
      missingOptionalDecorator: 'Property is marked as optional (?) but missing @IsOptional() decorator',
      missingOptionalSyntax:
        'Property has @IsOptional() decorator but is not marked as optional. Add ? to the property: {{propertyName}}?: {{propertyType}}',
      conflictingDefiniteAssignment:
        'Property has @IsOptional() decorator but uses definite assignment (!). Remove either @IsOptional() or the ! operator',
      undefinedUnionWithoutDecorator: 'Property type includes undefined but is missing @IsOptional() decorator',
      undefinedUnionWithoutOptional:
        'Property has @IsOptional() decorator and union with undefined, but is not marked as optional (?)',
      nullUnionIncorrect:
        'Property has @IsOptional() but uses "| null". @IsOptional() works with undefined, not null. Change to "{{propertyName}}?: {{propertyType}}" or use "| undefined" instead of "| null"',
      redundantUndefinedInType:
        'Property is marked as optional (?) which already adds undefined to the type. Remove "| undefined" from the type annotation',
    },
    schema: [
      {
        type: 'object',
        properties: {
          strictNullChecks: {
            type: 'boolean',
            default: true,
            description: 'Whether to treat `Type | undefined` as requiring @IsOptional()',
          },
          checkDefaultValues: {
            type: 'boolean',
            default: false,
            description: 'Whether to check properties with default values',
          },
          customOptionalDecorators: {
            type: 'array',
            items: {type: 'string'},
            default: [],
            description: 'Custom decorator names to check (in addition to IsOptional)',
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: 'code',
  },
  defaultOptions: [
    {
      strictNullChecks: true,
      checkDefaultValues: false,
      customOptionalDecorators: [],
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const strictNullChecks = options.strictNullChecks !== false;
    const checkDefaultValues = options.checkDefaultValues === true;
    const customDecorators = options.customOptionalDecorators || [];
    const optionalDecoratorNames = ['IsOptional', ...customDecorators];

    /**
     * Helper: Check if property type includes undefined (separate from null)
     */
    const hasUndefinedInType = (node: TSESTree.PropertyDefinition): boolean => {
      if (!node.typeAnnotation?.typeAnnotation) return false;

      const typeNode = node.typeAnnotation.typeAnnotation;

      // Direct undefined type
      if (typeNode.type === 'TSUndefinedKeyword') {
        return true;
      }

      // Union type with undefined
      if (typeNode.type === 'TSUnionType') {
        return typeNode.types.some((t) => t.type === 'TSUndefinedKeyword');
      }

      return false;
    };

    /**
     * Helper: Check if property type includes null (separate from undefined)
     */
    const hasNullInType = (node: TSESTree.PropertyDefinition): boolean => {
      if (!node.typeAnnotation?.typeAnnotation) return false;

      const typeNode = node.typeAnnotation.typeAnnotation;

      // Direct null type
      if (typeNode.type === 'TSNullKeyword') {
        return true;
      }

      // Union type with null
      if (typeNode.type === 'TSUnionType') {
        return typeNode.types.some((t) => t.type === 'TSNullKeyword');
      }

      return false;
    };

    /**
     * Helper: Extract property name from various key types
     */
    const getPropertyName = (key: TSESTree.PropertyDefinition['key']): string => {
      if (key.type === 'Identifier') return key.name;
      if (key.type === 'Literal') return String(key.value);
      if (key.type === 'PrivateIdentifier') return `#${key.name}`;
      return 'property';
    };

    /**
     * Helper: Get readable property type string (without undefined if optional)
     */
    const getPropertyType = (node: TSESTree.PropertyDefinition, removeUndefined = false): string => {
      if (!node.typeAnnotation?.typeAnnotation) return 'unknown';

      const typeNode = node.typeAnnotation.typeAnnotation;

      if (typeNode.type === 'TSStringKeyword') return 'string';
      if (typeNode.type === 'TSNumberKeyword') return 'number';
      if (typeNode.type === 'TSBooleanKeyword') return 'boolean';
      if (typeNode.type === 'TSArrayType') return 'array';
      if (typeNode.type === 'TSUndefinedKeyword') return 'undefined';
      if (typeNode.type === 'TSNullKeyword') return 'null';

      if (typeNode.type === 'TSTypeReference' && typeNode.typeName.type === 'Identifier') {
        return typeNode.typeName.name;
      }

      if (typeNode.type === 'TSUnionType') {
        const types = typeNode.types
          .filter((t) => !removeUndefined || t.type !== 'TSUndefinedKeyword')
          .map((t) => {
            if (t.type === 'TSStringKeyword') return 'string';
            if (t.type === 'TSNumberKeyword') return 'number';
            if (t.type === 'TSUndefinedKeyword') return 'undefined';
            if (t.type === 'TSNullKeyword') return 'null';
            if (t.type === 'TSTypeReference' && t.typeName.type === 'Identifier') {
              return t.typeName.name;
            }
            return 'unknown';
          });

        return types.length > 1 ? types.join(' | ') : types[0] || 'unknown';
      }

      return 'unknown';
    };

    /**
     * Helper: Check if property has optional decorator
     */
    const hasOptionalDecorator = (node: TSESTree.PropertyDefinition): boolean => {
      if (!node.decorators || node.decorators.length === 0) return false;

      return node.decorators.some((decorator) => {
        const expr = decorator.expression;

        // Handle @Decorator() - CallExpression
        if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
          return optionalDecoratorNames.includes(expr.callee.name);
        }

        // Handle @Decorator - Identifier
        if (expr.type === 'Identifier') {
          return optionalDecoratorNames.includes(expr.name);
        }

        return false;
      });
    };

    /**
     * Helper: Create fixer to add ? to property
     */
    const createOptionalFixer = (node: TSESTree.PropertyDefinition) => {
      return (fixer: TSESLint.RuleFixer) => {
        // Find position after property key
        const keyEnd = node.key.range[1];
        return fixer.insertTextAfterRange([keyEnd, keyEnd], '?');
      };
    };

    /**
     * Helper: Create fixer to remove | undefined from type annotation
     */
    const createRemoveUndefinedFixer = (node: TSESTree.PropertyDefinition) => {
      return (fixer: TSESLint.RuleFixer) => {
        if (!node.typeAnnotation?.typeAnnotation) return null;

        const typeNode = node.typeAnnotation.typeAnnotation;
        if (typeNode.type !== 'TSUnionType') return null;

        const sourceCode = context.getSourceCode();
        const typeText = sourceCode.getText(typeNode);

        // Remove | undefined or undefined | from the union
        const fixedType = typeText
          .replace(/\s*\|\s*undefined\s*$/, '')
          .replace(/^undefined\s*\|\s*/, '')
          .replace(/\s*\|\s*undefined\s*\|/g, ' |');

        return fixer.replaceText(typeNode, fixedType);
      };
    };

    /**
     * Helper: Get property type without null
     */
    const getPropertyTypeWithoutNull = (node: TSESTree.PropertyDefinition): string => {
      if (!node.typeAnnotation?.typeAnnotation) return 'unknown';

      const typeNode = node.typeAnnotation.typeAnnotation;

      if (typeNode.type === 'TSNullKeyword') return 'unknown';

      if (typeNode.type === 'TSUnionType') {
        const types = typeNode.types
          .filter((t) => t.type !== 'TSNullKeyword')
          .map((t) => {
            if (t.type === 'TSStringKeyword') return 'string';
            if (t.type === 'TSNumberKeyword') return 'number';
            if (t.type === 'TSBooleanKeyword') return 'boolean';
            if (t.type === 'TSUndefinedKeyword') return 'undefined';
            if (t.type === 'TSTypeReference' && t.typeName.type === 'Identifier') {
              return t.typeName.name;
            }
            return 'unknown';
          });

        return types.length > 1 ? types.join(' | ') : types[0] || 'unknown';
      }

      return getPropertyType(node);
    };

    return {
      /**
       * Analyzes class property definitions to check @IsOptional() consistency
       */
      PropertyDefinition(node: TSESTree.PropertyDefinition) {
        // Skip if no decorators present
        if (!node.decorators || node.decorators.length === 0) return;

        // Skip if property has default value (unless checkDefaultValues is enabled)
        if (node.value && !checkDefaultValues) return;

        const hasDecorator = hasOptionalDecorator(node);
        const isOptionalProperty = node.optional === true;
        const isDefiniteAssignment = node.definite === true;
        const hasUndefined = hasUndefinedInType(node);
        const hasNull = hasNullInType(node);

        const propertyName = getPropertyName(node.key);
        const propertyType = getPropertyType(node);
        const propertyTypeWithoutUndefined = getPropertyType(node, true);

        // Collect all issues to report the most relevant one
        const issues: Array<{
          messageId: MessageIds;
          data?: Record<string, string>;
          fix?: (fixer: TSESLint.RuleFixer) => TSESLint.RuleFix | null;
        }> = [];

        /**
         * Priority 1: Conflicting definite assignment with @IsOptional()
         * This is the most critical conflict
         */
        if (hasDecorator && isDefiniteAssignment) {
          issues.push({
            messageId: 'conflictingDefiniteAssignment',
          });
        }

        /**
         * Priority 2: Redundant undefined in type when using ?
         * Example: name?: string | undefined
         */
        if (isOptionalProperty && hasUndefined) {
          issues.push({
            messageId: 'redundantUndefinedInType',
            fix: createRemoveUndefinedFixer(node),
          });
        }

        /**
         * Priority 3: Null in type with @IsOptional() (likely incorrect)
         * Note: ? adds undefined, not null
         * Only flag if there's null but NO undefined (neither explicit nor from ?)
         */
        if (hasDecorator && hasNull && !hasUndefined && !isOptionalProperty) {
          const propertyTypeWithoutNull = getPropertyTypeWithoutNull(node);
          issues.push({
            messageId: 'nullUnionIncorrect',
            data: {
              propertyName,
              propertyType: propertyTypeWithoutNull,
            },
          });
        }

        /**
         * Priority 4: Has @IsOptional() but property is not marked as optional (?)
         * Special handling for union types with undefined
         */
        if (hasDecorator && !isOptionalProperty && !isDefiniteAssignment) {
          if (hasUndefined && strictNullChecks) {
            issues.push({
              messageId: 'undefinedUnionWithoutOptional',
              fix: createOptionalFixer(node),
            });
          } else if (!hasNull || hasUndefined) {
            // Only suggest adding ? if there's no null, or if there's also undefined
            issues.push({
              messageId: 'missingOptionalSyntax',
              data: {
                propertyName,
                propertyType: hasUndefined ? propertyTypeWithoutUndefined : propertyType,
              },
              fix: createOptionalFixer(node),
            });
          }
        }

        /**
         * Priority 5: Property is optional (?) but missing @IsOptional() decorator
         */
        if (isOptionalProperty && !hasDecorator) {
          issues.push({
            messageId: 'missingOptionalDecorator',
          });
        }

        /**
         * Priority 6: Type includes undefined but missing @IsOptional() and not optional
         * Only check if strictNullChecks is enabled
         */
        if (strictNullChecks && hasUndefined && !hasDecorator && !isOptionalProperty) {
          issues.push({
            messageId: 'undefinedUnionWithoutDecorator',
          });
        }

        // Report the highest priority issue found
        if (issues.length > 0) {
          const issue = issues[0];
          context.report({
            node,
            messageId: issue.messageId,
            data: issue.data,
            fix: issue.fix,
          });
        }
      },
    };
  },
});
