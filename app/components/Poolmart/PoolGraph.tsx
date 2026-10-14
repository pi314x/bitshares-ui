import * as React from "react";
import counterpart from "counterpart";
import {Button} from "../../design-system/Button";
import {
    GraphNode,
    buildGraph,
    layoutGraph,
    neighbours,
    pinchView
} from "../../lib/common/poolGraph";
import {poolMetrics, poolValueInBts} from "../../lib/common/poolMetrics";
import styles from "./PoolGraph.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`poolmart.graph.${key}`, params);

const WIDTH = 1000;
const HEIGHT = 700;
const CORE = "1.3.0";

export interface PoolGraphProps {
    /** The pools of the list, as the store holds them (assets resolved). */
    pools: any[];
    /** "Show this asset's pools": filters the list by it. */
    onShowAsset: (symbol: string) => void;
}

interface View {
    x: number;
    y: number;
    w: number;
    h: number;
}

const FULL: View = {x: 0, y: 0, w: WIDTH, h: HEIGHT};

// How the pools and the assets hang together: every asset is a dot, every
// pool a line between its two assets, so the hubs (BTS, the gateway
// stablecoins) show and so do the assets that can only be reached through
// one. Pools valued in BTS draw thicker the more they hold. Click an asset to
// see its pools; drag to move, wheel, +/- or a two-finger pinch to zoom.
export default function PoolGraph({
    pools,
    onShowAsset
}: PoolGraphProps): JSX.Element {
    const [selected, setSelected] = React.useState<string | null>(null);
    const [hover, setHover] = React.useState<string | null>(null);
    const [view, setView] = React.useState<View>(FULL);
    const drag = React.useRef<{x: number; y: number; view: View} | null>(null);
    const svg = React.useRef<SVGSVGElement>(null);
    // The fingers (or the mouse) on the graph: one pans, two pinch.
    const pointers = React.useRef(new Map<number, {x: number; y: number}>());
    const pinch = React.useRef<{
        distance: number;
        view: View;
        anchor: {x: number; y: number};
    } | null>(null);
    // where a press started and on which asset: a press that did not move is a
    // click on that asset (the graph holds the pointer, so a node never gets
    // its own click)
    const press = React.useRef<{
        x: number;
        y: number;
        node: string | null;
        moved: boolean;
    } | null>(null);

    // only the set of pools matters for the layout, not their balances
    const signature = pools.map(p => p.id).join(",");
    const graph = React.useMemo(() => {
        const symbols: {[id: string]: string} = {};
        const inputs = pools.map(pool => {
            if (pool.asset_a_obj) {
                symbols[pool.asset_a] = pool.asset_a_obj.get("symbol");
            }
            if (pool.asset_b_obj) {
                symbols[pool.asset_b] = pool.asset_b_obj.get("symbol");
            }
            let value: number | null = null;
            if (pool.asset_a_obj && pool.asset_b_obj) {
                const m = poolMetrics(
                    pool,
                    pool.asset_a_obj.get("precision"),
                    pool.asset_b_obj.get("precision")
                );
                value = poolValueInBts(pool, m);
            }
            return {
                id: pool.id,
                asset_a: pool.asset_a,
                asset_b: pool.asset_b,
                value
            };
        });
        return layoutGraph(
            buildGraph(inputs, id => symbols[id] || id),
            {
                width: WIDTH,
                height: HEIGHT
            }
        );
        // eslint-disable-next-line
    }, [signature]);

    const byId = React.useMemo(() => {
        const map = new Map<string, GraphNode>();
        graph.nodes.forEach(node => map.set(node.id, node));
        return map;
    }, [graph]);

    const focus = hover || selected;
    const near = focus ? neighbours(graph, focus) : null;
    const maxValue = Math.max(1, ...graph.edges.map(e => e.value));

    const zoom = (
        factor: number,
        cx = view.x + view.w / 2,
        cy = view.y + view.h / 2
    ) => {
        setView(v => {
            const w = Math.min(WIDTH, Math.max(120, v.w * factor));
            const h = (w / WIDTH) * HEIGHT;
            const x = Math.min(
                WIDTH - w,
                Math.max(0, cx - ((cx - v.x) / v.w) * w)
            );
            const y = Math.min(
                HEIGHT - h,
                Math.max(0, cy - ((cy - v.y) / v.h) * h)
            );
            return {x, y, w, h};
        });
    };

    // the SVG point under a pointer, in graph coordinates
    const toGraph = (clientX: number, clientY: number) => {
        const box = svg.current!.getBoundingClientRect();
        return {
            x: view.x + ((clientX - box.left) / box.width) * view.w,
            y: view.y + ((clientY - box.top) / box.height) * view.h
        };
    };

    const onWheel = (event: React.WheelEvent) => {
        const p = toGraph(event.clientX, event.clientY);
        zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    };

    const selectedNode = selected ? byId.get(selected) : null;
    const selectedPools = selected
        ? pools.filter(p => p.asset_a === selected || p.asset_b === selected)
        : [];

    if (graph.nodes.length === 0) {
        return <div className={styles.empty}>{t("empty")}</div>;
    }

    return (
        <div className={styles.wrap}>
            <div className={styles.bar}>
                <span className={styles.hint}>
                    {t("summary", {
                        assets: graph.nodes.length,
                        pools: graph.edges.length
                    })}
                </span>
                <span className={styles.zoom}>
                    <Button onClick={() => zoom(1 / 1.4)} aria-label="+">
                        +
                    </Button>
                    <Button onClick={() => zoom(1.4)} aria-label="-">
                        −
                    </Button>
                    <Button onClick={() => setView(FULL)}>{t("reset")}</Button>
                </span>
            </div>
            <svg
                ref={svg}
                className={styles.svg}
                viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
                role="img"
                aria-label={t("title")}
                onWheel={onWheel}
                onPointerDown={e => {
                    pointers.current.set(e.pointerId, {
                        x: e.clientX,
                        y: e.clientY
                    });
                    const node = (e.target as Element).closest
                        ? (e.target as Element).closest("[data-node]")
                        : null;
                    if (pointers.current.size === 2) {
                        // a second finger: from now on a pinch
                        const [a, b] = Array.from(pointers.current.values());
                        const mid = toGraph((a.x + b.x) / 2, (a.y + b.y) / 2);
                        pinch.current = {
                            distance: Math.max(
                                1,
                                Math.hypot(a.x - b.x, a.y - b.y)
                            ),
                            view,
                            anchor: mid
                        };
                        drag.current = null;
                        if (press.current) press.current.moved = true;
                    } else {
                        drag.current = {x: e.clientX, y: e.clientY, view};
                        press.current = {
                            x: e.clientX,
                            y: e.clientY,
                            node: node ? node.getAttribute("data-node") : null,
                            moved: false
                        };
                    }
                    (e.currentTarget as any).setPointerCapture &&
                        (e.currentTarget as any).setPointerCapture(e.pointerId);
                }}
                onPointerMove={e => {
                    if (pointers.current.has(e.pointerId)) {
                        pointers.current.set(e.pointerId, {
                            x: e.clientX,
                            y: e.clientY
                        });
                    }
                    const box = svg.current!.getBoundingClientRect();
                    const p = pinch.current;
                    if (p && pointers.current.size >= 2) {
                        const [a, b] = Array.from(pointers.current.values());
                        setView(
                            pinchView(p, a, b, box, {
                                width: WIDTH,
                                height: HEIGHT
                            })
                        );
                        return;
                    }
                    const d = drag.current;
                    if (!d) return;
                    if (
                        press.current &&
                        Math.hypot(
                            e.clientX - press.current.x,
                            e.clientY - press.current.y
                        ) > 6
                    ) {
                        press.current.moved = true;
                    }
                    const dx = ((e.clientX - d.x) / box.width) * d.view.w;
                    const dy = ((e.clientY - d.y) / box.height) * d.view.h;
                    setView({
                        ...d.view,
                        x: Math.min(
                            WIDTH - d.view.w,
                            Math.max(0, d.view.x - dx)
                        ),
                        y: Math.min(
                            HEIGHT - d.view.h,
                            Math.max(0, d.view.y - dy)
                        )
                    });
                }}
                onPointerUp={e => {
                    const was = press.current;
                    pointers.current.delete(e.pointerId);
                    pinch.current = null;
                    const rest = Array.from(pointers.current.values());
                    if (rest.length === 1) {
                        // one finger lifted from a pinch: the other keeps
                        // panning from where it is, with no jump
                        drag.current = {x: rest[0].x, y: rest[0].y, view};
                        return;
                    }
                    drag.current = null;
                    press.current = null;
                    // a press that did not move, on an asset: select it
                    if (was && !was.moved && was.node) {
                        setSelected(sel =>
                            sel === was.node ? null : was.node
                        );
                    }
                }}
                onPointerCancel={e => {
                    pointers.current.delete(e.pointerId);
                    pinch.current = null;
                    drag.current = null;
                    press.current = null;
                }}
                onPointerLeave={e => {
                    // the graph holds the pointer while it is down; this is the
                    // mouse leaving without a press
                    if (e.pointerType === "mouse" && e.buttons === 0) {
                        pointers.current.delete(e.pointerId);
                        drag.current = null;
                    }
                }}
            >
                <g>
                    {graph.edges.map(edge => {
                        const a = byId.get(edge.a);
                        const b = byId.get(edge.b);
                        if (!a || !b) return null;
                        const lit =
                            focus && (edge.a === focus || edge.b === focus);
                        const dim = focus && !lit;
                        return (
                            <line
                                key={edge.id}
                                x1={a.x}
                                y1={a.y}
                                x2={b.x}
                                y2={b.y}
                                className={`${styles.edge} ${
                                    lit ? styles.edgeLit : ""
                                } ${dim ? styles.dim : ""}`}
                                strokeWidth={
                                    1 +
                                    (edge.value > 0
                                        ? 3 * Math.sqrt(edge.value / maxValue)
                                        : 0)
                                }
                            />
                        );
                    })}
                </g>
                <g>
                    {graph.nodes.map(node => {
                        const radius = Math.min(
                            22,
                            5 + 2.2 * Math.sqrt(node.degree)
                        );
                        const isFocus = node.id === focus;
                        const isNear = !!near && near.has(node.id);
                        const dim = focus && !isFocus && !isNear;
                        const showLabel = node.degree >= 4 || isFocus || isNear;
                        return (
                            <g
                                key={node.id}
                                className={`${styles.node} ${
                                    node.id === CORE ? styles.core : ""
                                } ${
                                    node.id === selected ? styles.picked : ""
                                } ${dim ? styles.dim : ""}`}
                                transform={`translate(${node.x} ${node.y})`}
                                data-node={node.id}
                                onMouseEnter={() => setHover(node.id)}
                                onMouseLeave={() => setHover(null)}
                            >
                                <circle r={radius} />
                                {showLabel ? (
                                    <text y={-radius - 4} textAnchor="middle">
                                        {node.symbol}
                                    </text>
                                ) : null}
                            </g>
                        );
                    })}
                </g>
            </svg>

            {selectedNode ? (
                <div className={styles.panel}>
                    <div className={styles.panelHead}>
                        <strong>{selectedNode.symbol}</strong>
                        <span className={styles.hint}>
                            {t("in_pools", {count: selectedPools.length})}
                        </span>
                        <Button
                            variant="accent"
                            onClick={() => onShowAsset(selectedNode.symbol)}
                        >
                            {t("show_in_list")}
                        </Button>
                    </div>
                    <ul className={styles.pairs}>
                        {selectedPools.slice(0, 12).map(pool => {
                            const other =
                                pool.asset_a === selected
                                    ? pool.asset_b
                                    : pool.asset_a;
                            const node = byId.get(other);
                            return (
                                <li key={pool.id}>
                                    <button
                                        type="button"
                                        className={styles.pairLink}
                                        onClick={() => setSelected(other)}
                                    >
                                        {selectedNode.symbol} /{" "}
                                        {node ? node.symbol : other}
                                    </button>
                                    <span className={styles.hint}>
                                        {pool.id}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : (
                <div className={styles.hint}>{t("click_hint")}</div>
            )}
        </div>
    );
}
