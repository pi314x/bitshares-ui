import {ops} from "bitsharesjs";
import {
    TICKET_TYPES,
    buildTicketUpdateOp,
    normalizeTicket,
    targetsFor
} from "../../lib/common/tickets";

const raw = {
    id: "1.18.4",
    account: "1.2.100",
    target_type: 2,
    current_type: 1,
    amount: {amount: "5000000", asset_id: "1.3.0"},
    status: 0,
    value: "20000000",
    next_auto_update_time: "2026-11-01T00:00:00"
};

describe("normalizeTicket", () => {
    it("reads the node's ticket", () => {
        expect(normalizeTicket(raw)).toEqual({
            id: "1.18.4",
            account: "1.2.100",
            targetType: 2,
            currentType: 1,
            status: "charging",
            assetId: "1.3.0",
            amount: "5000000",
            value: "20000000",
            nextUpdate: "2026-11-01T00:00:00"
        });
    });

    it("has no next change for the far future, and takes odd values for the plain ones", () => {
        const t = normalizeTicket({
            ...raw,
            next_auto_update_time: "2106-02-07T06:28:15",
            target_type: 9,
            status: 7
        });
        expect(t.nextUpdate).toBeNull();
        expect(t.targetType).toBe(0);
        expect(t.status).toBe("stable");
    });
});

describe("targetsFor / buildTicketUpdateOp", () => {
    const ticket = normalizeTicket(raw);

    it("offers every type but the present target", () => {
        expect(targetsFor(ticket)).toEqual(
            TICKET_TYPES.filter(type => type !== 2)
        );
    });

    it("changes the whole ticket", () => {
        expect(buildTicketUpdateOp({ticket, targetType: 4})).toEqual({
            fee: {amount: 0, asset_id: "1.3.0"},
            ticket: "1.18.4",
            account: "1.2.100",
            target_type: 4,
            extensions: []
        });
    });

    it("changes a part of it", () => {
        const op = buildTicketUpdateOp({
            ticket,
            targetType: 0,
            amount: "1000000"
        });
        expect(op && op.amount_for_new_target).toEqual({
            amount: "1000000",
            asset_id: "1.3.0"
        });
    });

    it("refuses what cannot work", () => {
        expect(buildTicketUpdateOp({ticket, targetType: 2})).toBeNull(); // the same
        expect(buildTicketUpdateOp({ticket, targetType: 7})).toBeNull();
        expect(
            buildTicketUpdateOp({ticket, targetType: 0, amount: "0"})
        ).toBeNull();
        expect(
            buildTicketUpdateOp({ticket, targetType: 0, amount: "5000000"})
        ).toBeNull(); // all of it is no part
        expect(
            buildTicketUpdateOp({ticket, targetType: 0, amount: "1.5"})
        ).toBeNull();
    });

    it("is an operation the serializer takes", () => {
        const op = buildTicketUpdateOp({
            ticket,
            targetType: 0,
            amount: "1000000"
        });
        const operation = (ops as any).operation;
        const back = operation.toObject(operation.fromObject([58, op]));
        expect(back[1].ticket).toBe("1.18.4");
        expect(String(back[1].target_type)).toBe("0");
        expect(String(back[1].amount_for_new_target.amount)).toBe("1000000");
    });
});
