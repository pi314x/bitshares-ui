import {
    amountText,
    breakEven,
    cashbackOf,
    membershipStatus,
    paceOf,
    parseAmount,
    savingsOf
} from "../../lib/common/membership";

const BTS = (n: number) => BigInt(Math.round(n * 100000));

describe("membershipStatus", () => {
    const now = Date.parse("2026-10-27T00:00:00Z");
    it("knows a Lifetime member by the largest date the chain has", () => {
        expect(membershipStatus("2106-02-07T06:28:15", now)).toBe("lifetime");
        expect(membershipStatus("1969-12-31T23:59:59", now)).toBe("lifetime");
    });
    it("knows a Basic member, an annual member and what it cannot tell", () => {
        expect(membershipStatus("1970-01-01T00:00:00", now)).toBe("basic");
        expect(membershipStatus("2026-01-01T00:00:00", now)).toBe("basic");
        expect(membershipStatus("2027-03-01T00:00:00", now)).toBe("annual");
        expect(membershipStatus("", now)).toBe("unknown");
        expect(membershipStatus(null, now)).toBe("unknown");
        expect(membershipStatus("junk", now)).toBe("unknown");
    });
});

describe("cashbackOf", () => {
    it("gives back everything but the network's share", () => {
        expect(cashbackOf(BTS(3), 2000)).toBe(BTS(2.4));
        expect(cashbackOf(BigInt(100), 2000)).toBe(BigInt(80));
        // rounded down, never up
        expect(cashbackOf(BigInt(7), 2000)).toBe(BigInt(5));
        expect(cashbackOf(BTS(3), 10000)).toBe(BigInt(0));
        expect(cashbackOf(BTS(3), 0)).toBe(BTS(3));
        // a share out of range is held to the range
        expect(cashbackOf(BTS(3), 99999)).toBe(BigInt(0));
        expect(cashbackOf(BTS(3), -5)).toBe(BTS(3));
    });
});

describe("breakEven", () => {
    // the live figures: 5,791.31307 BTS, 20% to the network, a trade of three pool exchanges (3 BTS)
    const live = {lifetimeFee: BigInt("579131307"), networkBp: 2000};

    it("counts the trades whose cashback adds up to the membership fee, and the days", () => {
        const result = breakEven({
            ...live,
            feePerTrade: BTS(3),
            tradesPerDay: 100
        });
        expect(result.cashback).toBe(BTS(2.4));
        // 5,791.31307 / 2.4 = 2,413.05... -> 2,414 trades
        expect(result.trades).toBe(2414);
        expect(result.days).toBeCloseTo(24.14, 2);
    });

    it("pays back at once for a fee of a whole membership, and never without cashback", () => {
        expect(
            breakEven({
                lifetimeFee: BTS(10),
                feePerTrade: BTS(12.5),
                networkBp: 2000,
                tradesPerDay: 1
            }).trades
        ).toBe(1);
        const none = breakEven({
            ...live,
            feePerTrade: BigInt(0),
            tradesPerDay: 10
        });
        expect(none).toEqual({cashback: BigInt(0), trades: null, days: null});
        expect(
            breakEven({
                ...live,
                feePerTrade: BTS(3),
                networkBp: 10000,
                tradesPerDay: 10
            }).trades
        ).toBeNull();
    });

    it("gives no days without a rate", () => {
        expect(
            breakEven({...live, feePerTrade: BTS(3), tradesPerDay: 0}).days
        ).toBeNull();
        expect(
            breakEven({...live, feePerTrade: BTS(3), tradesPerDay: NaN}).days
        ).toBeNull();
        expect(
            breakEven({...live, feePerTrade: BTS(3), tradesPerDay: 0}).trades
        ).toBe(2414);
    });

    it("takes a dearer trade to fewer trades", () => {
        const cheap = breakEven({...live, feePerTrade: BTS(1), tradesPerDay: 1})
            .trades!;
        const dear = breakEven({...live, feePerTrade: BTS(5), tradesPerDay: 1})
            .trades!;
        expect(dear).toBeLessThan(cheap);
    });
});

describe("amounts as text", () => {
    it("reads what is typed, with a comma or a point for the decimals", () => {
        expect(parseAmount("2.5", 5)).toBe(BigInt(250000));
        expect(parseAmount("2,5", 5)).toBe(BigInt(250000));
        expect(parseAmount("3", 5)).toBe(BigInt(300000));
        expect(parseAmount(".5", 5)).toBe(BigInt(50000));
        expect(parseAmount("0.00001", 5)).toBe(BigInt(1));
    });

    it("refuses what is not an amount of the asset", () => {
        expect(parseAmount("", 5)).toBeNull();
        expect(parseAmount(".", 5)).toBeNull();
        expect(parseAmount("abc", 5)).toBeNull();
        expect(parseAmount("-1", 5)).toBeNull();
        // more decimals than the asset has
        expect(parseAmount("0.000001", 5)).toBeNull();
        // a comma beside a point is not guessed at
        expect(parseAmount("1,000.5", 5)).toBeNull();
    });

    it("writes units with their decimals and the thousands apart", () => {
        expect(amountText(BigInt("579131307"), 5)).toBe("5,791.31307");
        expect(amountText(BigInt(250000), 5)).toBe("2.5");
        expect(amountText(BigInt(300000), 5)).toBe("3");
        expect(amountText(BigInt(1), 5)).toBe("0.00001");
        expect(amountText(BigInt(0), 5)).toBe("0");
        expect(amountText(BigInt("1234567"), 0)).toBe("1,234,567");
    });
});

describe("what an account would have kept", () => {
    // thmsfnd02 on the live chain: 28,277.62603 BTS of fees paid, a Lifetime membership of 5,791.31307
    const paid = BigInt("2827762603");
    const fee = BigInt("579131307");

    it("gives back all but the network's share of the fees, against the membership's fee", () => {
        const s = savingsOf(paid, fee, 2000);
        expect(s.cashback).toBe(BigInt("2262210082"));
        expect(s.net).toBe(BigInt("1683078775"));
        expect(s.paysOff).toBe(true);
    });

    it("says it would not have paid for itself yet, and by how much", () => {
        const s = savingsOf(BigInt("100000000"), fee, 2000);
        expect(s.cashback).toBe(BigInt("80000000"));
        expect(s.net < BigInt(0)).toBe(true);
        expect(s.net).toBe(BigInt("80000000") - fee);
        expect(s.paysOff).toBe(false);
        // exactly the fee is the break-even point
        expect(savingsOf(BigInt(0), BigInt(0), 2000).paysOff).toBe(true);
    });

    it("turns the fees of some days into a month, and says when the membership pays for itself", () => {
        // 100 BTS in 2 days: 1,500 BTS a month, 1,200 BTS of it back, the fee after 4.83 months
        const pace = paceOf({
            fees: BigInt("10000000"),
            days: 2,
            lifetimeFee: fee,
            networkBp: 2000
        })!;
        expect(pace.perMonth).toBe(BigInt("150000000"));
        expect(pace.cashbackPerMonth).toBe(BigInt("120000000"));
        expect(pace.months).toBeCloseTo(4.826, 2);
    });

    it("has no pace for no fees, no time, or no cashback", () => {
        expect(
            paceOf({
                fees: BigInt(0),
                days: 2,
                lifetimeFee: fee,
                networkBp: 2000
            })
        ).toBeNull();
        expect(
            paceOf({
                fees: BigInt(5),
                days: 0,
                lifetimeFee: fee,
                networkBp: 2000
            })
        ).toBeNull();
        const none = paceOf({
            fees: BigInt(5000),
            days: 1,
            lifetimeFee: fee,
            networkBp: 10000
        })!;
        expect(none.months).toBeNull();
    });
});
