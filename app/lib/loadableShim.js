// A local replacement for `react-loadable`, for the part of it this app uses: `Loadable({loader, loading})`, a component
// that shows `loading` (with `isLoading`, `pastDelay`, `timedOut`, `error` and `retry`) until the module has loaded and
// then the module's default export with the props it was given, and `.preload()`. The package is a class that reads
// legacy context and uses `componentWillMount`, which React 18 reports in the console on every start
// ("LoadableComponent uses the legacy contextTypes API", "componentWillMount has been renamed").
//
// Aliased in webpack.config.js and in Jest's `moduleNameMapper`. Characterised in app/__tests__/loadableShim-test.js.
import * as React from "react";

const resolve = module =>
    module && module.__esModule ? module.default : module;

export default function Loadable(options) {
    const opts = Object.assign({delay: 200, timeout: null}, options);
    let started = null;
    let loaded = null;
    let failure = null;

    const load = () => {
        if (!started) {
            started = Promise.resolve()
                .then(() => opts.loader())
                .then(
                    module => {
                        loaded = module;
                        failure = null;
                        return module;
                    },
                    error => {
                        failure = error;
                        throw error;
                    }
                );
            // a load that fails is tried again when it is asked for again
            started.catch(() => {
                started = null;
            });
        }
        return started;
    };

    function LoadableComponent(props) {
        const [, rerender] = React.useState(0);
        const [past, setPast] = React.useState(opts.delay === 0);
        const [timedOut, setTimedOut] = React.useState(false);
        const done = loaded !== null;
        React.useEffect(() => {
            if (done) return undefined;
            let alive = true;
            const timers = [];
            if (opts.delay > 0) {
                timers.push(
                    setTimeout(() => alive && setPast(true), opts.delay)
                );
            }
            if (typeof opts.timeout === "number") {
                timers.push(
                    setTimeout(() => alive && setTimedOut(true), opts.timeout)
                );
            }
            load()
                .catch(() => undefined)
                .then(() => alive && rerender(n => n + 1));
            return () => {
                alive = false;
                timers.forEach(clearTimeout);
            };
        }, [done]);
        if (loaded !== null) {
            const Loaded = resolve(loaded);
            return typeof opts.render === "function"
                ? opts.render(loaded, props)
                : React.createElement(Loaded, props);
        }
        if (opts.loading) {
            return React.createElement(opts.loading, {
                isLoading: failure === null,
                pastDelay: past,
                timedOut,
                error: failure,
                retry: () => {
                    failure = null;
                    load().then(
                        () => rerender(n => n + 1),
                        () => rerender(n => n + 1)
                    );
                    rerender(n => n + 1);
                }
            });
        }
        return null;
    }
    LoadableComponent.displayName = "LoadableComponent";
    LoadableComponent.preload = load;
    return LoadableComponent;
}
