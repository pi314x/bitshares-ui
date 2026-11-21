// The fields of the strategy form are text (what is typed); this turns them into the numbers a spec has and back, and suggests
// values for a price.
import {StrategyKind, StrategySpec} from "../../lib/common/strategies";

export interface Fields {
    kind: StrategyKind;
    lower: string;
    upper: string;
    lines: string;
    spacing: "geometric" | "arithmetic";
    gridInvestment: string;
    spread: string;
    size: string;
    makerInvestment: string;
    requote: string;
    amount: string;
    every: string;
    feePercent: string;
    orderFee: string;
    /** the calculator's own inputs: round trips a day (maker), buys (DCA) */
    trips: string;
    buys: string;
}

export const DEFAULT_FIELDS: Fields = {
    kind: "grid",
    lower: "",
    upper: "",
    lines: "10",
    spacing: "geometric",
    gridInvestment: "1000",
    spread: "2",
    size: "",
    makerInvestment: "1000",
    requote: "1",
    amount: "50",
    every: "24",
    feePercent: "0.1",
    orderFee: "0",
    trips: "5",
    buys: "30"
};

/** A typed number: blank or not a number is NaN (a comma is a decimal point). */
export function parseNumber(text: string): number {
    const clean = text.trim().replace(",", ".");
    return clean === "" ? NaN : Number(clean);
}

/** A number as text with a few significant digits (a price of 0.2013478 is 0.2013). */
export function short(n: number, digits = 4): string {
    return Number.isFinite(n) ? String(Number(n.toPrecision(digits))) : "";
}

export function toSpec(f: Fields): StrategySpec {
    return {
        kind: f.kind,
        grid: {
            lower: parseNumber(f.lower),
            upper: parseNumber(f.upper),
            lines: parseNumber(f.lines),
            spacing: f.spacing,
            investment: parseNumber(f.gridInvestment)
        },
        maker: {
            spreadPercent: parseNumber(f.spread),
            size: parseNumber(f.size),
            investment: parseNumber(f.makerInvestment),
            requoteEvery: parseNumber(f.requote)
        },
        dca: {amount: parseNumber(f.amount), everyHours: parseNumber(f.every)},
        costs: {
            feePercent: parseNumber(f.feePercent),
            orderFee: parseNumber(f.orderFee)
        }
    };
}

export function fromSpec(spec: StrategySpec, keep: Fields): Fields {
    return {
        ...keep,
        kind: spec.kind,
        lower: short(spec.grid.lower, 6),
        upper: short(spec.grid.upper, 6),
        lines: String(spec.grid.lines),
        spacing: spec.grid.spacing,
        gridInvestment: short(spec.grid.investment, 6),
        spread: short(spec.maker.spreadPercent, 6),
        size: short(spec.maker.size, 6),
        makerInvestment: short(spec.maker.investment, 6),
        requote: String(spec.maker.requoteEvery),
        amount: short(spec.dca.amount, 6),
        every: short(spec.dca.everyHours, 6),
        feePercent: short(spec.costs.feePercent, 6),
        orderFee: short(spec.costs.orderFee, 6)
    };
}

/** Values for a market at `price`: a grid 10% either side, orders of a tenth of the half that is held. */
export function suggest(price: number, f: Fields): Partial<Fields> {
    if (!(price > 0)) return {};
    const investment = parseNumber(f.makerInvestment);
    const half =
        Number.isFinite(investment) && investment > 0 ? investment / 2 : 500;
    return {
        lower: short(price * 0.9),
        upper: short(price * 1.1),
        size: short(half / price / 10)
    };
}
