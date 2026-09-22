// These packages ship no type declarations. New TypeScript code that
// reuses them (see AGENTS.md's "reuse, don't rewrite" principle) gets
// them as `any`, same as the rest of the codebase already treats them via
// `allowJs`.
declare module "bitsharesjs";
declare module "bitsharesjs-ws";
declare module "react-translate-component";
declare module "counterpart";
declare module "bitshares-ui-style-guide";
declare module "react-intl";
declare module "lodash-es";
declare module "notifyjs";
declare module "file-saver";
declare module "react-highcharts";
