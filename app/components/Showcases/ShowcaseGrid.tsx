// TypeScript/functional-component port of the legacy ShowcaseGrid.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
// The final file of `Showcases/` (6/6) - ported directly by the
// orchestrating session (not delegated), since it imports `Showcase.jsx`
// (ported in an earlier batch in this directory).
//
// Not security-sensitive per AGENTS.md: this component only lays out a
// grid of navigation tiles (most just call `history.push(...)` to the
// already-ported destination routes); the one tile with real client-side
// logic, "paper wallet", calls `createPaperWalletAsPDF(account)`
// (`common/paperWallet`, an existing, separately-owned utility this file
// doesn't modify) - grepped this file for `WalletDb`/`WalletApi`/
// `.add_type_operation`/`process_transaction`, none appear.
//
// `connect(ShowcaseGrid, {listenTo: [AccountStore], getProps() {...}})`
// is replaced by `useAltStore(AccountStore)` in an outer `ShowcaseGrid`
// wrapper, passed down to a `ShowcaseGridCore` function - this
// migration's established Container+Core split.
//
// `UNSAFE_componentWillMount` (resolves `ChainStore.getAccount(this.props
// .currentAccount)` once, synchronously, before the first paint) and
// `UNSAFE_componentWillReceiveProps(np)` (re-resolves only when `np
// .currentAccount !== this.props.currentAccount`, a guarded comparison -
// not unconditional) do the exact same resolution work, differing only in
// when they run - both collapse into a single `useEffect(() => {...},
// [currentAccount])`: it naturally fires once on mount (replicating the
// `UNSAFE_componentWillMount` call) and again only when `currentAccount`
// changes (replicating the guarded `UNSAFE_componentWillReceiveProps`
// call), with no extra guard logic needed. Not preserved (a mechanical,
// unavoidable consequence of the class-to-hooks translation, not an
// application-level bug): the original's resolution ran synchronously
// before the component's first paint, so `render()` never observed a
// not-yet-resolved account; a `useEffect` runs after the first paint, so
// this port's first render briefly observes `resolvedAccount === null`
// (all tiles show their "please login" disabled state for one frame even
// when an account is already available) before the effect resolves it -
// the same one-tick-later timing difference implicit in every other
// `UNSAFE_componentWillMount` → mount-only-`useEffect` translation
// throughout this migration.
//
// No `BindToChainState`/ChainStore subscription exists in the original
// (verified: no `ChainStore.subscribe`/`useChainStoreTick`-equivalent
// anywhere in this file) - it only re-resolves `ChainStore.getAccount`
// when the identifying `currentAccount` *name* prop itself changes, never
// in response to a live chain-data tick. `useChainStoreTick()` is
// therefore deliberately NOT added here, to avoid introducing a
// re-render-on-every-chain-tick behavior the original never had.
//
// `thiz.props.history.push(...)` (the class's `let thiz = this;` closure
// workaround, used inside several tile `target` callbacks defined as
// plain functions rather than arrow functions) becomes `useNavigate()`
// (`react-router-dom`), this migration's established replacement for
// `withRouter`/`this.props.history` (see e.g. `Dashboard/AccountCard
// .tsx`'s header comment) - `ShowcaseGrid` is rendered directly as a
// route (`app/App.jsx`'s `element={<ShowcaseGrid />}`), so `history` was
// originally always implicitly injected by react-router under v5; v6
// dropped that injection entirely (Phase 9, react-router v6 migration),
// so `useNavigate()` is read directly here instead.
//
// TS-forced adjustment: the outer `<div style={{align: "center"}}>` uses
// `align`, not a real CSS property (browsers silently ignore it - no
// property named `align` exists for inline styles; the original likely
// meant `textAlign`, but this was never "fixed" at runtime either) -
// TypeScript's `CSSProperties` typing rejects it outright, cast with `as
// React.CSSProperties` to preserve the original's inert markup exactly.
import * as React from "react";
import {useNavigate} from "react-router-dom";
import Showcase from "./Showcase";
import {ChainStore} from "bitsharesjs";
import AccountStore from "../../stores/AccountStore";
import {createPaperWalletAsPDF} from "common/paperWallet";
import {useAltStore} from "../../next/hooks/useAltStore";

interface ShowcaseGridCoreProps {
    currentAccount: any;
}

function ShowcaseGridCore({currentAccount}: ShowcaseGridCoreProps) {
    const [resolvedAccount, setResolvedAccount] = React.useState<any>(null);
    const navigate = useNavigate();

    React.useEffect(() => {
        setResolvedAccount((ChainStore as any).getAccount(currentAccount));
        // eslint-disable-next-line
    }, [currentAccount]);

    const hasAccount = resolvedAccount !== null;

    const tiles: any[] = [
        {
            title: "showcases.paper_wallet.title",
            target: () => {
                if (hasAccount) {
                    (createPaperWalletAsPDF as any)(resolvedAccount);
                }
            },
            description: "showcases.paper_wallet.description",
            icon: "wallet", // see Icons app/compoentns/Icon/Icon
            disabled: hasAccount
                ? false
                : "Please login to use this functionality"
        },
        {
            title: "showcases.voting.title",
            target: () => {
                if (hasAccount) {
                    navigate(
                        "/account/" + resolvedAccount.get("name") + "/voting"
                    );
                }
            },
            description: "showcases.voting.description",
            icon: "voting",
            disabled: hasAccount
                ? false
                : "Please login to use this functionality"
        },
        {
            title: "showcases.barter.title",
            target: () => {
                navigate("/barter");
            },
            description: "showcases.barter.description",
            icon: "barter",
            disabled: hasAccount
                ? false
                : "Please login to use this functionality"
        },
        {
            title: "showcases.borrow.title",
            target: () => {
                if (hasAccount) {
                    navigate("/borrow");
                }
            },
            description: "showcases.borrow.description",
            icon: "borrow",
            disabled: hasAccount
                ? false
                : "Please login to use this functionality"
        },
        {
            title: "showcases.direct_debit.title",
            target: () => {
                navigate("/direct-debit");
            },
            description: "showcases.direct_debit.description",
            icon: "direct_debit",
            disabled: hasAccount
                ? false
                : "Please login to use this functionality"
        },
        {
            title: "showcases.htlc.title",
            target: () => {
                navigate("/htlc");
            },
            description: "showcases.htlc.description",
            icon: "htlc",
            disabled: hasAccount
                ? false
                : "Please login to use this functionality"
        },
        {
            title: "showcases.prediction_market.title",
            target: () => {
                navigate("/prediction");
            },
            description: "showcases.prediction_market.description",
            icon: "prediction",
            disabled: hasAccount
                ? false
                : "Please login to use this functionality"
        },
        {
            title: "showcases.merchant_protocol.title",
            target: () => {
                navigate("/invoice/request");
            },
            description: "showcases.merchant_protocol.description",
            icon: "merchant",
            disabled: hasAccount
                ? false
                : "Please login to use this functionality"
        },
        {
            title: "showcases.timed_transfer.title",
            target: () => {},
            description: "showcases.timed_transfer.description",
            icon: "alarm",
            disabled: true,
            comingSoon: true
        },
        {
            title: "showcases.instant_trade.title",
            target: () => {
                navigate("/instant-trade");
            },
            description: "showcases.instant_trade.description",
            icon: "instant-trade",
            disabled: hasAccount
                ? false
                : "Please login to use this functionality"
        }
        // .... even more tiles in this list
    ];

    return (
        <div
            className="overflow-visible showcases-grid"
            style={
                {
                    align: "center"
                } as React.CSSProperties
            }
        >
            <div className="showcases-grid--wrapper">
                {tiles.map(tile => {
                    return (
                        <div
                            key={tile.title}
                            className="showcases-grid--wrapper--item"
                        >
                            {!!tile.disabled ? (
                                <Showcase
                                    target={tile.target}
                                    title={tile.title}
                                    description={tile.description}
                                    icon={tile.icon}
                                    disabled={tile.disabled}
                                    comingSoon={tile.comingSoon || false}
                                />
                            ) : (
                                <Showcase
                                    target={tile.target}
                                    title={tile.title}
                                    description={tile.description}
                                    icon={tile.icon}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ShowcaseGrid() {
    const accountState = useAltStore<any>(AccountStore);

    return (
        <ShowcaseGridCore
            currentAccount={
                accountState.currentAccount || accountState.passwordAccount
            }
        />
    );
}

export default ShowcaseGrid;
