// A holding in a market with no trade in the last 24 hours: its last price
// still values it, but only where nobody asked for a strict price.
import {Map as ImmutableMap, fromJS} from "immutable";
import marketUtils from "common/market_utils";
import {
    calcMarketStats,
    invertMarketStats
} from "../../store/slices/marketsSlice";

const asset = (id: string, symbol: string, precision = 5) =>
    fromJS({id, symbol, precision});
const core = asset("1.3.0", "BTS");
const busd = asset("1.3.5", "XBTSX.BUSD");

// the stats as the app stores them for one market: the ticker as the node
// answers `get_ticker(second, first)`, and the inverted entry next to it
function statsFor(from: any, to: any, price: number, volume: number) {
    const {marketName, first, second} = marketUtils.getMarketName(from, to);
    // `latest` is the price of the ticker's base in its quote asset, the other
    // way round for the other orientation
    const baseIsFrom = second.get("id") === from.get("id");
    const latest = baseIsFrom ? 1 / price : price;
    const ticker = {
        base_volume: String(volume),
        quote_volume: String(volume),
        latest: String(latest),
        percent_change: "0"
    };
    const stats = calcMarketStats(second, first, marketName, ticker);
    const {invertedStats, invertedMarketName} = invertMarketStats(
        stats,
        marketName
    );
    return ImmutableMap<string, any>()
        .set(marketName, stats)
        .set(invertedMarketName, invertedStats);
}

describe("an idle market (a price, no trade in the last 24 hours)", () => {
    // 1 BUSD = 97 BTS, last traded some time ago
    const stats = statsFor(busd, core, 97, 0);

    it("has no strict price", () => {
        expect(
            marketUtils.getFinalPrice(core, busd, core, stats, false)
        ).toBeNull();
        expect(
            marketUtils.convertValue(100000, core, busd, stats, core)
        ).toBeNull();
    });

    it("has its last price when that is allowed", () => {
        const value = marketUtils.convertValueOrIdle(
            100000, // 1.00000 BUSD
            core,
            busd,
            stats,
            core
        );
        expect(value).toBeCloseTo(97 * 100000, -1); // 97.00000 BTS
        expect(
            marketUtils.getFinalPriceOrIdle(core, busd, core, stats, true)
        ).toBeCloseTo(97, 6);
    });

    it("does not let a strict question be answered with the idle price", () => {
        marketUtils.getFinalPriceOrIdle(core, busd, core, stats, false);
        // the idle answer was cached apart: asking strictly still says no
        expect(
            marketUtils.getFinalPrice(core, busd, core, stats, false)
        ).toBeNull();
    });
});

describe("a market that traded today", () => {
    const stats = statsFor(busd, core, 90, 1234);

    it("is priced the same strictly and with the fallback", () => {
        const strict = marketUtils.convertValue(
            100000,
            core,
            busd,
            stats,
            core
        );
        const loose = marketUtils.convertValueOrIdle(
            100000,
            core,
            busd,
            stats,
            core
        );
        expect(strict).not.toBeNull();
        expect(loose).toBe(strict);
        expect(strict).toBeCloseTo(90 * 100000, -1);
    });
});

describe("no market data at all", () => {
    it("is still no price", () => {
        expect(
            marketUtils.convertValueOrIdle(
                100000,
                core,
                busd,
                ImmutableMap(),
                core
            )
        ).toBeNull();
    });
});
