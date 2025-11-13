import decoratorTypeMatch from './rules/decorator-type-match';
import optionalDecoratorMatch from './rules/optional-decorator-match';
import validateNestedMatch from './rules/validate-nested-match';
import typeDecoratorMatch from './rules/type-decorator-match';
import definiteAssignmentMatch from './rules/definite-assignment-match';
import dtoFilenameMatch from './rules/dto-filename-match';

export = {
  rules: {
    'decorator-type-match': decoratorTypeMatch,
    'optional-decorator-match': optionalDecoratorMatch,
    'validate-nested-match': validateNestedMatch,
    'type-decorator-match': typeDecoratorMatch,
    'definite-assignment-match': definiteAssignmentMatch,
    'dto-filename-match': dtoFilenameMatch,
  },
  configs: {
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
  },
};
