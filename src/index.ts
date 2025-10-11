import decoratorTypeMatch from './rules/decorator-type-match';
import optionalDecoratorMatch from './rules/optional-decorator-match';

export = {
  rules: {
    'decorator-type-match': decoratorTypeMatch,
    'optional-decorator-match': optionalDecoratorMatch,
  },
  configs: {
    recommended: {
      plugins: ['class-validator-type-match'],
      rules: {
        'class-validator-type-match/decorator-type-match': 'error',
        'class-validator-type-match/optional-decorator-match': 'error',
      },
    },
  },
};
