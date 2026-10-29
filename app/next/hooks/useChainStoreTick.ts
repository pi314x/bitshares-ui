// Functional-component equivalent of the legacy BindToChainState HOC
// (app/components/Utility/BindToChainState.jsx) for components that read
// bitsharesjs's ChainStore directly during render. BindToChainState's core
// behavior, stripped of its propType-driven resolution machinery, is just
// "subscribe on mount, unsubscribe on unmount, re-render on every chain
// event" — ChainStore.getObject/getAccount/getAsset are synchronous cache
// reads that are safe to call straight from render, and they trigger their
// own async fetch-and-notify when an id isn't cached yet (see ChainStore's
// autosubscribe default), so re-rendering on every chain event is enough
// to pick up newly-arrived data, exactly as BindToChainState's
// `ChainStore.subscribe(this.update); this.update();` does.
import * as React from "react";
import {ChainStore} from "bitsharesjs";

export function useChainStoreTick(): number {
    const [tick, setTick] = React.useState(0);

    React.useEffect(() => {
        const onChange = () => setTick(t => t + 1);
        ChainStore.subscribe(onChange);
        return () => ChainStore.unsubscribe(onChange);
    }, []);

    return tick;
}
