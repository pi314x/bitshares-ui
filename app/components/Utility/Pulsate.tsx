// TypeScript/functional-component port of the legacy Pulsate.jsx (Phase
// 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `UNSAFE_componentWillMount`'s `this.update(this.props)` call (runs
// once, before the first paint) is replicated via a `useRef` guard
// checked directly in the render body, per this migration's established
// `UNSAFE_componentWillMount` translation rule (not `useEffect`, which
// would run after first paint). `UNSAFE_componentWillReceiveProps`
// (fires on every parent-driven prop update, reading the fresh
// `nextProps`) is replicated by comparing this render's `value`/
// `compareFunction` against refs holding the previous render's.
//
// `update`'s two-step `this.setState({pulse: ""}, () => {
// findDOMNode(this).offsetHeight; this.setState({pulse}); })` forces a
// synchronous reflow between clearing and re-applying the pulse class,
// so the CSS pulse animation restarts even when the same pulse color
// would otherwise still be mid-animation. A class setState callback
// runs synchronously after the DOM commits but before the browser
// paints - the closest hooks equivalent is `useLayoutEffect` (not
// `useEffect`, which runs after paint and would let the animation-restart
// trick miss a frame). A ref flag (`pendingPulseRef`) carries the
// "please restart to this pulse color" instruction from `update()` to
// the layout effect, mirroring the callback closing over `pulse`.
import * as React from "react";
import cnames from "classnames";

interface PulsateProps {
    value: any;
    compareFunction?: (value: any, nextValue: any) => string | null;
    children?: React.ReactNode;
    reverse?: boolean;
    fill?: string;
}

function compareDefault(value: any, nextValue: any): string | null {
    if (value === nextValue) {
        return null; // stay unchanged
    } else {
        return nextValue > value ? "green" : "red";
    }
}

function Pulsate(props: PulsateProps) {
    const spanRef = React.useRef<HTMLSpanElement | null>(null);
    const [state, setState] = React.useState<{value: any; pulse: string}>({
        value: null,
        pulse: ""
    });
    const stateRef = React.useRef(state);
    stateRef.current = state;
    const pendingPulseRef = React.useRef<string | null>(null);

    const update = (p: PulsateProps) => {
        const value = stateRef.current.value;
        const nextValue = p.value;
        const compareFunction = p.compareFunction || compareDefault;

        if (value === null || nextValue === null) {
            setState({value: nextValue, pulse: ""});
            return;
        }

        const pulse = compareFunction(value, nextValue);
        if (pulse === null) {
            setState(prev => ({...prev, value: nextValue}));
        } else {
            pendingPulseRef.current = pulse;
            setState({value: nextValue, pulse: ""});
        }
    };

    React.useLayoutEffect(() => {
        if (pendingPulseRef.current !== null && spanRef.current) {
            // Force a reflow so the browser registers the cleared pulse
            // class before the new one is applied.
            // eslint-disable-next-line no-unused-expressions
            spanRef.current.offsetHeight;
            const p = pendingPulseRef.current;
            pendingPulseRef.current = null;
            setState(prev => ({...prev, pulse: p}));
        }
    });

    const didMountRef = React.useRef(false);
    if (!didMountRef.current) {
        didMountRef.current = true;
        update(props);
    }

    const prevValueRef = React.useRef(props.value);
    const prevCompareFunctionRef = React.useRef(props.compareFunction);
    const isFirstRenderRef = React.useRef(true);
    if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
    } else if (
        props.value !== prevValueRef.current ||
        props.compareFunction !== prevCompareFunctionRef.current
    ) {
        update(props);
    }
    prevValueRef.current = props.value;
    prevCompareFunctionRef.current = props.compareFunction;

    const {pulse} = state;
    const {reverse} = props;
    let {children, fill} = props;

    if (!children) {
        children = state.value;
    }

    if (!pulse) {
        return <span ref={spanRef}>{children}</span>;
    }

    fill = fill || "none";
    return (
        <span
            ref={spanRef}
            className={cnames("pulsate", pulse, {reverse})}
            style={{animationFillMode: fill as any}}
        >
            {children}
        </span>
    );
}

export default Pulsate;
