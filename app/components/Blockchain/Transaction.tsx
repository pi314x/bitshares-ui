// TypeScript/functional-component port of the legacy Transaction.jsx
// (Phase 2, docs/UI_MIGRATION_PLAN.md). Renders a decoded, human-readable
// view of one transaction's operations - used by Block.jsx (viewing a
// block's contained transactions) and TransactionConfirm.jsx (the
// app-wide pre-broadcast confirmation dialog, rendered with
// `no_links={true}`). Purely read-only display: no `TransactionBuilder`,
// no `.broadcast(`/`.sign(` calls, no operation-building forms anywhere
// in this file - it only maps each of the ~40 known chain operation
// types to a table of display rows. The one wallet-adjacent call,
// `WalletUnlockActions.unlock()` (used only to decrypt-and-show a
// transfer/issue memo inline), is reused exactly as before and documented
// below, same "prefer minimal, well-tested diffs" treatment AGENTS.md
// calls for near wallet-unlock code even in an otherwise low-risk file.
//
// Confirmed dead, dropped (verified by reading the whole file):
// - `import {Link, DirectLink} from "react-scroll"` - `DirectLink` was
//   never referenced anywhere, and the `Link` name was always shadowed
//   by a local `let Link = ...` inside `linkToAccount`/`linkToAsset`
//   before any JSX used it, so the react-scroll import itself was never
//   actually reached. (`Link` from `react-router-dom` is what those
//   methods really used, aliased `RealLink` in the original.)
// - The `proposal_create` case's local `var operations = []` (built via
//   `op[1].proposed_ops.forEach`) - populated but never read anywhere
//   afterward; `proposalsText` computes straight from
//   `op[1].proposed_ops.map(...)`, not from this array. Also shadowed
//   the module-level `operations` (from `ChainTypes`) for the rest of
//   the function under `var`'s scoping rules, though that had no visible
//   effect since nothing else in the function referenced the bare name.
// - `Transaction`'s own `this.state = {}` - never read or set anywhere,
//   so no local state carried over into the functional port at all.
// - `OpType`'s `shouldComponentUpdate` (gated re-render on the `type`
//   prop) - a perf-only micro-optimization for a single `<tr>`, dropped
//   like the rest of this migration's legacy SCU gates; doesn't change
//   output.
// - `OperationTable`'s `opCount`/`index` props (and the `opCount`
//   variable in `Transaction` that fed the former) - both passed by
//   every caller of `<OperationTable>` but never read inside it; its
//   render only ever used `txIndex`, `operation`, and `color`.
//
// `componentDidMount`'s `ReactTooltip.rebuild()` -> `useEffect(..., [])`.
// `_toggleLock`'s `this.forceUpdate()` (needed so the now-decrypted memo
// text - re-computed fresh from `PrivateKeyStore.decodeMemo` on every
// render - actually shows once the wallet unlocks) -> the standard hooks
// forceUpdate substitute used elsewhere in this migration (a dummy
// `useState` setter).
//
// `Transaction` was also missing a `block` prop from its own
// `propTypes`/`defaultProps` even though `render()` reads
// `this.props.block` in the `htlc_create` case - `Block.jsx` does pass
// it, `TransactionConfirm.jsx` doesn't (falls back to `new Date()`, same
// as before). Declared in the new `TransactionProps` interface since
// it's genuinely read.
import * as React from "react";
import FormattedAsset from "../Utility/FormattedAsset";
import {Link as RealLink, LinkProps} from "react-router-dom";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import classNames from "classnames";
import {FormattedDate} from "react-intl";
import Inspector from "react-json-inspector";
import utils from "common/utils";
import {Icon as AntIcon} from "bitshares-ui-style-guide";
import LinkToAccountById from "../Utility/LinkToAccountById";
import LinkToAssetById from "../Utility/LinkToAssetById";
import FormattedPrice from "../Utility/FormattedPrice";
import account_constants from "chain/account_constants";
import Icon from "../Icon/Icon";
import PrivateKeyStore from "stores/PrivateKeyStore";
import WalletUnlockActions from "actions/WalletUnlockActions";
import ProposedOperation from "./ProposedOperation";
import {ChainTypes} from "bitsharesjs";
import ReactTooltip from "react-tooltip";
import moment from "moment";
import {Tooltip} from "bitshares-ui-style-guide";
import JSONModal from "components/Modal/JSONModal";
import asset_utils from "../../lib/common/asset_utils";

import "./operations.scss";
import "./json-inspector.scss";

const {operations: chainOperationTypes} = ChainTypes as any;
const ops: string[] = Object.keys(chainOperationTypes);
const listings = Object.keys((account_constants as any).account_listing);

const TypedLink = RealLink as React.ComponentType<LinkProps>;

function TranslateBoolean({value, ...otherProps}: {value: boolean; [key: string]: any}) {
    return (
        <Translate
            content={`boolean.${value ? "true" : "false"}`}
            {...otherProps}
        />
    );
}

function NoLinkDecorator({children}: {children?: React.ReactNode}) {
    return <span>{children}</span>;
}

interface OpTypeProps {
    txIndex: number;
    type: number;
    color?: string;
    openJSONModal: () => void;
}

function OpType({txIndex, type, color, openJSONModal}: OpTypeProps) {
    const trxTypes = counterpart.translate("transaction.trxTypes") as any;
    const labelClass = classNames("txtlabel", color || "info");

    return (
        <tr>
            <td>
                <span className={labelClass}>
                    {txIndex >= 0 ? (
                        <span>
                            #{txIndex + 1}
                            :&nbsp;
                        </span>
                    ) : (
                        ""
                    )}
                    {trxTypes[ops[type]]}
                </span>
            </td>
            <td className="json-link" onClick={openJSONModal}>
                <AntIcon type="file-search" />
                <Translate component="a" content="transaction.view_json" />
            </td>
        </tr>
    );
}

interface OperationTableProps {
    txIndex: number;
    operation: any;
    color?: string;
    children?: React.ReactNode;
}

function OperationTable({
    txIndex,
    operation,
    color,
    children
}: OperationTableProps) {
    const [visible, setVisible] = React.useState(false);

    function openJSONModal() {
        setVisible(true);
    }

    function closeJSONModal() {
        setVisible(false);
    }

    const feeRow = (
        <tr>
            <td>
                <Translate component="span" content="transfer.fee" />
            </td>
            <td>
                {operation[1].fee.amount > 0 ? (
                    <span>
                        <FormattedAsset
                            color="fee"
                            amount={operation[1].fee.amount}
                            asset={operation[1].fee.asset_id}
                            style={{marginRight: "10px"}}
                        />
                        &nbsp;&nbsp;
                        <Icon
                            name="question-circle"
                            title="settings.can_change_default_fee_asset_tooltip"
                        />
                    </span>
                ) : (
                    <label>
                        <Translate content="transfer.free" />
                    </label>
                )}
            </td>
        </tr>
    );
    const trxTypes = counterpart.translate("transaction.trxTypes") as any;

    return (
        <div>
            <table style={{marginBottom: "1em"}} className="table op-table">
                <caption />
                <tbody>
                    <OpType
                        txIndex={txIndex}
                        type={operation[0]}
                        color={color}
                        openJSONModal={openJSONModal}
                    />
                    {children}
                    {feeRow}
                </tbody>
            </table>
            <JSONModal
                visible={visible}
                operation={operation}
                title={trxTypes[ops[operation[0]] || ""]}
                hideModal={closeJSONModal}
            />
        </div>
    );
}

interface TransactionProps {
    trx: any;
    index: number;
    no_links?: boolean;
    block?: any;
}

export default function Transaction({
    trx,
    index,
    no_links = false,
    block
}: TransactionProps) {
    React.useEffect(() => {
        (ReactTooltip as any).rebuild();
    }, []);

    const [, forceRerender] = React.useState({});

    function linkToAccount(name_or_id: string) {
        if (!name_or_id) return <span>-</span>;
        const LinkComponent = no_links ? NoLinkDecorator : TypedLink;
        return utils.is_object_id(name_or_id) ? (
            <LinkToAccountById account={name_or_id} />
        ) : (
            <LinkComponent to={`/account/${name_or_id}/overview`}>
                {name_or_id}
            </LinkComponent>
        );
    }

    function linkToAsset(symbol_or_id: string) {
        if (!symbol_or_id) return <span>-</span>;
        const LinkComponent = no_links ? NoLinkDecorator : TypedLink;
        return utils.is_object_id(symbol_or_id) ? (
            <LinkToAssetById asset={symbol_or_id} />
        ) : (
            <LinkComponent to={`/asset/${symbol_or_id}`}>
                {symbol_or_id}
            </LinkComponent>
        );
    }

    function toggleLock(e: React.MouseEvent) {
        e.preventDefault();
        (WalletUnlockActions as any)
            .unlock()
            .then(() => {
                forceRerender({});
            })
            .catch(() => {});
    }

    const info: React.ReactNode[] = [];
    let memo: React.ReactNode = null;

    trx.operations.forEach((op: any, opIndex: number) => {
        const rows: React.ReactNode[] = [];
        let key = 0;
        let color = "";

        switch (
            ops[op[0]] // For a list of trx types, see chain_types.coffee
        ) {
            case "transfer": {
                color = "success";

                if (op[1].memo) {
                    const {text, isMine} = (PrivateKeyStore as any).decodeMemo(
                        op[1].memo
                    );

                    memo = text ? (
                        <td className="memo" style={{wordBreak: "break-all"}}>
                            {text}
                        </td>
                    ) : !text && isMine ? (
                        <td>
                            <Translate content="transfer.memo_unlock" />
                            &nbsp;
                            <a onClick={toggleLock}>
                                <Icon
                                    name="locked"
                                    title="icons.locked.action"
                                />
                            </a>
                        </td>
                    ) : null;
                }

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="transfer.from" />
                        </td>
                        <td>{linkToAccount(op[1].from)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="transfer.to" />
                        </td>
                        <td>{linkToAccount(op[1].to)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transfer.amount"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].amount.amount}
                                asset={op[1].amount.asset_id}
                            />
                        </td>
                    </tr>
                );

                if (memo) {
                    rows.push(
                        <tr key={key++}>
                            <td>
                                <Translate content="transfer.memo" />
                            </td>
                            {memo}
                        </tr>
                    );
                }

                break;
            }

            case "limit_order_create": {
                color = "warning";
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="exchange.price" />
                        </td>
                        <td>
                            <FormattedPrice
                                base_asset={op[1].amount_to_sell.asset_id}
                                quote_asset={op[1].min_to_receive.asset_id}
                                base_amount={op[1].amount_to_sell.amount}
                                quote_amount={op[1].min_to_receive.amount}
                                noPopOver
                            />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="exchange.sell" />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].amount_to_sell.amount}
                                asset={op[1].amount_to_sell.asset_id}
                            />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Tooltip
                                placement="left"
                                title={counterpart.translate("tooltip.buy_min")}
                            >
                                <Translate
                                    component="span"
                                    content="exchange.buy_min"
                                />
                            </Tooltip>
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].min_to_receive.amount}
                                asset={op[1].min_to_receive.asset_id}
                            />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.seller"
                            />
                        </td>
                        <td>{linkToAccount(op[1].seller)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.expiration"
                            />
                        </td>
                        <td>
                            <FormattedDate
                                value={moment.utc(op[1].expiration)}
                                format="full"
                                timeZoneName="short"
                            />
                        </td>
                    </tr>
                );

                break;
            }

            case "limit_order_cancel": {
                color = "cancel";
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.order_id"
                            />
                        </td>
                        <td>{op[1].order}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.fee_payer"
                            />
                        </td>
                        <td>{linkToAccount(op[1].fee_paying_account)}</td>
                    </tr>
                );

                break;
            }

            case "short_order_cancel": {
                color = "cancel";
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.order_id"
                            />
                        </td>
                        <td>{op[1].order}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.fee_payer"
                            />
                        </td>
                        <td>{linkToAccount(op[1].fee_paying_account)}</td>
                    </tr>
                );

                break;
            }

            case "call_order_update": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.funding_account"
                            />
                        </td>
                        <td>{linkToAccount(op[1].funding_account)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.delta_collateral"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].delta_collateral.amount}
                                asset={op[1].delta_collateral.asset_id}
                            />
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.delta_debt"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].delta_debt.amount}
                                asset={op[1].delta_debt.asset_id}
                            />
                        </td>
                    </tr>
                );
                if (
                    !!op[1].extensions &&
                    !!op[1].extensions.target_collateral_ratio
                ) {
                    rows.push(
                        <tr key={key++}>
                            <td>
                                <Translate
                                    component="span"
                                    content="transaction.collateral_target"
                                />
                            </td>
                            <td>
                                {op[1].extensions.target_collateral_ratio / 1000}
                            </td>
                        </tr>
                    );
                }

                break;
            }

            case "key_create": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.fee_payer"
                            />
                        </td>
                        <td>{linkToAccount(op[1].fee_paying_account)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.key"
                            />
                        </td>
                        <td>{op[1].key_data[1]}</td>
                    </tr>
                );

                break;
            }

            case "account_create": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="account.name" />
                        </td>
                        <td>{linkToAccount(op[1].name)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="account.member.registrar"
                            />
                        </td>
                        <td>{linkToAccount(op[1].registrar)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="account.member.lifetime_referrer"
                            />
                        </td>
                        <td>{linkToAccount(op[1].referrer)}</td>
                    </tr>
                );

                break;
            }

            case "account_update": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="account.name" />
                        </td>
                        <td>{linkToAccount(op[1].account)}</td>
                    </tr>
                );
                if (op[1].new_options) {
                    if (op[1].new_options.voting_account) {
                        rows.push(
                            <tr key={key++}>
                                <td>
                                    <Translate
                                        component="span"
                                        content="account.votes.proxy"
                                    />
                                </td>
                                <td>
                                    {linkToAccount(
                                        op[1].new_options.voting_account
                                    )}
                                </td>
                            </tr>
                        );
                    } else {
                        console.log(
                            "num witnesses: ",
                            op[1].new_options.num_witness
                        );
                        console.log(
                            "===============> NEW: ",
                            op[1].new_options
                        );
                        rows.push(
                            <tr key={key++}>
                                <td>
                                    <Translate
                                        component="span"
                                        content="account.votes.proxy"
                                    />
                                </td>
                                <td>
                                    <Translate
                                        component="span"
                                        content="account.votes.no_proxy"
                                    />
                                </td>
                            </tr>
                        );
                        rows.push(
                            <tr key={key++}>
                                <td>
                                    <Translate
                                        component="span"
                                        content="account.options.num_committee"
                                    />
                                </td>
                                <td>{op[1].new_options.num_committee}</td>
                            </tr>
                        );
                        rows.push(
                            <tr key={key++}>
                                <td>
                                    <Translate
                                        component="span"
                                        content="account.options.num_witnesses"
                                    />
                                </td>
                                <td>{op[1].new_options.num_witness}</td>
                            </tr>
                        );
                        rows.push(
                            <tr key={key++}>
                                <td>
                                    <Translate
                                        component="span"
                                        content="account.options.votes"
                                    />
                                </td>
                                <td>
                                    {JSON.stringify(op[1].new_options.votes)}
                                </td>
                            </tr>
                        );
                    }

                    rows.push(
                        <tr key={key++}>
                            <td>
                                <Translate
                                    component="span"
                                    content="account.options.memo_key"
                                />
                            </td>
                            {/* TODO replace with KEY render component that provides a popup */}
                            <td>
                                {op[1].new_options.memo_key.substring(0, 10) +
                                    "..."}
                            </td>
                        </tr>
                    );
                }

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.common_options"
                            />
                        </td>
                        <td>
                            <Inspector data={op[1]} search={false} />
                        </td>
                    </tr>
                );

                break;
            }

            case "account_whitelist": {
                let listing;
                for (let i = 0; i < listings.length; i++) {
                    if (
                        (account_constants as any).account_listing[
                            listings[i]
                        ] === op[1].new_listing
                    ) {
                        console.log("listings:", listings[i]);
                        listing = listings[i];
                    }
                }

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.authorizing_account"
                            />
                        </td>
                        <td>{linkToAccount(op[1].authorizing_account)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.listed_account"
                            />
                        </td>
                        <td>{linkToAccount(op[1].account_to_list)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.new_listing"
                            />
                        </td>
                        <td>
                            <Translate
                                content={`transaction.whitelist_states.${listing}`}
                            />
                        </td>
                    </tr>
                );

                break;
            }

            case "account_upgrade": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.account_upgrade"
                            />
                        </td>
                        <td>{linkToAccount(op[1].account_to_upgrade)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.lifetime"
                            />
                        </td>
                        <td>{op[1].upgrade_to_lifetime_member.toString()}</td>
                    </tr>
                );
                break;
            }

            case "account_transfer": {
                // This case is uncomplete, needs filling out with proper fields
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="transfer.from" />
                        </td>
                        <td>{linkToAccount(op[1].account_id)}</td>
                    </tr>
                );

                break;
            }

            case "asset_create": {
                color = "warning";

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.assets.issuer"
                            />
                        </td>
                        <td>{linkToAccount(op[1].issuer)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.assets.symbol"
                            />
                        </td>
                        <td>{linkToAsset(op[1].symbol)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.assets.precision"
                            />
                        </td>
                        <td>{op[1].precision}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="account.user_issued_assets.max_supply"
                            />
                        </td>
                        <td>
                            {utils.format_asset(
                                op[1].common_options.max_supply,
                                op[1]
                            )}
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="account.user_issued_assets.description"
                            />
                        </td>
                        <td>{op[1].common_options.description}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.market_fee"
                            />
                        </td>
                        <td>
                            {op[1].common_options.market_fee_percent / 100}%
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.max_market_fee"
                            />
                        </td>
                        <td>
                            {utils.format_asset(
                                op[1].common_options.max_market_fee,
                                op[1]
                            )}
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.common_options"
                            />
                        </td>
                        <td>
                            <Inspector data={op[1]} search={false} />
                        </td>
                    </tr>
                );

                break;
            }

            case "asset_update":
            case "asset_update_bitasset": {
                console.log("op:", op);
                color = "warning";

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.asset_update"
                            />
                        </td>
                        <td>{linkToAsset(op[1].asset_to_update)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.assets.issuer"
                            />
                        </td>
                        <td>{linkToAccount(op[1].issuer)}</td>
                    </tr>
                );
                if (op[1].new_issuer !== op[1].issuer) {
                    rows.push(
                        <tr key={key++}>
                            <td>
                                <Translate
                                    component="span"
                                    content="account.user_issued_assets.new_issuer"
                                />
                            </td>
                            <td>{linkToAccount(op[1].new_issuer)}</td>
                        </tr>
                    );
                }
                if (op[1].new_options.core_exchange_rate) {
                    rows.push(
                        <tr key={key++}>
                            <td>
                                <Translate
                                    component="span"
                                    content="markets.core_rate"
                                />
                            </td>
                            <td>
                                <FormattedPrice
                                    base_asset={
                                        op[1].new_options.core_exchange_rate
                                            .base.asset_id
                                    }
                                    quote_asset={
                                        op[1].new_options.core_exchange_rate
                                            .quote.asset_id
                                    }
                                    base_amount={
                                        op[1].new_options.core_exchange_rate
                                            .base.amount
                                    }
                                    quote_amount={
                                        op[1].new_options.core_exchange_rate
                                            .quote.amount
                                    }
                                    noPopOver
                                />
                            </td>
                        </tr>
                    );
                }

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.new_options"
                            />
                        </td>
                        <td>
                            <Inspector
                                data={op[1].new_options}
                                search={false}
                            />
                        </td>
                    </tr>
                );

                break;
            }

            case "asset_update_feed_producers": {
                color = "warning";
                console.log("op:", op);
                const producers: React.ReactNode[] = [];
                op[1].new_feed_producers.forEach((producer: string) => {
                    producers.push(
                        <div key={producer}>
                            {linkToAccount(producer)}
                            <br />
                        </div>
                    );
                });

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.asset_update"
                            />
                        </td>
                        <td>{linkToAsset(op[1].asset_to_update)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.new_producers"
                            />
                        </td>
                        <td>{producers}</td>
                    </tr>
                );

                break;
            }

            case "asset_issue": {
                color = "warning";

                if (op[1].memo) {
                    const {text, isMine} = (PrivateKeyStore as any).decodeMemo(
                        op[1].memo
                    );

                    memo = text ? (
                        <td>{text}</td>
                    ) : !text && isMine ? (
                        <td>
                            <Translate content="transfer.memo_unlock" />
                            &nbsp;
                            <a onClick={toggleLock}>
                                <Icon
                                    name="locked"
                                    title="icons.locked.action"
                                />
                            </a>
                        </td>
                    ) : null;
                }

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.assets.issuer"
                            />
                        </td>
                        <td>{linkToAccount(op[1].issuer)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.asset_issue"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                style={{fontWeight: "bold"}}
                                amount={op[1].asset_to_issue.amount}
                                asset={op[1].asset_to_issue.asset_id}
                            />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="transfer.to" />
                        </td>
                        <td>{linkToAccount(op[1].issue_to_account)}</td>
                    </tr>
                );

                if (memo) {
                    rows.push(
                        <tr key={key++}>
                            <td>
                                <Translate content="transfer.memo" />
                            </td>
                            {memo}
                        </tr>
                    );
                }

                break;
            }

            case "asset_burn": {
                color = "cancel";

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.account.title"
                            />
                        </td>
                        <td>{linkToAccount(op[1].payer)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transfer.amount"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].amount_to_burn.amount}
                                asset={op[1].amount_to_burn.asset_id}
                            />
                        </td>
                    </tr>
                );

                break;
            }

            case "asset_fund_fee_pool": {
                color = "warning";
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.account.title"
                            />
                        </td>
                        <td>{linkToAccount(op[1].from_account)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.asset.title"
                            />
                        </td>
                        <td>{linkToAsset(op[1].asset_id)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transfer.amount"
                            />
                        </td>
                        <td>
                            <FormattedAsset amount={op[1].amount} asset="1.3.0" />
                        </td>
                    </tr>
                );

                break;
            }

            case "asset_settle": {
                color = "warning";

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.account.title"
                            />
                        </td>
                        <td>{linkToAccount(op[1].account)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.asset.title"
                            />
                        </td>
                        <td>{linkToAsset(op[1].amount.asset_id)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transfer.amount"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].amount.amount}
                                asset={op[1].amount.asset_id}
                            />
                        </td>
                    </tr>
                );

                break;
            }

            case "asset_publish_feed": {
                color = "warning";
                const {feed} = op[1];

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.publisher"
                            />
                        </td>
                        <td>{linkToAccount(op[1].publisher)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.asset.title"
                            />
                        </td>
                        <td>{linkToAsset(op[1].asset_id)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.asset.price_feed.maximum_short_squeeze_ratio"
                            />
                        </td>
                        <td>
                            {(feed.maximum_short_squeeze_ratio / 1000).toFixed(
                                2
                            )}
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.asset.price_feed.maintenance_collateral_ratio"
                            />
                        </td>
                        <td>
                            {(
                                feed.maintenance_collateral_ratio / 1000
                            ).toFixed(2)}
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="markets.core_rate"
                            />
                        </td>
                        <td>
                            <FormattedPrice
                                base_asset={feed.core_exchange_rate.base.asset_id}
                                quote_asset={
                                    feed.core_exchange_rate.quote.asset_id
                                }
                                base_amount={feed.core_exchange_rate.base.amount}
                                quote_amount={
                                    feed.core_exchange_rate.quote.amount
                                }
                                noPopOver
                            />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.feed_price"
                            />
                        </td>
                        <td>
                            <FormattedPrice
                                base_asset={
                                    (asset_utils as any).extractRawFeedPrice(
                                        feed
                                    ).base.asset_id
                                }
                                quote_asset={
                                    (asset_utils as any).extractRawFeedPrice(
                                        feed
                                    ).quote.asset_id
                                }
                                base_amount={
                                    (asset_utils as any).extractRawFeedPrice(
                                        feed
                                    ).base.amount
                                }
                                quote_amount={
                                    (asset_utils as any).extractRawFeedPrice(
                                        feed
                                    ).quote.amount
                                }
                                noPopOver
                            />
                        </td>
                    </tr>
                );

                break;
            }

            case "committee_member_create": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.committee_member.title"
                            />
                        </td>
                        <td>
                            {linkToAccount(op[1].committee_member_account)}
                        </td>
                    </tr>
                );

                break;
            }

            case "witness_create": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.witness"
                            />
                        </td>
                        <td>{linkToAccount(op[1].witness_account)}</td>
                    </tr>
                );

                break;
            }

            case "witness_update": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.block.witness"
                            />
                        </td>
                        <td>{linkToAccount(op[1].witness_account)}</td>
                    </tr>
                );

                if (op[1].new_url) {
                    rows.push(
                        <tr key={key++}>
                            <td>
                                <Translate
                                    component="span"
                                    content="transaction.new_url"
                                />
                            </td>
                            <td>
                                <a
                                    href={op[1].new_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {op[1].new_url}
                                </a>
                            </td>
                        </tr>
                    );
                }

                break;
            }

            case "balance_claim": {
                color = "success";

                const bal_id = op[1].balance_to_claim.substring(5);

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.claimed"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].total_claimed.amount}
                                asset={op[1].total_claimed.asset_id}
                            />
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.deposit_to"
                            />
                        </td>
                        <td>{linkToAccount(op[1].deposit_to_account)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.balance_id"
                            />
                        </td>
                        <td>#{bal_id}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.balance_owner"
                            />
                        </td>
                        <td style={{fontSize: "80%"}}>
                            {op[1].balance_owner_key.substring(0, 10)}
                            ...
                        </td>
                    </tr>
                );
                break;
            }

            case "vesting_balance_withdraw": {
                color = "success";

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="transfer.to" />
                        </td>
                        <td>{linkToAccount(op[1].owner)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transfer.amount"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].amount.amount}
                                asset={op[1].amount.asset_id}
                            />
                        </td>
                    </tr>
                );

                break;
            }

            case "transfer_to_blind": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="transfer.from" />
                        </td>
                        <td>{linkToAccount(op[1].from)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transfer.amount"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].amount.amount}
                                asset={op[1].amount.asset_id}
                            />
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.blinding_factor"
                            />
                        </td>
                        <td style={{fontSize: "80%"}}>
                            {op[1].blinding_factor}
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.outputs"
                            />
                        </td>
                        <td>
                            <Inspector data={op[1].outputs[0]} search={false} />
                        </td>
                    </tr>
                );
                break;
            }

            case "transfer_from_blind": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="transfer.to" />
                        </td>
                        <td>{linkToAccount(op[1].to)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transfer.amount"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].amount.amount}
                                asset={op[1].amount.asset_id}
                            />
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.blinding_factor"
                            />
                        </td>
                        <td style={{fontSize: "80%"}}>
                            {op[1].blinding_factor}
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.inputs"
                            />
                        </td>
                        <td>
                            <Inspector data={op[1].inputs[0]} search={false} />
                        </td>
                    </tr>
                );
                break;
            }

            case "blind_transfer": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.inputs"
                            />
                        </td>
                        <td>
                            <Inspector data={op[1].inputs[0]} search={false} />
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.outputs"
                            />
                        </td>
                        <td>
                            <Inspector data={op[1].outputs[0]} search={false} />
                        </td>
                    </tr>
                );
                break;
            }

            case "proposal_create": {
                const expiration_date = new Date(op[1].expiration_time + "Z");
                const has_review_period =
                    op[1].review_period_seconds !== undefined;
                const review_begin_time = !has_review_period
                    ? null
                    : expiration_date.getTime() -
                      op[1].review_period_seconds * 1000;
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="proposal_create.review_period"
                            />
                        </td>
                        <td>
                            {has_review_period ? (
                                <FormattedDate
                                    value={new Date(review_begin_time as number)}
                                    format="full"
                                />
                            ) : (
                                <span>&mdash;</span>
                            )}
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="proposal_create.expiration_time"
                            />
                        </td>
                        <td>
                            <FormattedDate value={expiration_date} format="full" />
                        </td>
                    </tr>
                );

                const proposalsText = op[1].proposed_ops.map(
                    (o: any, opIdx: number) => {
                        return (
                            <ProposedOperation
                                key={opIdx}
                                index={opIdx}
                                op={o.op}
                                inverted={false}
                                hideFee={true}
                                hideOpLabel={true}
                                hideDate={true}
                                proposal={true}
                                collapsed={true}
                            />
                        );
                    }
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="proposal_create.proposed_operations"
                            />
                        </td>
                        <td>{proposalsText}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="proposal_create.fee_paying_account"
                            />
                        </td>
                        <td>{linkToAccount(op[1].fee_paying_account)}</td>
                    </tr>
                );
                break;
            }

            case "proposal_update": {
                const fields = [
                    "active_approvals_to_add",
                    "active_approvals_to_remove",
                    "owner_approvals_to_add",
                    "owner_approvals_to_remove",
                    "key_approvals_to_add",
                    "key_approvals_to_remove"
                ];

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="proposal_create.fee_paying_account"
                            />
                        </td>
                        <td>{linkToAccount(op[1].fee_paying_account)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="proposal_create.id"
                            />
                        </td>
                        <td>{op[1].proposal}</td>
                    </tr>
                );

                fields.forEach(field => {
                    if (op[1][field].length) {
                        rows.push(
                            <tr key={key++}>
                                <td>
                                    <Translate
                                        content={`proposal.update.${field}`}
                                    />
                                </td>
                                <td>
                                    {op[1][field].map((value: string) => {
                                        return (
                                            <div key={value}>
                                                {linkToAccount(value)}
                                            </div>
                                        );
                                    })}
                                </td>
                            </tr>
                        );
                    }
                });

                break;
            }

            case "proposal_delete": {
                color = "cancel";
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="proposal_create.fee_paying_account"
                            />
                        </td>
                        <td>{linkToAccount(op[1].fee_paying_account)}</td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="proposal_delete.using_owner_authority"
                            />
                        </td>
                        <td>
                            <TranslateBoolean
                                value={op[1].using_owner_authority}
                            />
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="proposal_create.id"
                            />
                        </td>
                        <td>{op[1].proposal}</td>
                    </tr>
                );
                break;
            }

            case "asset_claim_fees": {
                color = "success";

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.claimed"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].amount_to_claim.amount}
                                asset={op[1].amount_to_claim.asset_id}
                            />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transaction.deposit_to"
                            />
                        </td>
                        <td>{linkToAccount(op[1].issuer)}</td>
                    </tr>
                );

                break;
            }

            case "asset_reserve": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="modal.reserve.from"
                            />
                        </td>
                        <td>{linkToAccount(op[1].payer)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.asset.title"
                            />
                        </td>
                        <td>{linkToAsset(op[1].amount_to_reserve.asset_id)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transfer.amount"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].amount_to_reserve.amount}
                                asset={op[1].amount_to_reserve.asset_id}
                            />
                        </td>
                    </tr>
                );
                break;
            }

            case "worker_create": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.workers.title"
                            />
                        </td>
                        <td>{op[1].name}</td>
                    </tr>
                );

                const startDate = counterpart.localize(
                    new Date(op[1].work_begin_date),
                    {type: "date"}
                );
                const endDate = counterpart.localize(
                    new Date(op[1].work_end_date),
                    {type: "date"}
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.workers.period"
                            />
                        </td>
                        <td>
                            {startDate} - {endDate}
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.workers.daily_pay"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].daily_pay}
                                asset="1.3.0"
                            />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.workers.website"
                            />
                        </td>
                        <td>{utils.sanitize(op[1].url)}</td>
                    </tr>
                );

                if (op[1].initializer[1]) {
                    rows.push(
                        <tr key={key++}>
                            <td>
                                <Translate
                                    component="span"
                                    content="explorer.workers.vesting_pay"
                                />
                            </td>
                            <td>
                                {op[1].initializer[1].pay_vesting_period_days}
                            </td>
                        </tr>
                    );
                }

                break;
            }

            case "asset_claim_pool": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="account.name" />
                        </td>
                        <td>
                            <LinkToAccountById account={op[1].issuer} />
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.asset.title"
                            />
                        </td>
                        <td>
                            <LinkToAssetById asset={op[1].asset_id} />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transfer.amount"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].amount_to_claim.amount}
                                asset={op[1].amount_to_claim.asset_id}
                            />
                        </td>
                    </tr>
                );
                break;
            }

            case "asset_update_issuer": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="transfer.from" />
                        </td>
                        <td>
                            <LinkToAccountById account={op[1].issuer} />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="transfer.to" />
                        </td>
                        <td>
                            <LinkToAccountById account={op[1].new_issuer} />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.asset.title"
                            />
                        </td>
                        <td>
                            <LinkToAssetById asset={op[1].asset_to_update} />
                        </td>
                    </tr>
                );

                break;
            }

            case "bid_collateral": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.account.title"
                            />
                        </td>
                        <td>
                            <LinkToAccountById account={op[1].bidder} />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.asset.collateral_bid.collateral"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                asset={op[1].additional_collateral.asset_id}
                                amount={op[1].additional_collateral.amount}
                            />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="explorer.asset.collateral_bid.debt"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                asset={op[1].debt_covered.asset_id}
                                amount={op[1].debt_covered.amount}
                            />
                        </td>
                    </tr>
                );

                break;
            }
            case "htlc_create": {
                // add claim period to block time
                const block_time = block
                    ? block.timestamp.getTime()
                    : new Date().getTime();
                const claim_due = new Date(
                    block_time + op[1].claim_period_seconds * 1000
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="transfer.from" />
                        </td>
                        <td>
                            <LinkToAccountById account={op[1].from} />
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="transfer.to" />
                        </td>
                        <td>
                            <LinkToAccountById account={op[1].to} />
                        </td>
                    </tr>
                );
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="transfer.amount"
                            />
                        </td>
                        <td>
                            <FormattedAsset
                                amount={op[1].amount.amount}
                                asset={op[1].amount.asset_id}
                            />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="htlc.claim_period_due"
                            />
                        </td>
                        <td>
                            <FormattedDate value={claim_due} format="full" />
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="htlc.preimage_hash"
                            />
                        </td>
                        <td>
                            <Tooltip
                                placement="bottom"
                                title={counterpart.translate(
                                    "htlc.preimage_hash_explanation"
                                )}
                            >
                                <span>
                                    {"(" +
                                        op[1].preimage_size +
                                        ", " +
                                        op[1].preimage_hash[0] +
                                        "): " +
                                        op[1].preimage_hash[1]}
                                </span>
                            </Tooltip>
                        </td>
                    </tr>
                );

                break;
            }
            case "htlc_redeem": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="htlc.id" />
                        </td>
                        <td>
                            <span>{op[1].htlc_id}</span>
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="htlc.redeemer"
                            />
                        </td>
                        <td>{linkToAccount(op[1].redeemer)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="htlc.preimage"
                            />
                        </td>
                        <td>{linkToAccount(op[1].preimage)}</td>
                    </tr>
                );

                break;
            }
            case "htlc_extend": {
                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="htlc.id" />
                        </td>
                        <td>
                            <span>{op[1].htlc_id}</span>
                        </td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="htlc.update_issuer"
                            />
                        </td>
                        <td>{linkToAccount(op[1].update_issuer)}</td>
                    </tr>
                );

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate
                                component="span"
                                content="htlc.seconds_to_add"
                            />
                        </td>
                        <td>
                            <span>{op[1].seconds_to_add}</span>
                        </td>
                    </tr>
                );

                break;
            }
            default:
                console.log("unimplemented tx op:", op);

                rows.push(
                    <tr key={key++}>
                        <td>
                            <Translate component="span" content="explorer.block.op" />
                        </td>
                        <td>
                            <Inspector data={op} search={false} />
                        </td>
                    </tr>
                );
                break;
        }

        info.push(
            <OperationTable
                txIndex={index}
                key={opIndex}
                color={color}
                operation={op}
            >
                {rows}
            </OperationTable>
        );
    });

    return <div>{info}</div>;
}
