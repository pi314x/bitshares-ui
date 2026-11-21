import {
    RiskMemory,
    SETTLE_MARGIN,
    forgetPositions,
    levelOf,
    parseRiskMemory,
    riskAlerts
} from "../../lib/common/riskAlerts";
import {PositionInput, positionRisk} from "../../lib/common/desk";

// a position of 100 USD of debt and `collateral` BTS, the feed pricing 1 USD at 1 BTS, called at 175%:
// the ratio is collateral / 100, the distance 1 - 1.75 / ratio
const position = (id: string, collateral: number): PositionInput => ({
    id,
    debtAssetId: "1.3.5",
    collateralAssetId: "1.3.0",
    debtUnits: 10000,
    collateralUnits: collateral * 100000,
    debtPrecision: 2,
    collateralPrecision: 5,
    feed: {
        baseUnits: 100,
        baseAssetId: "1.3.5",
        quoteUnits: 100000,
        quoteAssetId: "1.3.0"
    },
    mcrPermille: 1750
});
const risk = (id: string, collateral: number) => ({
    ...positionRisk(position(id, collateral)),
    symbol: "USD"
});
// collateral -> distance: 400 -> 56%, 250 -> 30%, 230 -> 24%, 200 -> 12.5%, 190 -> 7.9%, 180 -> 2.8%, 170 -> -3%

describe("the level of a position", () => {
    it("is the risk of the position, and called below the maintenance ratio", () => {
        expect(levelOf(risk("1.8.1", 400))).toBe("ok");
        expect(levelOf(risk("1.8.1", 230))).toBe("watch");
        expect(levelOf(risk("1.8.1", 190))).toBe("danger");
        expect(levelOf(risk("1.8.1", 170))).toBe("called");
    });

    it("is ok where nothing is known of the ratio", () => {
        const none = {...risk("1.8.1", 190), ratio: null, distance: null};
        expect(levelOf(none)).toBe("ok");
    });
});

describe("riskAlerts", () => {
    it("tells a position that is safe nothing, and remembers nothing", () => {
        const out = riskAlerts({}, [risk("1.8.1", 400)]);
        expect(out.alerts).toEqual([]);
        expect(out.memory).toEqual({});
    });

    it("tells a position that is already close once, the first time it is seen", () => {
        const first = riskAlerts({}, [risk("1.8.1", 230)]);
        expect(first.alerts).toHaveLength(1);
        expect(first.alerts[0]).toMatchObject({
            id: "1.8.1",
            level: "watch",
            symbol: "USD"
        });
        expect(first.alerts[0].ratio).toBeCloseTo(2.3, 6);
        expect(first.memory).toEqual({"1.8.1": "watch"});
        // the same again (a reload, another look): nothing
        const again = riskAlerts(first.memory, [risk("1.8.1", 230)]);
        expect(again.alerts).toEqual([]);
        expect(again.memory).toEqual({"1.8.1": "watch"});
    });

    it("tells again as it gets closer: watch, then danger, then called", () => {
        let memory: RiskMemory = {};
        const levels: string[] = [];
        [400, 230, 225, 200, 190, 185, 170].forEach(collateral => {
            const out = riskAlerts(memory, [risk("1.8.1", collateral)]);
            memory = out.memory;
            out.alerts.forEach(a => levels.push(a.level));
        });
        expect(levels).toEqual(["watch", "danger", "called"]);
    });

    it("can skip a level: a position that falls from safe to danger is told as danger", () => {
        const out = riskAlerts({"1.8.1": "watch"}, [risk("1.8.1", 190)]);
        expect(out.alerts.map(a => a.level)).toEqual(["danger"]);
    });

    it("does not tell again for a price moving around a threshold: it is safer only when comfortably so", () => {
        // watch at 230 (24%); back at 24.9% -> 26% is still inside the margin (25% + 3%)
        let memory: RiskMemory = {"1.8.1": "watch"};
        const counts: number[] = [];
        [233, 227, 233, 227, 233].forEach(collateral => {
            const out = riskAlerts(memory, [risk("1.8.1", collateral)]);
            memory = out.memory;
            counts.push(out.alerts.length);
        });
        expect(counts).toEqual([0, 0, 0, 0, 0]);
        expect(memory["1.8.1"]).toBe("watch");
        // comfortably safe (56%): forgotten, and told again when it comes close again
        const safe = riskAlerts(memory, [risk("1.8.1", 400)]);
        expect(safe.memory).toEqual({});
        const close = riskAlerts(safe.memory, [risk("1.8.1", 230)]);
        expect(close.alerts).toHaveLength(1);
    });

    it("drops to a lower level only past the margin, and tells again when it worsens from there", () => {
        // danger at 190; 200 is 12.5%: past the 10% threshold but not past 10% + 3%
        let out = riskAlerts({"1.8.1": "danger"}, [risk("1.8.1", 200)]);
        expect(out.memory).toEqual({"1.8.1": "danger"});
        // 215 is 18.6%: settled into watch
        out = riskAlerts(out.memory, [risk("1.8.1", 215)]);
        expect(out.memory).toEqual({"1.8.1": "watch"});
        // and danger again is news
        out = riskAlerts(out.memory, [risk("1.8.1", 190)]);
        expect(out.alerts.map(a => a.level)).toEqual(["danger"]);
        expect(SETTLE_MARGIN).toBeGreaterThan(0);
    });

    it("keeps each position apart, and keeps the memory of one that is not among those looked at or whose ratio is unknown", () => {
        const unknown = {...risk("1.8.3", 190), ratio: null, distance: null};
        const out = riskAlerts(
            {"1.8.2": "danger", "1.8.9": "watch", "1.8.3": "watch"},
            [risk("1.8.1", 230), risk("1.8.2", 190), unknown]
        );
        expect(out.alerts.map(a => a.id)).toEqual(["1.8.1"]);
        // 1.8.9 was not looked at (not loaded yet) and 1.8.3 is unknown: both keep what they had
        expect(out.memory).toEqual({
            "1.8.1": "watch",
            "1.8.2": "danger",
            "1.8.3": "watch",
            "1.8.9": "watch"
        });
    });

    it("forgets the positions the account no longer has", () => {
        expect(
            forgetPositions({"1.8.1": "watch", "1.8.9": "danger"}, ["1.8.1"])
        ).toEqual({"1.8.1": "watch"});
        expect(forgetPositions({"1.8.1": "watch"}, [])).toEqual({});
    });
});

describe("parseRiskMemory", () => {
    it("reads back what was kept, and nothing else", () => {
        expect(
            parseRiskMemory({
                "1.8.1": "watch",
                "1.8.2": "ok",
                "1.2.3": "danger",
                "1.8.x": "called",
                "1.8.4": "<script>"
            })
        ).toEqual({"1.8.1": "watch"});
        expect(parseRiskMemory(null)).toEqual({});
        expect(parseRiskMemory([])).toEqual({});
        expect(parseRiskMemory("watch")).toEqual({});
    });
});
