// Chain access for the review of a transaction an AI assistant prepared (MCP, docs/MCP.md):
// what the application needs to check the proposal with its own eyes - the chain it is
// connected to, the assets named in it, the market's price, the order a cancellation names -
// and the one way it sends: the same `AdvancedActions.send`, which has the wallet sign it
// (unlock prompt, or the browser extension's approval) and broadcasts it. Nothing here
// reads, logs or stores keys or passwords, and nothing is sent without a person pressing the
// button of the review page.
import {Apis} from "bitsharesjs-ws";
import {hash} from "bitsharesjs";
import AdvancedActions from "./AdvancedActions";

const db = (): any => (Apis as any).instance().db_api();

export interface ReviewAsset {
    id: string;
    symbol: string;
    precision: number;
}

class McpReviewActionsFacade {
    /** The chain the connected node serves (null while not connected). */
    chainId(): string | null {
        try {
            const id = (Apis as any).instance().chain_id;
            return id ? String(id) : null;
        } catch (e) {
            return null;
        }
    }

    /** SHA-256 of the text, as hex: the reference of a proposal is made with it. */
    sha256Hex(text: string): string {
        return hash.sha256(Buffer.from(text, "utf8")).toString("hex");
    }

    /** The assets of these ids by id; one the chain does not know is left out. */
    async getAssets(ids: string[]): Promise<Record<string, ReviewAsset>> {
        const unique = Array.from(new Set(ids));
        const found = await Promise.all(
            unique.map(id => AdvancedActions.getAssetById(id))
        );
        const out: Record<string, ReviewAsset> = {};
        found.forEach(asset => {
            if (asset) {
                out[asset.id] = {
                    id: asset.id,
                    symbol: asset.symbol,
                    precision: asset.precision
                };
            }
        });
        return out;
    }

    /** The market of (base, quote): last price, best bid and best ask in base per quote. */
    getTicker(baseId: string, quoteId: string): Promise<any> {
        return db().exec("get_ticker", [baseId, quoteId]);
    }

    /** An open limit order by id (null when there is none, or it is not an order). */
    async getOrder(id: string): Promise<any | null> {
        const rows = await db().exec("get_objects", [[id]]);
        const row = rows && rows[0];
        return row && row.id === id && row.sell_price ? row : null;
    }

    /** Has the wallet sign the operation and sends it. Rejects with the reason. */
    send(name: string, fields: any): Promise<any> {
        return AdvancedActions.send([[name, fields]]);
    }
}

const McpReviewActions = new McpReviewActionsFacade();
export default McpReviewActions;
