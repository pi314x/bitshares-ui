// When a borrow position gets close to a margin call, the user is told once: when it first reaches "watch" (the
// collateral price may fall 25% before the call), again at "danger" (10%), and again when it is "called" (below the
// maintenance ratio: it can be called any moment). What was told is remembered per position, so that a reload
// does not repeat it, and a position that gets safer is forgotten only when it is comfortably safer (a margin
// above the threshold): a price that moves around a threshold must not be announced at every crossing.
import {PositionRisk} from "./desk";

export type RiskLevel = "ok" | "watch" | "danger" | "called";

const ORDER: {[level in RiskLevel]: number} = {
    ok: 0,
    watch: 1,
    danger: 2,
    called: 3
};

/** The distances of `positionRisk`: below 10% is danger, below 25% is watch. */
const DANGER = 0.1;
const WATCH = 0.25;
/** How much better than a threshold a position has to be before it counts as having left that level. */
export const SETTLE_MARGIN = 0.03;

/** What was told for each position (by the id of its call order). */
export type RiskMemory = {[positionId: string]: RiskLevel};

export interface RiskAlert {
    id: string;
    level: "watch" | "danger" | "called";
    symbol: string;
    /** collateral value / debt value at the feed (1.82 = 182%) */
    ratio: number;
    /** the ratio at which the position is called */
    mcr: number | null;
    /** how far the collateral's price may fall before the call (0.12 = 12%) */
    distance: number | null;
}

/** The level a position is at now. */
export function levelOf(risk: PositionRisk): RiskLevel {
    if (risk.ratio === null || risk.distance === null) return "ok";
    if (risk.distance < 0) return "called";
    return risk.risk;
}

/** The level a position has settled into: as `levelOf`, with every threshold moved by the margin. */
function settledLevel(risk: PositionRisk): RiskLevel {
    if (risk.ratio === null || risk.distance === null) return "ok";
    if (risk.distance < SETTLE_MARGIN) return "called";
    if (risk.distance < DANGER + SETTLE_MARGIN) return "danger";
    if (risk.distance < WATCH + SETTLE_MARGIN) return "watch";
    return "ok";
}

/**
 * What to tell now, and what is remembered afterwards. A position is told about when its level is above the one
 * remembered for it (no memory: "ok"), and the memory falls to the level it has settled into when that is lower.
 * What is remembered of a position that is not among `risks` (not loaded yet, or its ratio is not known) is kept;
 * `forgetPositions` drops the ones that are gone.
 */
export function riskAlerts(
    memory: RiskMemory,
    risks: Array<PositionRisk & {symbol: string}>
): {alerts: RiskAlert[]; memory: RiskMemory} {
    const alerts: RiskAlert[] = [];
    const next: RiskMemory = {...memory};
    risks.forEach(risk => {
        const before = memory[risk.id] || "ok";
        if (risk.ratio === null) return;
        const now = levelOf(risk);
        let kept = before;
        if (ORDER[now] > ORDER[before]) {
            alerts.push({
                id: risk.id,
                level: now as RiskAlert["level"],
                symbol: risk.symbol,
                ratio: risk.ratio,
                mcr: risk.mcr,
                distance: risk.distance
            });
            kept = now;
        } else {
            const settled = settledLevel(risk);
            if (ORDER[settled] < ORDER[before]) kept = settled;
        }
        if (kept !== "ok") next[risk.id] = kept;
        else delete next[risk.id];
    });
    return {alerts, memory: next};
}

/** The memory without the positions the account no longer has. */
export function forgetPositions(
    memory: RiskMemory,
    present: string[]
): RiskMemory {
    const out: RiskMemory = {};
    Object.keys(memory).forEach(id => {
        if (present.includes(id)) out[id] = memory[id];
    });
    return out;
}

/** What is kept in the browser is only read back if it is a memory this file wrote. */
export function parseRiskMemory(raw: unknown): RiskMemory {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: RiskMemory = {};
    Object.keys(raw as object).forEach(id => {
        const level = (raw as any)[id];
        if (
            /^1\.8\.\d+$/.test(id) &&
            (level === "watch" || level === "danger" || level === "called")
        ) {
            out[id] = level;
        }
    });
    return out;
}
