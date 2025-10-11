import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

/**
 * Creates an ESLint rule with proper documentation URL
 */
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/robertlinde/eslint-plugin-class-validator-type-match#${name}`,
);

type MessageIds = 'missingOptionalDecorator' | 'missingOptionalSyntax' | 'conflictingDefiniteAssignment';
type Options = [];

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
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      /**
       * Analyzes class property definitions to check @IsOptional() consistency
       * @param node - The PropertyDefinition AST node to analyze
       */
      PropertyDefinition(node: TSESTree.PropertyDefinition) {
        // Skip if no decorators present
        if (!node.decorators || node.decorators.length === 0) return;

        /**
         * Check if the property has @IsOptional() decorator
         */
        const hasIsOptionalDecorator = node.decorators.some((decorator) => {
          if (decorator.expression.type === 'CallExpression' && decorator.expression.callee.type === 'Identifier') {
            return decorator.expression.callee.name === 'IsOptional';
          }
          if (decorator.expression.type === 'Identifier') {
            return decorator.expression.name === 'IsOptional';
          }
          return false;
        });

        const isOptionalProperty = node.optional === true;
        const isDefiniteAssignment = node.definite === true;

        // Get property name for error messages
        const propertyName = node.key.type === 'Identifier' ? node.key.name : 'property';

        // Get property type for error messages
        let propertyType = 'unknown';
        if (node.typeAnnotation?.typeAnnotation) {
          const typeNode = node.typeAnnotation.typeAnnotation;
          if (typeNode.type === 'TSStringKeyword') propertyType = 'string';
          else if (typeNode.type === 'TSNumberKeyword') propertyType = 'number';
          else if (typeNode.type === 'TSBooleanKeyword') propertyType = 'boolean';
          else if (typeNode.type === 'TSArrayType') propertyType = 'array';
          else if (typeNode.type === 'TSTypeReference' && typeNode.typeName.type === 'Identifier') {
            propertyType = typeNode.typeName.name;
          }
        }

        /**
         * Case 1: Has @IsOptional() but uses definite assignment (!)
         * This is a conflict - can't be both optional and definitely assigned
         */
        if (hasIsOptionalDecorator && isDefiniteAssignment) {
          context.report({
            node,
            messageId: 'conflictingDefiniteAssignment',
          });
          return;
        }

        /**
         * Case 2: Has @IsOptional() but property is not marked as optional (?)
         * The decorator says it's optional, but TypeScript doesn't agree
         */
        if (hasIsOptionalDecorator && !isOptionalProperty) {
          context.report({
            node,
            messageId: 'missingOptionalSyntax',
            data: {
              propertyName,
              propertyType,
            },
          });
          return;
        }

        /**
         * Case 3: Property is optional (?) but missing @IsOptional() decorator
         * TypeScript says it's optional, but class-validator doesn't know
         */
        if (isOptionalProperty && !hasIsOptionalDecorator) {
          context.report({
            node,
            messageId: 'missingOptionalDecorator',
          });
        }
      },
    };
  },
});
