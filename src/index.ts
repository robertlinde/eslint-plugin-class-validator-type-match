import decoratorTypeMatch from "./rules/decorator-type-match";

export = {
  rules: {
    "decorator-type-match": decoratorTypeMatch,
  },
  configs: {
    recommended: {
      plugins: ["class-validator-type-match"],
      rules: {
        "class-validator-type-match/decorator-type-match": "error",
      },
    },
  },
};
