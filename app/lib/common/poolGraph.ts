// The liquidity pools as a graph: every asset is a node, every pool an edge
// between its two assets. The layout is a small force simulation (nodes push
// each other away, edges pull their ends together, a weak pull keeps the whole
// thing centred), run to rest in a fixed number of steps from a deterministic
// start, so the same pools always give the same picture.

export interface PoolEdgeInput {
    id: string;
    asset_a: string;
    asset_b: string;
    /** Something to size the edge by (pool value in BTS); optional. */
    value?: number | null;
}

export interface GraphNode {
    id: string;
    symbol: string;
    /** How many pools the asset is in. */
    degree: number;
    x: number;
    y: number;
}

export interface GraphEdge {
    id: string;
    a: string;
    b: string;
    value: number;
}

export interface PoolGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

/** Assets and pools -> nodes and edges (no positions yet: all at 0,0). */
export function buildGraph(
    pools: PoolEdgeInput[],
    symbolOf: (assetId: string) => string
): PoolGraph {
    const degree = new Map<string, number>();
    pools.forEach(pool => {
        degree.set(pool.asset_a, (degree.get(pool.asset_a) || 0) + 1);
        degree.set(pool.asset_b, (degree.get(pool.asset_b) || 0) + 1);
    });
    const nodes: GraphNode[] = Array.from(degree.entries()).map(
        ([id, count]) => ({
            id,
            symbol: symbolOf(id),
            degree: count,
            x: 0,
            y: 0
        })
    );
    const edges: GraphEdge[] = pools.map(pool => ({
        id: pool.id,
        a: pool.asset_a,
        b: pool.asset_b,
        value: pool.value && pool.value > 0 ? pool.value : 0
    }));
    return {nodes, edges};
}

/** A stable pseudo-random number in [0, 1) from a string. */
function hash01(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 100000) / 100000;
}

export interface LayoutOptions {
    width?: number;
    height?: number;
    steps?: number;
}

/**
 * Positions the nodes (in place) inside `width` x `height`. The assets in the
 * most pools start nearest the middle, the others on rings around it by a
 * hash of their id; then `steps` rounds of forces.
 */
export function layoutGraph(
    graph: PoolGraph,
    {width = 1000, height = 700, steps = 220}: LayoutOptions = {}
): PoolGraph {
    const {nodes, edges} = graph;
    const n = nodes.length;
    if (n === 0) return graph;
    const cx = width / 2;
    const cy = height / 2;

    const byDegree = nodes.slice().sort((p, q) => q.degree - p.degree);
    byDegree.forEach((node, rank) => {
        const ring = Math.sqrt(rank / n); // 0 at the middle, 1 at the rim
        const angle = hash01(node.id) * Math.PI * 2;
        const radius = ring * Math.min(width, height) * 0.42;
        node.x = cx + Math.cos(angle) * radius;
        node.y = cy + Math.sin(angle) * radius;
    });
    if (n === 1) {
        nodes[0].x = cx;
        nodes[0].y = cy;
        return graph;
    }

    const index = new Map<string, number>();
    nodes.forEach((node, i) => index.set(node.id, i));
    const links = edges
        .map(edge => [index.get(edge.a), index.get(edge.b)] as const)
        .filter(([a, b]) => a !== undefined && b !== undefined) as [
        number,
        number
    ][];

    // the ideal edge length shrinks as the picture fills up
    const area = width * height;
    const k = Math.sqrt(area / n) * 0.8;
    const fx = new Float64Array(n);
    const fy = new Float64Array(n);

    for (let step = 0; step < steps; step++) {
        const cooling = 1 - step / steps;
        const maxMove = (Math.min(width, height) / 10) * cooling + 0.5;
        fx.fill(0);
        fy.fill(0);

        // every pair pushes apart
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                let dx = nodes[i].x - nodes[j].x;
                let dy = nodes[i].y - nodes[j].y;
                let dist2 = dx * dx + dy * dy;
                if (dist2 < 0.01) {
                    dx = hash01(nodes[i].id + j) - 0.5;
                    dy = hash01(nodes[j].id + i) - 0.5;
                    dist2 = dx * dx + dy * dy + 0.01;
                }
                const dist = Math.sqrt(dist2);
                const push = (k * k) / dist2;
                fx[i] += (dx / dist) * push;
                fy[i] += (dy / dist) * push;
                fx[j] -= (dx / dist) * push;
                fy[j] -= (dy / dist) * push;
            }
        }
        // every pool pulls its two assets together
        for (const [a, b] of links) {
            const dx = nodes[a].x - nodes[b].x;
            const dy = nodes[a].y - nodes[b].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const pull = (dist * dist) / k / 8;
            fx[a] -= (dx / dist) * pull;
            fy[a] -= (dy / dist) * pull;
            fx[b] += (dx / dist) * pull;
            fy[b] += (dy / dist) * pull;
        }
        // a weak pull to the middle keeps separate islands on the page
        for (let i = 0; i < n; i++) {
            fx[i] += (cx - nodes[i].x) * 0.02;
            fy[i] += (cy - nodes[i].y) * 0.02;
        }
        for (let i = 0; i < n; i++) {
            const mag = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i]) || 1;
            const move = Math.min(mag, maxMove);
            nodes[i].x += (fx[i] / mag) * move;
            nodes[i].y += (fy[i] / mag) * move;
            // stay on the page
            nodes[i].x = Math.min(width - 24, Math.max(24, nodes[i].x));
            nodes[i].y = Math.min(height - 24, Math.max(24, nodes[i].y));
        }
    }
    fitToPage(nodes, width, height, 36);
    return graph;
}

/** Scales and centres the picture so that it fills the page (less `margin`). */
function fitToPage(
    nodes: GraphNode[],
    width: number,
    height: number,
    margin: number
) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    nodes.forEach(n => {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y);
    });
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (!(bw > 0) && !(bh > 0)) return;
    const scale = Math.min(
        bw > 0 ? (width - 2 * margin) / bw : Infinity,
        bh > 0 ? (height - 2 * margin) / bh : Infinity
    );
    const offsetX = (width - bw * scale) / 2;
    const offsetY = (height - bh * scale) / 2;
    nodes.forEach(n => {
        n.x = offsetX + (n.x - minX) * scale;
        n.y = offsetY + (n.y - minY) * scale;
    });
}

/** The ids of the assets next to `assetId` (one pool away). */
export function neighbours(graph: PoolGraph, assetId: string): Set<string> {
    const out = new Set<string>();
    graph.edges.forEach(edge => {
        if (edge.a === assetId) out.add(edge.b);
        else if (edge.b === assetId) out.add(edge.a);
    });
    return out;
}

export interface GraphView {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * The view of a two-finger pinch on the graph. `start` is the view, the
 * distance between the fingers and the graph point between them when the second
 * finger touched down; `a` and `b` are the fingers now (client coordinates) and
 * `box` is the graph's box on screen. Fingers apart zoom in; the point that was
 * between the fingers stays between them, so the picture also follows a pinch
 * that moves. The view never leaves the graph and never gets narrower than
 * `minWidth`.
 */
export function pinchView(
    start: {view: GraphView; distance: number; anchor: {x: number; y: number}},
    a: {x: number; y: number},
    b: {x: number; y: number},
    box: {left: number; top: number; width: number; height: number},
    size: {width: number; height: number},
    minWidth = 120
): GraphView {
    const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const w = Math.min(
        size.width,
        Math.max(minWidth, (start.view.w * start.distance) / distance)
    );
    const h = (w / size.width) * size.height;
    const fx = ((a.x + b.x) / 2 - box.left) / box.width;
    const fy = ((a.y + b.y) / 2 - box.top) / box.height;
    return {
        x: Math.min(size.width - w, Math.max(0, start.anchor.x - fx * w)),
        y: Math.min(size.height - h, Math.max(0, start.anchor.y - fy * h)),
        w,
        h
    };
}
