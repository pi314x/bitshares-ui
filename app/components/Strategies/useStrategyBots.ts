// The paper bots: every strategy with a run that is going is moved along the candles that closed since it was last moved, when
// the page opens (a run goes on where it was, whatever time went by) and every minute after.
import * as React from "react";
import {loadCandles} from "../../lib/chain/marketCandles";
import {advanceRun} from "../../lib/common/strategyStore";
import {StrategyList} from "./useStrategyList";

export const TICK_MS = 60 * 1000;
/** A run that was not moved for longer is stopped: reading all the candles since would take too long to be of use. */
export const MAX_GAP_MS = 30 * 24 * 3600 * 1000;

export function useStrategyBots(
    list: StrategyList
): {
    errors: Record<string, string>;
    /** reads the prices now for the runs that are going (after one was started) */
    tick: () => Promise<void>;
} {
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const busy = React.useRef(new Set<string>());
    const alive = React.useRef(true);
    const latest = React.useRef(list);
    latest.current = list;
    React.useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    const tick = React.useCallback(async () => {
        const setError = (id: string, error: string | null) => {
            if (!alive.current) return;
            setErrors(previous => {
                if ((previous[id] || null) === error) return previous;
                const next = {...previous};
                if (error === null) delete next[id];
                else next[id] = error;
                return next;
            });
        };
        for (const s of latest.current.strategies) {
            if (!s.run || !s.run.running || busy.current.has(s.id)) continue;
            busy.current.add(s.id);
            try {
                const now = Date.now();
                if (now - s.run.lastT > MAX_GAP_MS) {
                    latest.current.update(s.id, cur =>
                        cur.run
                            ? {...cur, run: {...cur.run, running: false}}
                            : cur
                    );
                    setError(s.id, "gap");
                    continue;
                }
                const candles = await loadCandles(
                    s.trade,
                    s.priced,
                    s.run.seconds,
                    s.run.lastT + 1,
                    now
                );
                if (!alive.current) return;
                latest.current.update(s.id, cur =>
                    cur.run && cur.run.running
                        ? {
                              ...cur,
                              run: advanceRun(
                                  cur.run,
                                  cur.spec,
                                  candles,
                                  Date.now()
                              )
                          }
                        : cur
                );
                setError(s.id, null);
            } catch (e) {
                setError(
                    s.id,
                    String((e && (e as Error).message) || e).slice(0, 120)
                );
            } finally {
                busy.current.delete(s.id);
            }
        }
    }, []);

    React.useEffect(() => {
        tick();
        const timer = setInterval(tick, TICK_MS);
        return () => clearInterval(timer);
    }, [tick]);

    return {errors, tick};
}
