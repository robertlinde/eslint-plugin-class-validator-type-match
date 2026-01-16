import type {TSESLint} from '@typescript-eslint/utils';
import decoratorTypeMatch from './rules/decorator-type-match';
import optionalDecoratorMatch from './rules/optional-decorator-match';
import validateNestedMatch from './rules/validate-nested-match';
import typeDecoratorMatch from './rules/type-decorator-match';
import definiteAssignmentMatch from './rules/definite-assignment-match';
import dtoFilenameMatch from './rules/dto-filename-match';
import {name, version} from '../package.json';

const rules = {
  'decorator-type-match': decoratorTypeMatch,
  'optional-decorator-match': optionalDecoratorMatch,
  'validate-nested-match': validateNestedMatch,
  'type-decorator-match': typeDecoratorMatch,
  'definite-assignment-match': definiteAssignmentMatch,
  'dto-filename-match': dtoFilenameMatch,
};

const plugin = {
  meta: {
    name,
    version,
  },
  rules,
} satisfies TSESLint.FlatConfig.Plugin;

// Legacy configs for .eslintrc (extends: ['plugin:class-validator-type-match/recommended'])
const legacyConfigs: TSESLint.Linter.Plugin['configs'] = {
  recommended: {
    plugins: ['class-validator-type-match'],
    rules: {
      'class-validator-type-match/decorator-type-match': 'error',
      'class-validator-type-match/optional-decorator-match': 'error',
      'class-validator-type-match/validate-nested-match': 'error',
      'class-validator-type-match/type-decorator-match': 'error',
      'class-validator-type-match/definite-assignment-match': 'error',
      'class-validator-type-match/dto-filename-match': 'error',
    },
  },
  strict: {
    plugins: ['class-validator-type-match'],
    rules: {
      'class-validator-type-match/decorator-type-match': 'error',
      'class-validator-type-match/optional-decorator-match': 'error',
      'class-validator-type-match/validate-nested-match': 'error',
      'class-validator-type-match/type-decorator-match': 'error',
      'class-validator-type-match/definite-assignment-match': 'error',
      'class-validator-type-match/dto-filename-match': 'error',
    },
  },
  basic: {
    plugins: ['class-validator-type-match'],
    rules: {
      'class-validator-type-match/decorator-type-match': 'error',
      'class-validator-type-match/optional-decorator-match': 'error',
      'class-validator-type-match/definite-assignment-match': 'error',
      'class-validator-type-match/dto-filename-match': 'error',
    },
  },
};

// Flat configs for eslint.config.ts (classValidatorTypeMatch.configs.recommended)
const flatConfigs = {
  recommended: {
    name: 'class-validator-type-match/recommended',
    plugins: {
      'class-validator-type-match': plugin,
    },
    rules: {
      'class-validator-type-match/decorator-type-match': 'error',
      'class-validator-type-match/optional-decorator-match': 'error',
      'class-validator-type-match/validate-nested-match': 'error',
      'class-validator-type-match/type-decorator-match': 'error',
      'class-validator-type-match/definite-assignment-match': 'error',
      'class-validator-type-match/dto-filename-match': 'error',
    },
  },
  strict: {
    name: 'class-validator-type-match/strict',
    plugins: {
      'class-validator-type-match': plugin,
    },
    rules: {
      'class-validator-type-match/decorator-type-match': 'error',
      'class-validator-type-match/optional-decorator-match': 'error',
      'class-validator-type-match/validate-nested-match': 'error',
      'class-validator-type-match/type-decorator-match': 'error',
      'class-validator-type-match/definite-assignment-match': 'error',
      'class-validator-type-match/dto-filename-match': 'error',
    },
  },
  basic: {
    name: 'class-validator-type-match/basic',
    plugins: {
      'class-validator-type-match': plugin,
    },
    rules: {
      'class-validator-type-match/decorator-type-match': 'error',
      'class-validator-type-match/optional-decorator-match': 'error',
      'class-validator-type-match/definite-assignment-match': 'error',
      'class-validator-type-match/dto-filename-match': 'error',
    },
  },
} satisfies TSESLint.FlatConfig.SharedConfigs;

export = {
  meta: plugin.meta,
  rules,
  configs: legacyConfigs,
  flatConfigs,
};
