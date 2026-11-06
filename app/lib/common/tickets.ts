// Tickets ("locks": BTS locked away for voting power) and updating one
// (ticket_update, operation 58). bitshares-core's `ticket_type`: 0 liquid, 1 to 3
// claimable 180 / 360 / 720 days after an unlock request, 4 locked forever.

export const TICKET_TYPES = [0, 1, 2, 3, 4] as const;
export type TicketType = typeof TICKET_TYPES[number];
export type TicketStatus = "charging" | "stable" | "withdrawing";

const STATUSES: TicketStatus[] = ["charging", "stable", "withdrawing"];

export interface Ticket {
    id: string;
    account: string;
    targetType: TicketType;
    currentType: TicketType;
    status: TicketStatus;
    /** the asset and the amount in the smallest steps, as a string (int64) */
    assetId: string;
    amount: string;
    /** the ticket's value (voting power), in the smallest steps of its asset */
    value: string;
    /** the next time the chain changes the ticket by itself (ISO, UTC), or null */
    nextUpdate: string | null;
}

const asType = (value: any): TicketType => {
    const n = Number(value);
    return (TICKET_TYPES as readonly number[]).includes(n)
        ? (n as TicketType)
        : 0;
};

/** The node's ticket object as the list needs it. */
export function normalizeTicket(raw: any): Ticket {
    const status = Number(raw.status);
    const next = raw.next_auto_update_time;
    return {
        id: String(raw.id),
        account: String(raw.account),
        targetType: asType(raw.target_type),
        currentType: asType(raw.current_type),
        status: STATUSES[status] || "stable",
        assetId: String(raw.amount.asset_id),
        amount: String(raw.amount.amount),
        value: String(raw.value),
        // "1969-12-31T23:59:59" / the far future mean "no change planned"
        nextUpdate:
            typeof next === "string" && next < "2100-01-01T00:00:00"
                ? next
                : null
    };
}

/** The targets a ticket can be changed to: every one but its present target. */
export function targetsFor(ticket: Ticket): TicketType[] {
    return TICKET_TYPES.filter(type => type !== ticket.targetType);
}

export interface TicketUpdateOp {
    fee: {amount: number; asset_id: string};
    ticket: string;
    account: string;
    target_type: number;
    amount_for_new_target?: {amount: string; asset_id: string};
    extensions: any[];
}

/**
 * The operation. `amount` (smallest steps, as text) moves only that part of the
 * ticket to the new target, the rest keeps its own; without it the whole ticket
 * changes. Null when the target is not one the chain knows, or is the present one,
 * or the part is not a positive amount smaller than the ticket.
 */
export function buildTicketUpdateOp(args: {
    ticket: Ticket;
    targetType: number;
    amount?: string | null;
}): TicketUpdateOp | null {
    const {ticket, targetType, amount} = args;
    if (!(TICKET_TYPES as readonly number[]).includes(targetType)) return null;
    if (targetType === ticket.targetType) return null;
    const op: TicketUpdateOp = {
        fee: {amount: 0, asset_id: "1.3.0"},
        ticket: ticket.id,
        account: ticket.account,
        target_type: targetType,
        extensions: []
    };
    if (amount !== undefined && amount !== null && amount !== "") {
        if (!/^\d+$/.test(amount)) return null;
        const part = BigInt(amount);
        if (part <= BigInt(0) || part >= BigInt(ticket.amount)) return null;
        op.amount_for_new_target = {amount, asset_id: ticket.assetId};
    }
    return op;
}
