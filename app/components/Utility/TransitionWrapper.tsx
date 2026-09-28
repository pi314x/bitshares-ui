// TypeScript/functional-component port of the legacy TransitionWrapper.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): several already-migrated
// consumers (Exchange/OrderBook.tsx, Exchange/MyOpenOrders.tsx,
// Exchange/MarketHistory.tsx) hold a ref to this component and call an
// imperative `.resetAnimation()` method on it - a class-instance-method
// pattern that a plain function component can't support. Ported with
// `React.forwardRef` + `React.useImperativeHandle` exposing the same
// `resetAnimation()` method, so those callers (all already typed with
// `React.useRef<any>(null)`) keep working unchanged.
import * as React from "react";
import {CSSTransition, TransitionGroup} from "react-transition-group";

export interface TransitionWrapperHandle {
    resetAnimation: () => void;
}

interface TransitionWrapperProps {
    component?: any;
    enterTimeout?: number;
    id?: string;
    className?: string;
    transitionName?: string;
    children?: React.ReactNode;
}

const TransitionWrapper = React.forwardRef<
    TransitionWrapperHandle,
    TransitionWrapperProps
>(function TransitionWrapper(
    {component = "span", enterTimeout = 2000, id, className, transitionName, children},
    ref
) {
    const [animateEnter, setAnimateEnter] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const enableAnimation = React.useCallback(() => {
        timerRef.current = setTimeout(() => {
            if (timerRef.current) {
                setAnimateEnter(true);
            }
        }, 2000);
    }, []);

    React.useEffect(() => {
        enableAnimation();
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = null;
        };
    }, [enableAnimation]);

    React.useImperativeHandle(ref, () => ({
        resetAnimation: () => {
            setAnimateEnter(false);
            enableAnimation();
        }
    }));

    if (!children) {
        return React.createElement(component);
    } else {
        return (
            <TransitionGroup component={component} id={id} className={className}>
                {React.Children.map(children, (child, index) => (
                    <CSSTransition
                        key={index}
                        classNames={transitionName}
                        timeout={{enter: enterTimeout}}
                        exit={false}
                        enter={animateEnter}
                    >
                        {child}
                    </CSSTransition>
                ))}
            </TransitionGroup>
        );
    }
});

export default TransitionWrapper;
