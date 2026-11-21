// The strategies the user saved (`lib/common/strategyStore.ts`) as state that is kept in this browser.
import * as React from "react";
import {
    MAX_STRATEGIES,
    SavedStrategy,
    readStrategies,
    writeStrategies
} from "../../lib/common/strategyStore";

export interface StrategyList {
    strategies: SavedStrategy[];
    /** false when the list is full */
    add: (strategy: SavedStrategy) => boolean;
    /** changes the strategy with that id (the latest one is given to `change`, so two changes do not undo each other) */
    update: (id: string, change: (s: SavedStrategy) => SavedStrategy) => void;
    remove: (id: string) => void;
}

export function useStrategyList(): StrategyList {
    const [strategies, setStrategies] = React.useState<SavedStrategy[]>(() =>
        readStrategies()
    );
    const latest = React.useRef(strategies);
    latest.current = strategies;
    const set = React.useCallback((next: SavedStrategy[]) => {
        latest.current = next;
        setStrategies(next);
        writeStrategies(next);
    }, []);
    const add = React.useCallback(
        (strategy: SavedStrategy) => {
            if (latest.current.length >= MAX_STRATEGIES) return false;
            set([...latest.current, strategy]);
            return true;
        },
        [set]
    );
    const update = React.useCallback(
        (id: string, change: (s: SavedStrategy) => SavedStrategy) => {
            if (!latest.current.some(s => s.id === id)) return;
            set(latest.current.map(s => (s.id === id ? change(s) : s)));
        },
        [set]
    );
    const remove = React.useCallback(
        (id: string) => set(latest.current.filter(s => s.id !== id)),
        [set]
    );
    return {strategies, add, update, remove};
}
