// A string the interpolation cannot read throws where it is translated and takes the
// whole page down (the pools page did, with "Swap fee (%)": a % that is neither %% nor
// the start of a %(name)s). Every string of every locale goes through the app's own
// translate with its named parameters filled; what throws must be on the list of the
// ones that already did when this was written (they are in text that is not reached the
// same way, or not at all) - a new one fails here.
import counterpart from "counterpart";
import {readdirSync, readFileSync} from "fs";
import {join} from "path";

const LEGACY = new Set([
    "account.member.fee_division_text.paragraph_1",
    "account.member.fee_division_text.paragraph_2",
    "account.member.referral_info",
    "account.percent",
    "account.user_issued_assets.too_many_feed",
    "counterpart.formats.date.full",
    "counterpart.formats.date.market_history",
    "counterpart.formats.date.market_history_us",
    "counterpart.formats.date.short_custom",
    "exchange.order_grouping",
    "exchange.settle_offset",
    "explorer.asset.collateral.bid_text",
    "gateway.assets.bit",
    "gateway.assets.pirate",
    "gateway.assets.trade",
    "gateway.assets.xbtsx",
    "prediction.create_market_modal.commission",
    "showcases.borrow.steps_risks.text",
    "tooltip.gateway",
    "transaction.broadcast_fail",
    "wallet.pass_length"
]);

const dir = join(__dirname, "../../assets/locales");
const files = readdirSync(dir).filter(name => /^locale-\w+\.json$/.test(name));

describe("locale strings", () => {
    files.forEach(file => {
        it(`${file}: no new string that cannot be interpolated`, () => {
            const code = file.slice(7, -5);
            const data = JSON.parse(readFileSync(join(dir, file), "utf8"));
            (counterpart as any).registerTranslations(code, data);
            const offenders: string[] = [];
            const walk = (node: any, path: string[]) => {
                if (node && typeof node === "object" && !Array.isArray(node)) {
                    Object.keys(node).forEach(key =>
                        walk(node[key], [...path, key])
                    );
                } else if (typeof node === "string") {
                    const params: Record<string, string> = {};
                    (node.match(/%\((\w+)\)/g) || []).forEach(
                        m => (params[m.slice(2, -1)] = "1")
                    );
                    const key = path.join(".");
                    try {
                        (counterpart as any).translate(key, {
                            locale: code,
                            ...params
                        });
                    } catch (e) {
                        if (!LEGACY.has(key)) offenders.push(`${key}: ${node}`);
                    }
                }
            };
            walk(data, []);
            expect(offenders).toEqual([]);
        });
    });
});
