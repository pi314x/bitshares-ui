// webpack.config.js's DefinePlugin injects these as compile-time global
// constants (see webpack.config.js). Declared here as needed by new
// TypeScript code that reuses legacy modules relying on them, one at a
// time, same "as needed" approach as vendor-shims.d.ts.
declare const __TESTNET__: boolean;
declare const __ELECTRON__: boolean;
declare const __BASE_URL__: string;
declare const __DEV__: boolean;
declare const __HASH_HISTORY__: boolean;
declare const __CHART_ENGINE__: "auto" | "tradingview" | "lightweight";
// The MCP page, and the review of what an AI assistant prepared (docs/MCP.md); both off
// unless MCP_ENABLED / MCP_TRADING_ENABLED are true when the app is built.
declare const __MCP_ENABLED__: boolean;
declare const __MCP_TRADING__: boolean;
// What the build is, for the footer of the left menu (lib/common/buildInfo.ts): the version of package.json (on `develop` the
// commit's short hash), the git branch and the commit. A container build has no .git folder and takes the branch and the
// commit from its BRANCH and GIT_REV build arguments.
declare const APP_VERSION: string;
declare const __GIT_BRANCH__: string;
declare const __GIT_REV__: string;
