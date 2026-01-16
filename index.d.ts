import type {ESLint, Linter, Rule} from 'eslint';

declare const plugin: ESLint.Plugin & {
  meta: {
    name: string;
    version: string;
  };
  rules: {
    'decorator-type-match': Rule.RuleModule;
    'optional-decorator-match': Rule.RuleModule;
    'validate-nested-match': Rule.RuleModule;
    'type-decorator-match': Rule.RuleModule;
    'definite-assignment-match': Rule.RuleModule;
    'dto-filename-match': Rule.RuleModule;
  };
  configs: {
    recommended: Linter.LegacyConfig;
    strict: Linter.LegacyConfig;
    basic: Linter.LegacyConfig;
  };
  flatConfigs: {
    recommended: Linter.Config;
    strict: Linter.Config;
    basic: Linter.Config;
  };
};

export = plugin;
