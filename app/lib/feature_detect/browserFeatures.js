// Which browser capabilities the wallet needs are missing, if any. The
// "Unsupported browser" notice used to be decided by sniffing the user agent
// against a whitelist (firefox/chrome/edge), which flagged Safari and every iOS
// browser. What matters is whether the platform can do the job, so this checks
// that instead; any current browser passes, whatever its name.
export const REQUIRED_FEATURES = {
    // keys, wallet and settings live here
    indexedDB: env => !!env.indexedDB,
    localStorage: env => {
        try {
            return !!env.localStorage;
        } catch (e) {
            return false; // access itself can throw (blocked storage)
        }
    },
    // the node connection
    WebSocket: env => typeof env.WebSocket === "function",
    fetch: env => typeof env.fetch === "function",
    // modern JS runtime pieces the bundle relies on
    Promise: env => typeof env.Promise === "function",
    TextEncoder: env => typeof env.TextEncoder === "function",
    Uint8Array: env => typeof env.Uint8Array === "function"
};

export function missingBrowserFeatures(env = window) {
    return Object.keys(REQUIRED_FEATURES).filter(
        name => !REQUIRED_FEATURES[name](env)
    );
}

export default missingBrowserFeatures;
