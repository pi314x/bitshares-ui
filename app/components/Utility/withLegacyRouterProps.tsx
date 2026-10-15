// Supplies react-router v5's route props (`match`, `history`, `location`)
// to a component rendered as a v6 `<Route element={<X />}>`.
//
// Why: v5's `<Route component={X}>` injected those three props; v6 injects
// nothing, and the v5 -> v6 migration (Phase 9) changed the route tree in
// App.jsx but left a number of route components still reading
// `props.match.params`, `props.history.push(...)` and `props.location`.
// Booting the built bundle showed the result: /help, /block/:height,
// /instant-trade (and anything calling `history.push`, e.g. login and
// registration) threw on `undefined` and took the whole app down to a blank
// screen. Wrapping each such route component here restores exactly the
// subset of the v5 contract they use, without touching their internals:
//
// - `match.params`  - the route's URL params (`useParams`)
// - `match.url`     - the matched portion of the URL (`useResolvedPath(".")`)
// - `location`      - pathname/search/hash/state/key (`useLocation`)
// - `history`       - `push`/`replace`/`go`/`goBack`/`goForward` over
//                     `useNavigate`, plus `location`
//
// New code should call `useParams`/`useNavigate`/`useLocation` directly;
// this adapter exists so the remaining legacy consumers can be migrated one
// at a time.
import * as React from "react";
import {
    useLocation,
    useNavigate,
    useParams,
    useResolvedPath
} from "react-router-dom";

export interface LegacyRouterProps {
    match: {
        params: Record<string, string | undefined>;
        url: string;
        isExact: boolean;
    };
    location: ReturnType<typeof useLocation>;
    history: {
        push: (to: string, state?: unknown) => void;
        replace: (to: string, state?: unknown) => void;
        go: (delta: number) => void;
        goBack: () => void;
        goForward: () => void;
        location: ReturnType<typeof useLocation>;
    };
}

export function withLegacyRouterProps<P extends object>(
    Component: React.ComponentType<P>
): React.ComponentType<Omit<P, keyof LegacyRouterProps>> {
    function WithLegacyRouterProps(props: Omit<P, keyof LegacyRouterProps>) {
        const params = useParams();
        const location = useLocation();
        const navigate = useNavigate();
        const {pathname: url} = useResolvedPath(".");

        const history = React.useMemo(
            () => ({
                push: (to: string, state?: unknown) => navigate(to, {state}),
                replace: (to: string, state?: unknown) =>
                    navigate(to, {replace: true, state}),
                go: (delta: number) => navigate(delta),
                goBack: () => navigate(-1),
                goForward: () => navigate(1),
                location
            }),
            [navigate, location]
        );
        const match = React.useMemo(() => ({params, url, isExact: true}), [
            params,
            url
        ]);

        const injected = {match, location, history} as LegacyRouterProps;
        return <Component {...(props as P)} {...injected} />;
    }
    WithLegacyRouterProps.displayName = `withLegacyRouterProps(${Component.displayName ||
        Component.name ||
        "Component"})`;
    return WithLegacyRouterProps;
}

export default withLegacyRouterProps;
