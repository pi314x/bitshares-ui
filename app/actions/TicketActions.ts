// Tickets (locks): reading an account's and updating one (ticket_update). Reads go to
// the node's database API (`get_tickets_by_account`, paged); the update builds the
// transaction from `lib/common/tickets.ts` and hands it to
// `WalletDb.process_transaction` (wallet unlock, local signing, broadcast). Failures
// reject so the dialog can show the node's reason. No keys or passwords are read here.
import {Apis} from "bitsharesjs-ws";
import WalletApi from "api/WalletApi";
import WalletDb from "../stores/WalletDb";
import {Ticket, TicketUpdateOp, normalizeTicket} from "../lib/common/tickets";

const PAGE = 100;

class TicketActionsFacade {
    /** All the tickets of an account (name or id), oldest first. */
    async getByAccount(account: string): Promise<Ticket[]> {
        const out: Ticket[] = [];
        let start: string | null = null;
        for (let page = 0; page < 20; page++) {
            const rows: any[] = await Apis.instance()
                .db_api()
                .exec("get_tickets_by_account", [account, PAGE, start]);
            rows.forEach(row => out.push(normalizeTicket(row)));
            if (rows.length < PAGE) break;
            // the next page starts at the id after the last one
            const last = rows[rows.length - 1].id.split(".");
            start = `${last[0]}.${last[1]}.${Number(last[2]) + 1}`;
        }
        return out;
    }

    update(op: TicketUpdateOp): Promise<any> {
        return Promise.resolve().then(() => {
            const tr = WalletApi.new_transaction();
            tr.add_type_operation("ticket_update", op);
            return WalletDb.process_transaction(tr, null, true);
        });
    }
}

export default new TicketActionsFacade();
