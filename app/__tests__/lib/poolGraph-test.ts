import {buildGraph, layoutGraph, neighbours} from "../../lib/common/poolGraph";

const symbols: Record<string, string> = {
    "1.3.0": "BTS",
    "1.3.1": "USD",
    "1.3.2": "CNY",
    "1.3.3": "GOLD",
    "1.3.9": "LONELY",
    "1.3.8": "ISLAND"
};
const sym = (id: string) => symbols[id] || id;

const pools = [
    {id: "1.19.0", asset_a: "1.3.0", asset_b: "1.3.1", value: 1000},
    {id: "1.19.1", asset_a: "1.3.0", asset_b: "1.3.2", value: 500},
    {id: "1.19.2", asset_a: "1.3.0", asset_b: "1.3.3"},
    {id: "1.19.3", asset_a: "1.3.1", asset_b: "1.3.2", value: 0}
];

describe("buildGraph", () => {
    it("has a node per asset with the number of pools it is in, and an edge per pool", () => {
        const g = buildGraph(pools, sym);
        expect(g.nodes.map(n => [n.symbol, n.degree]).sort()).toEqual([
            ["BTS", 3],
            ["CNY", 2],
            ["GOLD", 1],
            ["USD", 2]
        ]);
        expect(g.edges.map(e => e.id)).toEqual([
            "1.19.0",
            "1.19.1",
            "1.19.2",
            "1.19.3"
        ]);
        // no value is a zero weight, not NaN
        expect(g.edges[2].value).toBe(0);
    });

    it("finds the neighbours of an asset", () => {
        const g = buildGraph(pools, sym);
        expect(Array.from(neighbours(g, "1.3.3"))).toEqual(["1.3.0"]);
        expect(Array.from(neighbours(g, "1.3.0")).sort()).toEqual([
            "1.3.1",
            "1.3.2",
            "1.3.3"
        ]);
    });
});

describe("layoutGraph", () => {
    it("keeps every node inside the page and gives the same picture twice", () => {
        const a = layoutGraph(buildGraph(pools, sym), {
            width: 800,
            height: 500
        });
        const b = layoutGraph(buildGraph(pools, sym), {
            width: 800,
            height: 500
        });
        a.nodes.forEach(n => {
            expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
            expect(n.x).toBeGreaterThanOrEqual(0);
            expect(n.x).toBeLessThanOrEqual(800);
            expect(n.y).toBeGreaterThanOrEqual(0);
            expect(n.y).toBeLessThanOrEqual(500);
        });
        expect(a.nodes.map(n => [n.id, n.x, n.y])).toEqual(
            b.nodes.map(n => [n.id, n.x, n.y])
        );
    });

    it("does not stack nodes on top of each other", () => {
        const g = layoutGraph(buildGraph(pools, sym));
        for (let i = 0; i < g.nodes.length; i++) {
            for (let j = i + 1; j < g.nodes.length; j++) {
                const d = Math.hypot(
                    g.nodes[i].x - g.nodes[j].x,
                    g.nodes[i].y - g.nodes[j].y
                );
                expect(d).toBeGreaterThan(10);
            }
        }
    });

    it("draws pools that share an asset closer than ones that do not", () => {
        const g = layoutGraph(
            buildGraph(
                [...pools, {id: "1.19.9", asset_a: "1.3.8", asset_b: "1.3.9"}],
                sym
            )
        );
        const at = (id: string) => g.nodes.find(n => n.id === id)!;
        const dist = (p: string, q: string) =>
            Math.hypot(at(p).x - at(q).x, at(p).y - at(q).y);
        // BTS-USD are joined; BTS and the separate island pair are not
        expect(dist("1.3.0", "1.3.1")).toBeLessThan(dist("1.3.0", "1.3.9"));
    });

    it("handles no nodes and a single pool", () => {
        expect(layoutGraph({nodes: [], edges: []}).nodes).toEqual([]);
        const g = layoutGraph(
            buildGraph(
                [{id: "1.19.0", asset_a: "1.3.0", asset_b: "1.3.1"}],
                sym
            )
        );
        expect(g.nodes).toHaveLength(2);
    });
});
