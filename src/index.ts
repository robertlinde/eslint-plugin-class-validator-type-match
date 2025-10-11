import decoratorTypeMatch from "./rules/decorator-type-match";

export = {
  rules: {
    "decorator-type-match": decoratorTypeMatch,
  },
  configs: {
    recommended: {
      plugins: ["class-validator-types"],
      rules: {
        "class-validator-types/decorator-type-match": "error",
      },
    },
  },
};
