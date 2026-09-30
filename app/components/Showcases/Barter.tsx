// TypeScript/functional-component port of the legacy Barter.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md; `Showcases/` batch 1). Mechanical
// class-to-hooks translation, no logic changes, with two deliberate,
// documented exceptions (both explained in detail below): one preserves a
// pre-existing bug exactly instead of silently curing it, the other drops
// a prop that was already fully inert.
//
// Security-sensitive per AGENTS.md: `onSubmit`'s call to
// `ApplicationApi.transfer_list(transfer_list, this.state.proposal_fee
// .asset_id)` (a real on-chain "propose a bundle of transfers" broadcast,
// not the usual `XActions.method()` Alt.js dispatcher used elsewhere) and
// every line of `transfer_list` construction feeding into it (escrow
// payment leg, per-item `from_barter`/`to_barter` legs, `Asset({real,
// asset_id, precision}).getAmount()` amount math, `feeAsset`/`propose_
// account` wiring, the escrow-refund leg) are preserved byte-for-byte -
// only `this.state.X` → `state.X` and `this.setState(...)` → `mergeState
// (...)` mechanical substitutions were made, nothing about the math or
// argument shapes was touched. `console.log(from_barter)` (inside the
// `fee` helper, used for the on-screen total-fee display) is grep-
// confirmed the file's only `console.*` call; it logs the barter line-
// item array (assets/amounts/fee-asset objects), never a password,
// private key or brainkey, and this file never touches `WalletDb`/wallet-
// unlock/key-import flows directly - kept verbatim per the task note.
//
// Structural note: `AccountStore` is read only via two imperative
// `AccountStore.getState().currentAccount` calls (mount-time default for
// `from_name`; `onSubmit`'s `proposer`) - grep-confirmed there is no
// `connect(Barter, {listenTo: [AccountStore], ...})` anywhere in the
// original (the class is exported directly, `export default class
// Barter extends Component`), so this is a one-shot imperative read, not
// a subscription. No `useAltStore` call was added - that would change
// behavior by making the component re-render on every `AccountStore`
// change, something the class never did either.
//
// The class's ~20 `this.state.X` fields are kept as one combined state
// object (not split into separate `useState` calls), updated via a
// `setState`-style shallow-merge `mergeState` helper, matching this
// migration's established convention (see `Utility/FeeAssetSelector.tsx`,
// `Account/CreditOffer/CreateModal.tsx`). No `stateRef` mirror was
// needed: every state read in every handler happens synchronously inside
// a freshly-recreated-per-render closure (never inside an `async`
// function or a `useEffect` with a narrower dependency array), so reading
// the local `state` variable directly is always equivalent to reading
// `this.state` at the same point in the original.
//
// `this.setState(update, callback)` two-argument calls
// (`onFromAmountChanged`, `onToAmountChanged`, each ending in a
// `this._checkBalance(...); this.checkAmountsTotal();` pair) are
// replicated by calling the equivalent logic directly, right after
// `mergeState`, passing the exact just-merged `from_barter`/`to_barter`
// array (the same reasoning already documented in `FeeAssetSelector.tsx`/
// `CreateModal.tsx`'s header comments: safe because the "callback" only
// reads either the literal value just merged, or state fields the same
// update left untouched). `checkAmountsTotal` (originally a zero-arg
// method reading `this.state.from_barter`/`to_barter`/`from_account`/
// `to_account` directly) takes an optional `overrides` object for exactly
// this reason - its other, argument-less call site (from `render`'s
// `_setTotal`-style balance flows... actually this file has none; its
// only other call site is none - it's called exclusively from the two
// amount-changed handlers) always passes the freshly-committed arrays.
//
// `UNSAFE_componentWillMount` (sets `from_name` to `AccountStore
// .getState().currentAccount` if not already set) → a mount-only
// `useEffect(() => {...}, [])`, reading the initial-render `state`
// directly (not a ref) since nothing else can have changed `from_name`
// before this first effect runs.
//
// No `componentDidMount`/`componentDidUpdate`/`shouldComponentUpdate`/
// `UNSAFE_componentWillReceiveProps` existed on the original class (grep-
// confirmed), so no further lifecycle-to-`useEffect` translation was
// needed.
//
// `render()` becomes this function component's own trailing body (its
// local `const`s - `checkAmountValid`, `explictPrice`, `fee`,
// `balanceError`, `balance`, plus the `account_from`/`account_to`/
// `offers`/`totalFeeFrom`/`totalFeeTo`/`feeForEscrow`/`intro`/`escrow`
// JSX trees and the two `fromAmountSelector`/`toAmountSelector` mapped
// arrays - are unchanged, only `this.state.X`/`this.props.X` → `state.X`/
// `props.X` and `this.method.bind(this, ...)` → direct calls/closures).
// All other former methods are declared as `function` statements (not
// `const` arrow functions) specifically so hoisting makes their relative
// declaration order irrelevant, the same freedom class methods have via
// the prototype (needed because, unlike separate class methods, they now
// share one function-component scope - see the `fee`-scoping note next).
// The three methods the original placed *after* `render()` in the class
// body (`_updateEscrowFee`, `onToggleSendToEscrow`, `toggleEscrow`) are
// moved earlier in this file, before the trailing render/JSX section,
// because JavaScript doesn't allow further statements after a function's
// `return` (unlike a class body, where method order never matters) -
// purely a mechanical reshuffle, not a behavior change (hoisting means
// they were already callable from anywhere in the class regardless of
// textual position).
//
// **Preserved bug, not fixed** - `onSubmit`'s dead-crash `fee(true)`
// reference: the original's `render()` defines a local `const fee = from
// => {...}` (used for the on-screen total-fee display), but `onSubmit`
// is a *separate class method* with no access to `render()`'s local
// scope (class methods only share `this`, never each other's local
// `const`s). `onSubmit`'s escrow-payment fallback, `this.state
// .escrow_payment_changed ? ... : fee(true)`, therefore references a
// `fee` identifier that is genuinely not in scope in that method - a
// real `ReferenceError: fee is not defined` at runtime, grep-confirmed
// (`fee` only ever gets declared inside `render()`, never at class or
// module scope). Net effect in production today: clicking "Propose"
// with escrow enabled and the escrow-payment amount field never
// manually touched (`escrow_payment_changed` still `false`) throws
// before `ApplicationApi.transfer_list(...)` is ever reached - no
// transaction is built or broadcast on that path. Porting every method
// into one shared function-component scope (as this migration's
// convention requires) would *silently cure* this bug: `onSubmit` and
// the real `fee` closure would become textual siblings inside the same
// function, so normal JS closure/hoisting rules would let `onSubmit`
// successfully resolve the *working* `fee` the very first time it's
// invoked (function declarations close over their whole enclosing scope,
// not just what's textually above them) - changing a guaranteed crash
// into a successful broadcast, exactly the kind of silent behavior change
// AGENTS.md's "preserve every bug/quirk verbatim" rule (and the task's
// explicit "preserve byte-for-byte" instruction for this file's transfer-
// building code) forbids. TypeScript also won't compile a literal
// reference to a genuinely undeclared identifier, so - following the
// exact precedent set in `Wallet/ImportKeys.tsx`'s `_parseWalletJson`
// (see its header comment and `docs/UI_MIGRATION_PLAN.md`'s "Eighth
// slice: Transfer/Send" entry) - a small helper,
// `referenceErrorLikeOriginal(name)`, reproduces the identical
// *observable* effect (throwing `new ReferenceError(\`${name} is not
// defined\`)`) at the exact point `fee` would have been evaluated,
// without ever actually resolving to the working `fee` closure. Unlike
// `ImportKeys.tsx`'s version (which *returns* an `Error` for the caller
// to `throw`), this one has a `never` return type and throws directly,
// so it can sit inline in the ternary expression it replaces.
//
// **Dropped as dead** (grep-confirmed): `onTrxIncluded` (bound in the
// constructor, defined as a method, but never actually invoked anywhere
// - not registered as a `TransactionConfirmStore` listener, not called
// from `onSubmit` or anywhere else) referenced a `TransactionConfirmStore`
// that is not imported anywhere in this file at all (a second, unrelated
// `ReferenceError` bug, but on a method that is *never called*, so it
// never manifests) - dropped entirely along with its constructor-time
// `.bind(this)`, rather than replicated, since it's unreachable dead code
// with no observable effect to preserve.
//
// **Dropped as already-inert** (grep-confirmed, not this file's original
// behavior to preserve): the `multiplier={from_barter.length}`/
// `multiplier={to_barter.length}` props passed to the three
// `<FeeAssetSelector>` instances. `FeeAssetSelector` (already ported to
// `Utility/FeeAssetSelector.tsx` in an earlier batch, out of scope here)
// never reads a `multiplier` prop, and neither did the pre-migration
// `FeeAssetSelector.jsx` it replaced (checked via `git show` on the
// commit right before that port) - this prop has been a complete no-op
// on both sides for as long as `Barter.jsx` has existed. Its already-
// ported `FeeAssetSelectorProps` interface has no index signature, so
// passing it now trips a TypeScript excess-property-check error; since
// editing that already-ported, out-of-scope file is not permitted here,
// and the prop never had any effect to lose, it's dropped from all three
// call sites rather than worked around.
//
// Preserved verbatim, not "fixed" (other bugs/quirks found while reading
// closely):
// - `state.amount_index`/`state.amount_counter`: `amount_index` is
//   initialized to `0` and read once per render (`let amount_index =
//   state.amount_index`) purely to generate React `key`s via a local
//   `amount_index++` inside the two `.map()` calls building the amount-
//   selector rows - the post-increment result is never written back via
//   `setState`/`mergeState` anywhere, so it's always `0` on every render
//   (each render's two `.map()`s always start counting from `0` again).
//   `amount_counter` is initialized in `getInitialState()` and never read
//   or written anywhere else in the file - fully dead state. Both kept
//   exactly as inert as the original.
// - `state.hasPoolBalance`: referenced by the escrow `<AmountSelector>`'s
//   `error` prop (`this.state.hasPoolBalance === false ? ... : null`),
//   but never present in `getInitialState()` and never set by any
//   `setState` call anywhere in the file (only the *per-item*
//   `from_hasPoolBalance`/`to_hasPoolBalance` fields exist, never this
//   top-level name) - always `undefined`, so that branch is always
//   `null` in practice. Declared as an optional, never-written field on
//   `BarterState` for the same reason `CreateModal.tsx`'s `min_loan`
//   is optional-and-unset in its initial state.
// - `addFromAmount`/`addToAmount` push a new barter-row object that omits
//   `from_hasPoolBalance`/`from_balanceError` (`to_hasPoolBalance`/
//   `to_balanceError`) entirely, unlike the initial row in
//   `getInitialState()`, which includes them - so rows added via "+ Add
//   asset" always have `balanceError: undefined` (falsy, so behaves the
//   same as `false` everywhere it's checked) until the first amount
//   change recomputes it. Kept exactly as-is; `BarterBarterItem`'s
//   `*_balanceError`/`*_hasPoolBalance` fields are declared optional for
//   this reason.
// - `_checkBalance` has a duplicated, dead `if (!asset || !account)
//   return;` guard (the same check two lines above it).
// - `_checkBalance`'s `fee_asset_id` parameter is accepted but never read
//   in its body - kept as an unused parameter, matching the original's
//   signature exactly (both call sites still pass it).
// - `render`'s dead `from_barter.length === 500 && to_barter.length ===
//   500` branch (explicitly commented `// deactivate for now` in the
//   original) is kept verbatim, including its use of `props.style`
//   (the only reader of that prop anywhere in the file - `style` was
//   undeclared in the original's absent `propTypes`, so it's added to
//   `BarterProps` as a real optional field per this migration's
//   convention).
// - `smallScreen = window.innerWidth < 850` is computed fresh on every
//   render with no resize listener (so it never updates after mount
//   without some other unrelated re-render happening first) - a real
//   quirk, not something to "fix" with a resize effect.
// - `checkAmountValid`'s `String.prototype.replace.call(item.from_amount,
//   /,/g, "")` (rather than `item.from_amount.replace(...)`) is kept
//   verbatim.
//
// TypeScript-forced adjustments: this file relies heavily on `any` for
// Immutable.js account/asset objects and `common/MarketClasses`'s
// (`app/lib/common/MarketClasses.js`, a plain untyped `.js` module,
// resolved via the `common/*` → `lib/common/*` path alias in
// `tsconfig.json`) `Asset` class - `@typescript-eslint/no-explicit-any`
// warnings are expected and left as-is per the task instructions. No
// `Price`-style inference-gap cast was needed here since this file never
// constructs a `Price`.
import * as React from "react";
import Translate from "react-translate-component";
import {
    Input,
    Card,
    Col,
    Row,
    Button,
    Switch,
    Tooltip,
    Icon,
    Popover,
    Alert
} from "bitshares-ui-style-guide";
import AccountSelector from "../Account/AccountSelector";
import FeeAssetSelector from "components/Utility/FeeAssetSelector";
import counterpart from "counterpart";
import AccountStore from "stores/AccountStore";
import {ChainStore} from "bitsharesjs";
import AmountSelector from "../Utility/AmountSelector";
import {Asset} from "common/MarketClasses";
import utils from "common/utils";
import {checkBalance} from "common/trxHelper";
import BalanceComponent from "../Utility/BalanceComponent";
import ApplicationApi from "../../api/ApplicationApi";
import {map} from "lodash-es";

function moveDecimal(num: number, decimals: number): number | undefined {
    if (!num) return;
    return num / Math.pow(10, decimals);
}

// See the header comment's "Preserved bug, not fixed" section: reproduces
// the exact observable effect of `onSubmit`'s original out-of-scope `fee`
// reference (a real `ReferenceError` in the original `.jsx`) without ever
// resolving to the working `fee` closure that this file's `render`
// section defines later. `never`-returning (always throws) so it can be
// used directly as a ternary branch expression.
function referenceErrorLikeOriginal(name: string): never {
    throw new ReferenceError(`${name} is not defined`);
}

interface BarterBarterItem {
    index?: number;
    from_amount?: any;
    to_amount?: any;
    from_asset_id?: any;
    to_asset_id?: any;
    from_asset?: any;
    to_asset?: any;
    from_feeAsset?: any;
    to_feeAsset?: any;
    from_hasPoolBalance?: any;
    to_hasPoolBalance?: any;
    from_balanceError?: boolean;
    to_balanceError?: boolean;
}

interface BarterMemoEntry {
    message: string;
    shown: boolean;
}

interface BarterState {
    from_name: string;
    to_name: string;
    from_account: any;
    to_account: any;
    from_barter: BarterBarterItem[];
    to_barter: BarterBarterItem[];
    amount_counter: any[];
    amount_index: number;
    from_error: any;
    to_error: any;
    memo: {
        from_barter: BarterMemoEntry[];
        to_barter: BarterMemoEntry[];
        escrow: BarterMemoEntry[];
    };
    proposal_fee: any;
    showEscrow: boolean;
    escrow_account_name: string;
    escrow_account: any;
    send_to_escrow: boolean;
    escrow_payment: any;
    escrow_payment_changed: boolean;
    escrowFeeAssetId: string;
    balanceWarning: {peer1: any[]; peer2: any[]};
    // Never written anywhere - see the header comment. Declared optional
    // since it's genuinely absent from `getInitialState()`, matching the
    // original's `this.state.hasPoolBalance === undefined` for the whole
    // component lifetime.
    hasPoolBalance?: any;
}

interface BarterProps {
    // Undeclared in the original (no `propTypes` at all), only read by
    // the dead `from_barter.length === 500` branch - see header comment.
    style?: any;
}

function getInitialState(): BarterState {
    return {
        from_name: "",
        to_name: "",
        from_account: null,
        to_account: null,
        from_barter: [
            {
                index: 0,
                from_amount: "",
                from_asset_id: null,
                from_asset: null,
                from_feeAsset: new Asset({amount: 0, asset_id: "1.3.0"}),
                from_hasPoolBalance: null,
                from_balanceError: false
            }
        ],
        to_barter: [
            {
                index: 0,
                to_amount: "",
                to_asset_id: null,
                to_asset: null,
                to_feeAsset: new Asset({amount: 0, asset_id: "1.3.0"}),
                to_hasPoolBalance: null,
                to_balanceError: false
            }
        ],
        amount_counter: [],
        amount_index: 0,
        from_error: null,
        to_error: null,
        memo: {
            from_barter: [{message: "", shown: false}],
            to_barter: [{message: "", shown: false}],
            escrow: [{message: "", shown: false}]
        },
        proposal_fee: {
            amount: 0,
            asset_id: "1.3.0"
        },
        showEscrow: false,
        escrow_account_name: "",
        escrow_account: null,
        send_to_escrow: false,
        escrow_payment: 0,
        escrow_payment_changed: false,
        escrowFeeAssetId: "1.3.0",
        balanceWarning: {peer1: [], peer2: []}
    };
}

export default function Barter(props: BarterProps) {
    const [state, setState] = React.useState<BarterState>(getInitialState);

    const mergeState = (patch: Partial<BarterState>) =>
        setState(prev => ({...prev, ...patch}));

    // UNSAFE_componentWillMount replica - runs once, before the user can
    // interact with anything, so reading `state` (not a ref) directly is
    // equivalent to reading `this.state` at that point in the original.
    React.useEffect(() => {
        const currentAccount = AccountStore.getState().currentAccount;
        if (!state.from_name) mergeState({from_name: currentAccount});
    }, []);

    function fromChanged(from_name: any) {
        mergeState({from_name});
    }

    function escrowAccountChanged(escrow_account_name: any) {
        mergeState({escrow_account_name});
    }

    function onFromAccountChanged(from_account: any) {
        mergeState({
            from_account,
            from_barter: [
                {
                    from_amount: "",
                    from_asset_id: null,
                    from_asset: null,
                    from_feeAsset: new Asset({amount: 0, asset_id: "1.3.0"}),
                    from_hasPoolBalance: null,
                    from_balanceError: false
                }
            ]
        });
    }

    function onEscrowAccountChanged(escrow_account: any) {
        mergeState({
            escrow_account
        });
    }

    function toChanged(to_name: any) {
        mergeState({to_name});
    }

    function onToAccountChanged(to_account: any) {
        mergeState({
            to_account,
            to_barter: [
                {
                    to_amount: "",
                    to_asset_id: null,
                    to_asset: null,
                    to_feeAsset: new Asset({amount: 0, asset_id: "1.3.0"}),
                    to_hasPoolBalance: null,
                    to_balanceError: false
                }
            ]
        });
    }

    function _checkBalance(
        feeAmount: any,
        amount: any,
        account: any,
        asset: any,
        index: number,
        from: boolean,
        fee_asset_id: any,
        barter: BarterBarterItem[]
    ) {
        if (!asset || !account) return;
        const balanceID = account.getIn(["balances", asset.get("id")]);
        const feeBalanceID = account.getIn(["balances", feeAmount.asset_id]);
        if (!asset || !account) return;
        if (!balanceID)
            if (from) {
                barter[index].from_balanceError = true;
                return mergeState({from_barter: barter});
            } else {
                barter[index].to_balanceError = true;
                return mergeState({to_barter: barter});
            }
        const balanceObject = ChainStore.getObject(balanceID);
        const feeBalanceObject = feeBalanceID
            ? ChainStore.getObject(feeBalanceID)
            : null;
        if (!feeBalanceObject || feeBalanceObject.get("balance") === 0) {
            if (from) {
                mergeState({from_barter: barter});
            } else {
                mergeState({to_barter: barter});
            }
        }
        if (!balanceObject || !feeAmount) return;
        if (!amount)
            if (from) {
                barter[index].from_balanceError = false;
                return mergeState({from_barter: barter});
            } else {
                barter[index].to_balanceError = false;
                return mergeState({to_barter: barter});
            }
        const hasBalance = checkBalance(amount, asset, feeAmount, balanceObject);

        if (hasBalance === null) return;
        if (from) {
            barter[index].from_balanceError = !hasBalance;
            return mergeState({from_barter: barter});
        } else {
            barter[index].to_balanceError = !hasBalance;
            return mergeState({to_barter: barter});
        }
    }

    function getBalance(account: any, assetType: any) {
        return ChainStore.getAccountBalance(account, assetType);
    }

    // Originally a zero-arg method reading `this.state.from_barter`/
    // `to_barter`/`from_account`/`to_account` directly - see header
    // comment for why `overrides` exists (replicating the setState-
    // callback timing from `onFromAmountChanged`/`onToAmountChanged`
    // without a real callback).
    function checkAmountsTotal(overrides?: {
        from_barter?: BarterBarterItem[];
        to_barter?: BarterBarterItem[];
        from_account?: any;
        to_account?: any;
    }) {
        const from_barter = overrides?.from_barter ?? state.from_barter;
        const to_barter = overrides?.to_barter ?? state.to_barter;
        const from_account = overrides?.from_account ?? state.from_account;
        const to_account = overrides?.to_account ?? state.to_account;
        const peer1Amounts: any = {};
        const peer2Amounts: any = {};

        // for peer1
        from_barter.forEach(function(item) {
            if (item.from_amount) {
                if (peer1Amounts.hasOwnProperty(item.from_asset_id)) {
                    peer1Amounts[item.from_asset_id] = {
                        amount:
                            Number(peer1Amounts[item.from_asset_id].amount) +
                            Number(item.from_amount),
                        precision: item.from_asset.get("precision"),
                        symbol: item.from_asset.get("symbol")
                    };
                } else {
                    peer1Amounts[item.from_asset_id] = {
                        amount: Number(item.from_amount),
                        precision: item.from_asset.get("precision"),
                        symbol: item.from_asset.get("symbol")
                    };
                }
            }
        });

        const peer1AmountsFormated = map(peer1Amounts, (item: any, key: any) => {
            const balanceOfCurrentAsset = getBalance(from_account, key);
            const decimals = Math.max(0, item.precision);
            const formatedBalance = balanceOfCurrentAsset
                ? moveDecimal(balanceOfCurrentAsset, decimals)
                : 0;
            item.assetId = key;
            if (item.amount > (formatedBalance as any)) {
                item.warning = true;
                item.balance = formatedBalance;
            }
            return item;
        });

        // for peer2
        to_barter.forEach(function(item) {
            if (item.to_amount) {
                if (peer2Amounts.hasOwnProperty(item.to_asset_id)) {
                    peer2Amounts[item.to_asset_id] = {
                        amount:
                            Number(peer2Amounts[item.to_asset_id].amount) +
                            Number(item.to_amount),
                        precision: item.to_asset.get("precision"),
                        symbol: item.to_asset.get("symbol")
                    };
                } else {
                    peer2Amounts[item.to_asset_id] = {
                        amount: Number(item.to_amount),
                        precision: item.to_asset.get("precision"),
                        symbol: item.to_asset.get("symbol")
                    };
                }
            }
        });

        const peer2AmountsFormated = map(peer2Amounts, (item: any, key: any) => {
            const balanceOfCurrentAsset = getBalance(to_account, key);
            const decimals = Math.max(0, item.precision);
            const formatedBalance = balanceOfCurrentAsset
                ? moveDecimal(balanceOfCurrentAsset, decimals)
                : 0;
            item.assetId = key;
            if (item.amount > (formatedBalance as any)) {
                item.warning = true;
                item.balance = formatedBalance;
            }
            return item;
        });

        mergeState({
            balanceWarning: {
                peer1: peer1AmountsFormated,
                peer2: peer2AmountsFormated
            }
        });
    }

    function onFromAmountChanged(index: number, e: {asset: any; amount: any}) {
        const asset = e.asset;
        const amount = e.amount;
        if (!asset) {
            return;
        }
        const from_barter = [...state.from_barter];

        from_barter[index] = {
            index,
            from_amount: amount,
            from_asset: asset,
            from_asset_id: asset.get("id"),
            from_balanceError: false,
            from_feeAsset: from_barter[index].from_feeAsset
        };

        mergeState({
            from_barter: from_barter,
            from_error: null
        });
        _checkBalance(
            from_barter[index].from_feeAsset,
            amount,
            state.from_account,
            asset,
            index,
            true,
            from_barter[index].from_feeAsset.asset_id,
            from_barter
        );
        checkAmountsTotal({from_barter});
    }

    function onToAmountChanged(index: number, e: {asset: any; amount: any}) {
        const asset = e.asset;
        const amount = e.amount;
        if (!asset) {
            return;
        }
        const to_barter = [...state.to_barter];

        to_barter[index] = {
            index,
            to_amount: amount,
            to_asset: asset,
            to_asset_id: asset.get("id"),
            to_feeAsset: to_barter[index].to_feeAsset,
            to_balanceError: false
        };

        mergeState({
            to_barter: to_barter,
            to_error: null
        });
        _checkBalance(
            to_barter[index].to_feeAsset,
            amount,
            state.to_account,
            asset,
            index,
            false,
            to_barter[index].to_feeAsset.asset_id,
            to_barter
        );
        checkAmountsTotal({to_barter});
    }

    function _getAvailableAssets(s: BarterState = state) {
        const {from_account, from_error, to_account, to_error} = s;

        const getAssetTypes = (account: any, err: any) => {
            let asset_types: string[] = [],
                fee_asset_types: string[] = [];
            if (!(account && account.get("balances") && !err)) {
                return {asset_types, fee_asset_types};
            }
            const account_balances = account.get("balances").toJS();
            asset_types = Object.keys(account_balances).sort(utils.sortID);
            fee_asset_types = Object.keys(account_balances).sort(utils.sortID);

            for (const key in account_balances) {
                const balanceObject = ChainStore.getObject(account_balances[key]);
                if (balanceObject && balanceObject.get("balance") === 0) {
                    asset_types.splice(asset_types.indexOf(key), 1);
                    if (fee_asset_types.indexOf(key) !== -1) {
                        fee_asset_types.splice(fee_asset_types.indexOf(key), 1);
                    }
                }
            }

            return {asset_types, fee_asset_types};
        };

        const from = getAssetTypes(from_account, from_error);
        const to = getAssetTypes(to_account, to_error);

        return {
            from_asset_types: from.asset_types || [],
            to_asset_types: to.asset_types || [],
            from_fee_asset_types: from.fee_asset_types || [],
            to_fee_asset_types: to.fee_asset_types || []
        };
    }

    function addFromAmount() {
        state.from_barter.push({
            from_amount: "",
            from_asset_id: null,
            from_asset: null,
            from_feeAsset: new Asset({amount: 0, asset_id: "1.3.0"})
        });
        mergeState({from_barter: state.from_barter});
    }

    function addToAmount() {
        state.to_barter.push({
            to_amount: "",
            to_asset_id: null,
            to_asset: null,
            to_feeAsset: new Asset({amount: 0, asset_id: "1.3.0"})
        });
        mergeState({to_barter: state.to_barter});
    }

    function onSubmit(e: any) {
        e.preventDefault();
        mergeState({from_error: null, to_error: null});
        let sendAmount;
        const transfer_list: any[] = [];

        const proposer = AccountStore.getState().currentAccount;

        let left_account = state.from_account;
        const escrowMemo =
            state.memo["escrow"][0] && state.memo["escrow"][0].message;

        if (state.showEscrow && state.send_to_escrow) {
            left_account = state.escrow_account;
        }

        if (state.showEscrow) {
            // Preserved bug, not fixed - see the file header comment's
            // "Preserved bug, not fixed" section: the original references
            // a `fee` identifier that is genuinely out of scope in this
            // method (only `render()` defines it), a real `ReferenceError`
            // at runtime whenever `escrow_payment_changed` is `false`.
            const escrow_payment = state.escrow_payment_changed
                ? new Asset({real: state.escrow_payment}).getAmount()
                : referenceErrorLikeOriginal("fee");
            if (escrow_payment > 0) {
                transfer_list.push({
                    from_account: state.from_account.get("id"),
                    to_account: state.escrow_account.get("id"),
                    amount: escrow_payment,
                    asset: "1.3.0",
                    memo: escrowMemo ? new Buffer(escrowMemo, "utf-8") : null,
                    feeAsset: state.escrowFeeAssetId,
                    propose_account: proposer
                });
            }
        }

        state.from_barter.forEach((item, index) => {
            const asset = item.from_asset;
            const amount = item.from_amount;
            sendAmount = new Asset({
                real: amount,
                asset_id: asset.get("id"),
                precision: asset.get("precision")
            });

            const fromBarterMemo =
                state.memo["from_barter"][index] &&
                state.memo["from_barter"][index].message;

            if (state.showEscrow && state.send_to_escrow) {
                transfer_list.push({
                    from_account: state.from_account.get("id"),
                    to_account: state.escrow_account.get("id"),
                    amount: sendAmount.getAmount(),
                    asset: asset.get("id"),
                    memo: escrowMemo ? new Buffer(escrowMemo, "utf-8") : null,
                    feeAsset: item.from_feeAsset
                        ? item.from_feeAsset.asset_id
                        : "1.3.0"
                });
            }

            transfer_list.push({
                from_account: left_account.get("id"),
                to_account: state.to_account.get("id"),
                amount: sendAmount.getAmount(),
                asset: asset.get("id"),
                memo: fromBarterMemo
                    ? new Buffer(fromBarterMemo, "utf-8")
                    : null,
                feeAsset: item.from_feeAsset
                    ? item.from_feeAsset.asset_id
                    : "1.3.0",
                propose_account: proposer
            });
        });

        if (state.showEscrow && !state.send_to_escrow) {
            transfer_list.push({
                from_account: state.escrow_account.get("id"),
                to_account: state.from_account.get("id"),
                amount: 1,
                asset: "1.3.0",
                memo: null,
                feeAsset: state.escrowFeeAssetId,
                propose_account: proposer
            });
        }

        state.to_barter.forEach((item, index) => {
            const asset = item.to_asset;
            const amount = item.to_amount;
            const toBarterMemo =
                state.memo["to_barter"][index] &&
                state.memo["to_barter"][index].message;
            sendAmount = new Asset({
                real: amount,
                asset_id: asset.get("id"),
                precision: asset.get("precision")
            });
            transfer_list.push({
                from_account: state.to_account.get("id"),
                to_account: state.from_account.get("id"),
                amount: sendAmount.getAmount(),
                asset: asset.get("id"),
                memo: toBarterMemo ? new Buffer(toBarterMemo, "utf-8") : null,
                feeAsset: item.to_feeAsset
                    ? item.to_feeAsset.asset_id
                    : "1.3.0",
                propose_account: proposer
            });
        });

        ApplicationApi.transfer_list(transfer_list, state.proposal_fee.asset_id);
    }

    const onMemoChanged = (type: string, index: number) => (e: any) => {
        const memos: any = Object.assign({}, state.memo);
        memos[type][index] = {message: e.target.value, shown: true};
        mergeState({memo: memos});
    };

    function renderMemoField(type: string, index: number) {
        const {memo} = state;
        const memoValue =
            (memo as any)[type][index] && (memo as any)[type][index].message
                ? (memo as any)[type][index].message
                : "";
        return (
            <div className="content-block transfer-input">
                <Translate
                    className="left-label"
                    component="label"
                    content="transfer.memo"
                />
                <textarea
                    style={{marginBottom: 0}}
                    rows={1}
                    value={memoValue}
                    onChange={onMemoChanged(type, index)}
                />
            </div>
        );
    }

    // Curried, matching the original's `handleMemoOpen = (type, index) =>
    // e => {...}` shape used directly as an `onClick` handler - the inner
    // function's `e` (the click event) was never read in the original
    // either, so it's dropped here (lint-forced; extra args a caller
    // passes are simply ignored in JS, so this has no runtime effect).
    const handleMemoOpen = (type: string, index: number) => () => {
        const memos: any = Object.assign({}, state.memo);
        memos[type][index] = {message: "", shown: true};
        mergeState({memo: memos});
    };

    function renderBalanceWarnings() {
        const {
            balanceWarning: {peer1, peer2}
        } = state;
        const isPeer1Warning = peer1.some((item: any) => !!item.warning);
        const isPeer2Warning = peer2.some((item: any) => !!item.warning);

        const peer1Text = counterpart.translate("showcases.barter.peer_left");
        const peer2Text = counterpart.translate("showcases.barter.peer_right");
        const peer1Component = isPeer1Warning ? (
            <div style={{maxWidth: "25rem"}}>
                {counterpart.translate(
                    "showcases.barter.balance_warning_tooltip",
                    {
                        peer: peer1Text
                    }
                )}
                <br />
                {peer1.map((item: any) => {
                    if (item.warning) {
                        return (
                            <React.Fragment>
                                <br />
                                <span
                                    style={{marginRight: "10px"}}
                                    key={item.assetId}
                                >
                                    {" - " +
                                        counterpart.translate(
                                            "showcases.barter.balance_warning_line",
                                            {
                                                asset_symbol: item.symbol,
                                                asset_balance: item.balance,
                                                asset_amount: item.amount
                                            }
                                        )}
                                </span>
                            </React.Fragment>
                        );
                    }
                })}
            </div>
        ) : null;
        const peer2Component = isPeer2Warning ? (
            <div style={{maxWidth: "25rem"}}>
                {counterpart.translate(
                    "showcases.barter.balance_warning_tooltip",
                    {
                        peer: peer2Text
                    }
                )}
                {peer2.map((item: any) => {
                    if (item.warning) {
                        return (
                            <span
                                style={{marginRight: "10px"}}
                                key={item.assetId}
                            >
                                <br />
                                <br />
                                {counterpart.translate(
                                    "showcases.barter.balance_warning_line",
                                    {
                                        asset_symbol: item.symbol,
                                        asset_balance: item.balance,
                                        asset_amount: item.amount
                                    }
                                )}
                                ;
                            </span>
                        );
                    }
                })}
            </div>
        ) : null;

        return (
            <span className="barter-balance-warning">
                {isPeer1Warning && (
                    <Popover
                        content={peer1Component}
                        title={counterpart.translate(
                            "showcases.barter.balance_warning"
                        )}
                    >
                        <span style={{cursor: "help"}}>
                            <Alert
                                style={{
                                    display: "inline",
                                    marginRight: "1rem"
                                }}
                                message={
                                    peer1Text +
                                    " " +
                                    counterpart.translate(
                                        "showcases.barter.balance_warning"
                                    )
                                }
                                type="warning"
                                showIcon
                            />
                        </span>
                    </Popover>
                )}
                {isPeer2Warning && (
                    <Popover
                        content={peer2Component}
                        title={counterpart.translate(
                            "showcases.barter.balance_warning"
                        )}
                    >
                        <span style={{cursor: "help"}}>
                            <Alert
                                style={{display: "inline"}}
                                message={
                                    peer2Text +
                                    " " +
                                    counterpart.translate(
                                        "showcases.barter.balance_warning"
                                    )
                                }
                                type="warning"
                                showIcon
                            />
                        </span>
                    </Popover>
                )}
            </span>
        );
    }

    function onFeeChangedPeer1CreateProposal(asset: any) {
        mergeState({proposal_fee: asset});
    }

    function onFeeChangedPeer1InProposal(asset: any) {
        const _barter = state.from_barter.map(item => {
            (item as any).to_feeAsset = asset;
            return item;
        });
        mergeState({from_barter: _barter});
    }

    function onFeeChangedPeer2InProposal(asset: any) {
        const _barter = state.to_barter.map(item => {
            item.to_feeAsset = asset;
            return item;
        });
        mergeState({to_barter: _barter});
    }

    function onEscrowFeeChanged(asset: any) {
        mergeState({escrowFeeAssetId: asset.asset_id});
    }

    // Moved earlier than the original class's method order purely because
    // JavaScript doesn't allow statements after a `return` - see header
    // comment. Hoisting makes their actual declaration position
    // irrelevant to behavior.
    function _updateEscrowFee(e: any) {
        mergeState({
            escrow_payment_changed: true,
            escrow_payment: e.amount
        });
    }

    function onToggleSendToEscrow() {
        mergeState({
            send_to_escrow: !state.send_to_escrow
        });
    }

    function toggleEscrow() {
        mergeState({showEscrow: !state.showEscrow});
    }

    // --- render() begins here ---
    const {
        from_name,
        to_name,
        from_account,
        to_account,
        from_barter,
        to_barter,
        from_error,
        to_error
    } = state;
    // Split out from the destructuring above (lint-forced, not a
    // behavior change): this is the only one of these fields ever
    // reassigned (via `amount_index++` below), so it has to stay `let`
    // while the rest become `const`.
    let amount_index = state.amount_index;
    const {from_asset_types, to_asset_types} = _getAvailableAssets();
    const smallScreen = window.innerWidth < 850 ? true : false;
    const assetFromList: any[] = [];
    const assetToList: any[] = [];
    const assetFromSymbol = "";
    const assetToSymbol = "";

    const checkAmountValid = () => {
        for (const item of from_barter) {
            // `.call` (rather than `item.from_amount.replace(...)`) is
            // kept verbatim - it relies on `String.prototype.replace`'s
            // `ToString(this)` coercion to also accept a numeric
            // `from_amount`, which a direct `.replace()` call wouldn't.
            // TS can't resolve `.call` against `replace`'s overloaded
            // signature (a pre-existing TS/lib.es5 limitation, not a
            // logic issue), so it's cast through `any` here only to
            // satisfy the type checker.
            const amountValue = parseFloat(
                (String.prototype.replace.call as any)(
                    item.from_amount,
                    /,/g,
                    ""
                )
            );
            if (isNaN(amountValue) || amountValue === 0) return false;
        }

        for (const item of to_barter) {
            const amountValue = parseFloat(
                (String.prototype.replace.call as any)(
                    item.to_amount,
                    /,/g,
                    ""
                )
            );
            if (isNaN(amountValue) || amountValue === 0) return false;
        }
        return true;
    };
    const explictPrice = () => {
        let result: any = "";
        if (checkAmountValid()) {
            const fromAmount = parseFloat(from_barter[0].from_amount);
            const toAmount = parseFloat(to_barter[0].to_amount);
            result = fromAmount / toAmount;
        }
        return result;
    };

    const fee = (from: boolean) => {
        console.log(from_barter);
        let fee = 0;
        if (from) {
            fee = fee;
            from_barter.forEach(item => {
                fee += item.from_feeAsset._real_amount;
            });
        } else {
            to_barter.forEach(item => {
                fee += item.to_feeAsset._real_amount;
            });
        }

        return fee;
    };
    // `balanceError()` (checked whether any barter row has a balance
    // error) is dropped here - see header comment. It's grep-confirmed
    // dead in the original too: its only call site is commented out
    // right where `isSubmitNotValid` is built ("// balanceError() ||"),
    // so it was already never invoked; ESLint's `no-unused-vars` flags a
    // truly-never-called local function, so it's removed rather than
    // kept as inert dead code.

    const isEscrowNotValid = state.showEscrow && !state.escrow_account;

    // should the user be only allowed to request for existing funds?
    // balanceError() ||
    const isSubmitNotValid =
        !from_account ||
        !to_account ||
        from_account.get("id") == to_account.get("id") ||
        to_error ||
        !checkAmountValid() ||
        from_error ||
        isEscrowNotValid;

    const balance = (
        account: any,
        balanceError: any,
        asset_types: any[],
        asset: any
    ) => {
        if (account && account.get("balances")) {
            const account_balances = account.get("balances").toJS();

            const _error = balanceError ? "has-error" : "";
            if (asset_types.length === 1)
                asset = ChainStore.getAsset(asset_types[0]);
            if (asset_types.length > 0) {
                const current_asset_id = asset ? asset.get("id") : asset_types[0];

                return (
                    <span>
                        <Translate
                            component="span"
                            content="transfer.available"
                        />
                        :{" "}
                        <span
                            className={_error}
                            style={{
                                borderBottom: "#A09F9F 1px dotted",
                                cursor: "pointer"
                            }}
                        >
                            <BalanceComponent
                                balance={account_balances[current_asset_id]}
                            />
                        </span>
                    </span>
                );
            } else {
                return (
                    <span>
                        <span className={_error}>
                            <Translate content="transfer.errors.noFunds" />
                        </span>
                    </span>
                );
            }
        }
    };

    const fromAmountSelector = from_barter.map((item, index) => {
        let assetSymbol = "";
        if (item.from_asset) {
            assetSymbol = item.from_asset.get("symbol");
            assetFromList.push([item.from_amount || 0, assetSymbol].join(" "));
        }

        const isMemoShown =
            state.memo["from_barter"][index] &&
            state.memo["from_barter"][index].shown;
        return (
            <div key={amount_index++}>
                <div style={{position: "relative"}}>
                    {!isMemoShown && (
                        <Tooltip
                            title={counterpart.translate(
                                "tooltip.add_memo_field"
                            )}
                            placement="topLeft"
                        >
                            <Button
                                onClick={handleMemoOpen("from_barter", index)}
                                size="small"
                                icon="message"
                                className="add-memo-btn"
                            />
                        </Tooltip>
                    )}
                    <AmountSelector
                        label="showcases.barter.bartering_asset"
                        style={{
                            marginBottom: "1rem"
                        }}
                        amount={item.from_amount}
                        onChange={(e: any) => onFromAmountChanged(index, e)}
                        asset={
                            from_asset_types.length > 0 && item.from_asset
                                ? item.from_asset.get("id")
                                : item.from_asset_id
                                ? item.from_asset_id
                                : from_asset_types[0]
                        }
                        assets={from_asset_types}
                        display_balance={balance(
                            from_account,
                            item.from_balanceError,
                            from_asset_types,
                            item.from_asset
                        )}
                        allowNaN={true}
                    />
                </div>
                {isMemoShown && renderMemoField("from_barter", index)}
            </div>
        );
    });

    const toAmountSelector = to_barter.map((item, index) => {
        // Unlike `fromAmountSelector` above, the original computes a
        // local `assetSymbol` here but never actually uses it - the
        // `.push()` below calls `item.to_asset.get("symbol")` directly a
        // second time instead of reusing it (a real, harmless quirk in
        // the original, not a mistake introduced here). The dead
        // `assetSymbol` assignment itself is dropped since ESLint's
        // `no-unused-vars` flags a value that's computed and genuinely
        // never read; the redundant `.get("symbol")` call is kept
        // exactly as-is.
        if (item.to_asset) {
            assetToList.push(
                [item.to_amount || 0, item.to_asset.get("symbol")].join(" ")
            );
        }
        const isMemoShown =
            state.memo["to_barter"][index] && state.memo["to_barter"][index].shown;

        return (
            <div key={amount_index++}>
                <div style={{position: "relative"}}>
                    {!isMemoShown && (
                        <Tooltip
                            title={counterpart.translate(
                                "tooltip.add_memo_field"
                            )}
                            placement="topLeft"
                        >
                            <Button
                                onClick={handleMemoOpen("to_barter", index)}
                                size="small"
                                icon="message"
                                className="add-memo-btn"
                            />
                        </Tooltip>
                    )}
                    <AmountSelector
                        label="showcases.barter.bartering_asset"
                        style={{
                            marginBottom: "1rem"
                        }}
                        amount={item.to_amount}
                        onChange={(e: any) => onToAmountChanged(index, e)}
                        asset={
                            to_asset_types.length > 0 && item.to_asset
                                ? item.to_asset.get("id")
                                : item.to_asset_id
                                ? item.to_asset_id
                                : to_asset_types[0]
                        }
                        assets={to_asset_types}
                        display_balance={balance(
                            to_account,
                            item.to_balanceError,
                            to_asset_types,
                            item.to_asset
                        )}
                        allowNaN={true}
                    />
                </div>
                {isMemoShown && renderMemoField("to_barter", index)}
            </div>
        );
    });

    const account_from = (
        <Card style={{borderRadius: "10px"}}>
            <Translate content={"showcases.barter.peer_left"} />
            <AccountSelector
                label="showcases.barter.account"
                placeholder="placeholder"
                style={{
                    marginTop: "0.5rem",
                    marginBottom: "1rem"
                }}
                allowPubKey={true}
                allowUppercase={true}
                account={from_account}
                accountName={from_name}
                onChange={fromChanged}
                onAccountChanged={onFromAccountChanged}
                hideImage
                typeahead={true}
            />
            {from_account && (
                <div>
                    {fromAmountSelector}
                    <div style={{paddingTop: "10px", paddingBottom: "10px"}}>
                        <Button
                            onClick={addFromAmount}
                            disabled={
                                !from_account ||
                                !state.from_barter[state.from_barter.length - 1]
                                    .from_amount
                            }
                        >
                            + Add asset
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );

    const account_to = (
        <Card style={{borderRadius: "10px"}}>
            <Translate content={"showcases.barter.peer_right"} />
            <AccountSelector
                label="showcases.barter.account"
                placeholder="placeholder"
                style={{
                    marginTop: "0.5rem",
                    marginBottom: "1rem"
                }}
                allowPubKey={true}
                allowUppercase={true}
                account={to_account}
                accountName={to_name}
                onChange={toChanged}
                onAccountChanged={onToAccountChanged}
                hideImage
                typeahead={true}
            />
            {to_account && (
                <div>
                    {toAmountSelector}
                    <div style={{paddingTop: "10px", paddingBottom: "10px"}}>
                        <Button
                            onClick={addToAmount}
                            disabled={
                                !to_account ||
                                !state.to_barter[state.to_barter.length - 1]
                                    .to_amount
                            }
                        >
                            + Add asset
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );

    let action_error_key = "showcases.barter.not_complete";
    if (isSubmitNotValid) {
        if (!from_account) {
            action_error_key = "showcases.barter.error_fill_in_peer_left_name";
        } else if (!to_account) {
            action_error_key = "showcases.barter.error_fill_in_peer_right_name";
        } else if (from_account.get("id") == to_account.get("id")) {
            action_error_key = "showcases.barter.error_same_name";
        } else if (!checkAmountValid()) {
            action_error_key =
                "showcases.barter.error_fill_in_valid_asset_amount";
        } else if (isEscrowNotValid) {
            action_error_key = "showcases.barter.error_fill_in_escrow_name";
        } else if (
            state.showEscrow &&
            (from_account.get("id") == state.escrow_account.get("id") ||
                to_account.get("id") == state.escrow_account.get("id"))
        ) {
            action_error_key = "showcases.barter.error_same_name_escrow";
        }
    }

    const offers = (
        <Card style={{borderRadius: "10px"}}>
            {!isSubmitNotValid && (
                <div className="left-label" style={{fontSize: "1rem"}}>
                    {counterpart.translate("showcases.barter.action", {
                        peer_left: from_name,
                        assets_left: assetFromList.join(", "),
                        peer_right: to_name,
                        assets_right: assetToList.join(", ")
                    })}
                    {state.showEscrow &&
                        !state.send_to_escrow &&
                        counterpart.translate(
                            "showcases.barter.escrow_as_witness",
                            {
                                escrow: state.escrow_account.get("name")
                            }
                        )}
                    {state.showEscrow &&
                        state.send_to_escrow &&
                        counterpart.translate(
                            "showcases.barter.escrow_as_custodian",
                            {
                                escrow: state.escrow_account.get("name")
                            }
                        )}
                </div>
            )}
            {isSubmitNotValid && (
                <div
                    className="left-label"
                    style={{
                        fontSize: "1rem"
                    }}
                >
                    {counterpart.translate(action_error_key)}
                </div>
            )}
            <Tooltip
                title={counterpart.translate(
                    "showcases.barter.add_escrow_tooltip"
                )}
                placement="topRight"
            >
                <Button
                    key={state.showEscrow ? "remove_escrow" : "add_escrow"}
                    onClick={toggleEscrow}
                    style={{
                        float: "right"
                    }}
                >
                    {counterpart.translate(
                        state.showEscrow
                            ? "showcases.barter.remove_escrow"
                            : "showcases.barter.add_escrow"
                    )}
                </Button>
            </Tooltip>
            {from_barter.length === 500 && to_barter.length === 500 ? ( // deactivate for now
                <div className="amount-selector" style={props.style}>
                    <Translate
                        className="left-label"
                        component="label"
                        content="transfer.explict_price"
                    />
                    <div className="inline-label input-wrapper">
                        <Input
                            disabled={false}
                            type="text"
                            value={explictPrice()}
                        />

                        <div className="form-label select floating-dropdown">
                            <div className="dropdown-wrapper inactive">
                                <div>
                                    {`${assetFromSymbol}/${assetToSymbol}`}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                ""
            )}
        </Card>
    );

    const totalFeeFrom = (
        <Card style={{borderRadius: "10px"}}>
            <Translate content={"showcases.barter.peer_left"} />
            <Tooltip
                title={counterpart.translate(
                    state.send_to_escrow
                        ? "showcases.barter.fee_due_now_tooltip"
                        : "showcases.barter.fee_when_proposal_executes_tooltip"
                )}
            >
                <div className="barter-fee-selector">
                    {/*needed to render tooltip properly*/}
                    <FeeAssetSelector
                        label={
                            state.send_to_escrow
                                ? "showcases.barter.fee_due_now"
                                : "showcases.barter.fee_when_proposal_executes"
                        }
                        account={from_account}
                        transaction={{
                            type: "transfer",
                            options: ["price_per_kbyte"],
                            data: {
                                type: "memo",
                                content: null
                            }
                        }}
                        onChange={onFeeChangedPeer1InProposal}
                    />
                </div>
            </Tooltip>
            <Tooltip
                title={counterpart.translate(
                    "showcases.barter.proposal_fee_tooltip"
                )}
            >
                <div className="barter-fee-selector">
                    {/*needed to render tooltip properly*/}
                    <FeeAssetSelector
                        label="showcases.barter.proposal_fee"
                        account={from_account}
                        transaction={{
                            type: "proposal_create",
                            options: ["price_per_kbyte"],
                            data: {
                                type: "memo",
                                content: null
                            }
                        }}
                        onChange={onFeeChangedPeer1CreateProposal}
                    />
                </div>
            </Tooltip>
            <Tooltip
                title={counterpart.translate(
                    "showcases.barter.total_fees_tooltip"
                )}
            >
                <span style={{marginTop: "1rem"}}>
                    <Translate
                        content={"showcases.barter.total_fees"}
                        className="left-label"
                        component="label"
                        fee={fee(true) + state.proposal_fee._real_amount}
                        asset={"BTS"}
                    />
                </span>
            </Tooltip>
        </Card>
    );

    const totalFeeTo = (
        <Card style={{borderRadius: "10px"}}>
            <Translate content={"showcases.barter.peer_right"} />
            <Tooltip
                title={counterpart.translate(
                    "showcases.barter.fee_when_proposal_executes_tooltip"
                )}
            >
                <div className="barter-fee-selector">
                    {/*needed to render tooltip properly*/}
                    <FeeAssetSelector
                        label="showcases.barter.fee_when_proposal_executes"
                        account={to_account}
                        transaction={{
                            type: "transfer",
                            options: ["price_per_kbyte"],
                            data: {
                                type: "memo",
                                content: null
                            }
                        }}
                        onChange={onFeeChangedPeer2InProposal}
                    />
                </div>
            </Tooltip>
        </Card>
    );

    let feeForEscrow = null;
    if (state.showEscrow) {
        feeForEscrow = (
            <Card style={{borderRadius: "10px"}}>
                <Translate content={"showcases.barter.escrow_account"} />
                <Tooltip
                    title={counterpart.translate(
                        "showcases.barter.fee_when_proposal_executes_tooltip"
                    )}
                >
                    <div className="barter-fee-selector">
                        {/*needed to render tooltip properly*/}
                        <FeeAssetSelector
                            label="showcases.barter.fee_when_proposal_executes"
                            account={state.escrow_account}
                            transaction={{
                                type: "transfer",
                                options: ["price_per_kbyte"],
                                data: {
                                    type: "memo",
                                    content: null
                                }
                            }}
                            onChange={onEscrowFeeChanged}
                        />
                    </div>
                </Tooltip>
            </Card>
        );
    }

    const intro = (
        <Card
            style={{
                borderRadius: "10px"
            }}
        >
            <Tooltip
                title={counterpart.translate(
                    "showcases.barter.new_barter_tooltip"
                )}
                placement="bottom"
            >
                <h2 style={{textAlign: "center"}}>
                    <Translate content={"showcases.barter.new_barter"} />{" "}
                    <Icon type="question-circle" theme="filled" />
                </h2>
            </Tooltip>
        </Card>
    );

    let escrow = null;
    const isEscrowMemoShown =
        state.memo["escrow"][0] && state.memo["escrow"][0].shown;
    const escrow_payment = state.escrow_payment_changed
        ? state.escrow_payment
        : fee(true);
    if (state.showEscrow) {
        escrow = (
            <Card style={{borderRadius: "10px"}}>
                <AccountSelector
                    label="showcases.barter.escrow_account"
                    placeholder="placeholder"
                    style={{
                        marginBottom: "1rem"
                    }}
                    allowPubKey={true}
                    allowUppercase={true}
                    account={state.escrow_account}
                    accountName={state.escrow_account_name}
                    onChange={escrowAccountChanged}
                    onAccountChanged={onEscrowAccountChanged}
                    hideImage
                    typeahead={true}
                />
                <Tooltip
                    title={counterpart.translate(
                        "showcases.barter.send_to_escrow_tooltip"
                    )}
                >
                    <span>
                        <Switch
                            style={{margin: 6}}
                            checked={state.send_to_escrow}
                            onChange={onToggleSendToEscrow}
                        />
                        <Translate content="showcases.barter.send_to_escrow" />
                    </span>
                </Tooltip>

                <div style={{position: "relative"}}>
                    {!isEscrowMemoShown && (
                        <Tooltip
                            title={counterpart.translate(
                                "tooltip.add_memo_field"
                            )}
                            placement="topLeft"
                        >
                            <Button
                                onClick={handleMemoOpen("escrow", 0)}
                                size="small"
                                icon="message"
                                className="add-memo-btn"
                            />
                        </Tooltip>
                    )}

                    <Tooltip
                        title={counterpart.translate(
                            "showcases.barter.escrow_payment_tooltip"
                        )}
                        placement="topLeft"
                    >
                        <div>
                            {/*needed to render tooltip properly*/}
                            <AmountSelector
                                label="showcases.barter.escrow_payment"
                                disabled={false}
                                amount={escrow_payment}
                                onChange={_updateEscrowFee}
                                style={{
                                    margin: "1rem 0"
                                }}
                                asset={"1.3.0"}
                                assets={["1.3.0"]}
                                error={
                                    state.hasPoolBalance === false
                                        ? "transfer.errors.insufficient"
                                        : null
                                }
                                scroll_length={2}
                            />
                        </div>
                    </Tooltip>
                    {isEscrowMemoShown && renderMemoField("escrow", 0)}
                </div>
            </Card>
        );
    }

    return (
        <div
            className="center"
            style={{
                padding: "10px",
                maxWidth: "80rem",
                width: "100%",
                margin: "0 auto"
            }}
        >
            <Card>
                {smallScreen ? (
                    <div>
                        <Row>
                            <Col style={{padding: "10px"}}>{intro}</Col>
                        </Row>
                        <Row>
                            <Col style={{padding: "10px"}}>{account_from}</Col>
                        </Row>
                        <Row>
                            <Col style={{padding: "10px"}}>{account_to}</Col>
                        </Row>
                        <Row>
                            <Col style={{padding: "10px"}}>{offers}</Col>
                        </Row>
                        {escrow && (
                            <Row>
                                <Col style={{padding: "10px"}}>{escrow}</Col>
                            </Row>
                        )}
                        <Row>
                            <Col style={{padding: "10px"}}>{totalFeeFrom}</Col>
                        </Row>
                        <Row>
                            <Col style={{padding: "10px"}}>{totalFeeTo}</Col>
                        </Row>
                        {feeForEscrow != null && (
                            <Row>
                                <Col style={{padding: "10px"}}>
                                    {feeForEscrow}
                                </Col>
                            </Row>
                        )}
                    </div>
                ) : (
                    <div>
                        <Row>
                            <Col style={{padding: "10px"}}>{intro}</Col>
                        </Row>
                        <Row>
                            <Col span={12} style={{padding: "10px"}}>
                                {account_from}
                            </Col>
                            <Col span={12} style={{padding: "10px"}}>
                                {account_to}
                            </Col>
                        </Row>
                        <Row>
                            <Col style={{padding: "10px"}}>{offers}</Col>
                        </Row>
                        {escrow && (
                            <Row>
                                <Col style={{padding: "10px"}}>{escrow}</Col>
                            </Row>
                        )}
                        <Row>
                            <Col span={12} style={{padding: "10px"}}>
                                {totalFeeFrom}
                            </Col>
                            <Col span={12} style={{padding: "10px"}}>
                                {totalFeeTo}
                                {feeForEscrow}
                            </Col>
                        </Row>
                    </div>
                )}
                <div className="barter-footer">
                    <Tooltip
                        title={counterpart.translate(
                            "showcases.barter.propose_tooltip"
                        )}
                        placement="topLeft"
                    >
                        <Button
                            key={"propose"}
                            disabled={isSubmitNotValid}
                            onClick={!isSubmitNotValid ? onSubmit : undefined}
                        >
                            {counterpart.translate("propose")}
                        </Button>
                    </Tooltip>
                    {!isSubmitNotValid && renderBalanceWarnings()}
                </div>
            </Card>
        </div>
    );
}
