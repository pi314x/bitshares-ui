// webpack.config.js's DefinePlugin injects these as compile-time global
// constants (see webpack.config.js). Declared here as needed by new
// TypeScript code that reuses legacy modules relying on them, one at a
// time, same "as needed" approach as vendor-shims.d.ts.
declare const __TESTNET__: boolean;
declare const __ELECTRON__: boolean;
declare const __BASE_URL__: string;
declare const __DEV__: boolean;
