// TypeScript/functional-component port of the legacy XbtsFiat.jsx (Phase
// 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. The last
// remaining file in the Xbtsx gateway family (in active migration scope,
// unlike the 6 gateways dropped in the "Gateway removal (pre-Phase 9)"
// pass) - missed by that pass's final sweep since it had never been
// ported in the first place, and was skipped over Phase 7's Xbtsx batch.
//
// Security-sensitive per AGENTS.md: `_onSubmit` calls
// `AccountActions.transfer(...)` directly, building a real transfer
// transaction (amount, asset, and a provider/ticker/IBAN memo). Preserved
// byte-for-byte: the exact same fields in the exact same order, the same
// `utils.get_asset_precision(...)`-based amount scaling, the same
// `new Buffer(...)` memo encoding (kept as-is, matching existing
// precedent - e.g. `Showcases/Barter.tsx`/`Modal/SendModal.tsx` - of not
// "fixing" the deprecated `Buffer()` constructor as an unrelated side
// effect), and the same commented-out IBAN-validity early return. No
// private key, password, or brainkey is read, logged, or persisted here.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(XbtsFiat)` HOC (resolving the required `XbtsFiat`
// account-id prop and `asset` symbol prop) is replaced by a small
// container component doing the same resolution directly under
// `useChainStoreTick()`, per this migration's established
// `BindToChainState` replacement pattern (see `Utility/AccountName.tsx`).
// `ChainStore.getAccount`/`ChainStore.getAsset` match the exact resolver
// functions `BindToChainState.jsx` itself uses for
// `ChainTypes.ChainAccount`/`ChainTypes.ChainAsset`. The plain `<span />`
// fallback while unresolved is the same default `BindToChainState`
// applies with no recognized options (this component passed none).
//
// Naming note, preserved from the original (not a bug): the original
// class has BOTH `this.props.asset` (the bound chain Asset object,
// defaulting to the "XBTSX.USD" asset, used only for its `.precision` in
// `_onSubmit`) AND `this.state.asset` (a plain string key - "XBTSX.USD"/
// "XBTSX.RUB"/"XBTSX.EUR" - selecting which row of the local `cur` map is
// active), both legitimately read in the same method via `this.`
// qualification. A function component can't shadow one `asset` binding
// with another, so the resolved prop is destructured as `assetObject` and
// the local state keeps the name `asset` (matching the original's state
// field) - same values, same usages, just disambiguated by scope instead
// of by `this.props.`/`this.state.`.
//
// The two string refs (`this.refs.amount`, `this.refs.iban`) become
// `useRef<HTMLInputElement>(null)`, read via `.current.value` in
// `_onSubmit` - same values, same timing (both inputs are always mounted
// whenever the withdraw form is, so there's no uninitialized-ref case to
// handle that the original's string refs didn't already have).
import * as React from "react";
import Translate from "react-translate-component";
import cnames from "classnames";
import TransactionConfirmStore from "stores/TransactionConfirmStore";
import AccountActions from "actions/AccountActions";
import SettingsActions from "actions/SettingsActions";
import AccountBalance from "../Account/AccountBalance";
import utils from "common/utils";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const logoPayeer =
    "data:image/png;base64,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";

const cur: Record<string, {ticker: string; min: number; max: number; id: string}> = {
    "XBTSX.USD": {
        ticker: "usd",
        min: 2,
        max: 3000,
        id: "1.3.5888"
    },
    "XBTSX.RUB": {
        ticker: "rub",
        min: 100,
        max: 100000,
        id: "1.3.5887"
    },
    "XBTSX.EUR": {
        ticker: "eur",
        min: 2,
        max: 3000,
        id: "1.3.5889"
    }
};

const providers: Record<string, {placeholder: string; fee: string; pattern: string}> = {
    payeer: {
        placeholder: "P000000",
        fee: "2%",
        pattern: "[Pp]{1}[0-9]{7,15}"
    }
    /*
    "qiwi": {
        placeholder: "79112223344",
        fee: "6%",
        pattern: ""
    }
     */
};

interface XbtsFiatCoreProps {
    viewSettings: any;
    account: any;
    assetObject: any;
    XbtsFiat: any;
}

function XbtsFiat({
    viewSettings,
    account,
    assetObject,
    XbtsFiat: xbtsFiatAccount
}: XbtsFiatCoreProps) {
    const [action, setAction] = React.useState<string>(() =>
        viewSettings.get("xbtsFiatAction", "deposit")
    );
    const [min] = React.useState<number>(2);
    const [max, setMax] = React.useState<number>(5000);
    const [asset, setAsset] = React.useState<string>("XBTSX.USD");
    const [provider, setProvider] = React.useState<string>("payeer");

    const amountRef = React.useRef<HTMLInputElement>(null);
    const ibanRef = React.useRef<HTMLInputElement>(null);

    const _renderDeposits = () => {
        return (
            <div className="">
                <p>
                    <img
                        onClick={() =>
                            window.open(
                                "https://payeer.com/013901230",
                                "_blank"
                            )
                        }
                        src={logoPayeer}
                    />
                </p>
                <p>
                    <a
                        rel="noreferrer"
                        className="button"
                        target={"_blank"}
                        style={{color: "white"}}
                        href={
                            "https://xbts.io/deposit/rub?account=" +
                            account.get("name")
                        }
                    >
                        ADD RUBLE
                    </a>
                    <a
                        rel="noreferrer"
                        className="button"
                        target={"_blank"}
                        style={{color: "white"}}
                        href={
                            "https://xbts.io/deposit/usd?account=" +
                            account.get("name")
                        }
                    >
                        ADD USD
                    </a>
                    <a
                        rel="noreferrer"
                        className="button"
                        target={"_blank"}
                        style={{color: "white"}}
                        href={
                            "https://xbts.io/deposit/eur?account=" +
                            account.get("name")
                        }
                    >
                        ADD EURO
                    </a>
                </p>
            </div>
        );
    };

    const onSelectCoin = (e: any) => {
        setAsset(e.target.value);
        setMax(cur[e.target.value].max);
        setProvider("payeer");
    };

    const onSelectProvider = (e: any) => {
        setProvider(e.currentTarget.value);
    };

    const _renderWithdrawals = () => {
        return (
            <div>
                <p>
                    <img
                        onClick={() =>
                            window.open(
                                "https://payeer.com/013901230",
                                "_blank"
                            )
                        }
                        src={logoPayeer}
                    />
                </p>
                <select
                    className="external-coin-types bts-select"
                    onChange={onSelectCoin}
                    value={asset}
                >
                    <option value="XBTSX.RUB" key="XBTSX.RUB">
                        RUBLE
                    </option>
                    <option value="XBTSX.USD" key="XBTSX.USD">
                        USD
                    </option>
                    <option value="XBTSX.EUR" key="XBTSX.EUR">
                        EUR
                    </option>
                </select>

                <div>
                    <br />
                    <p>
                        <input
                            type="radio"
                            id="payeer"
                            name="provider"
                            value="payeer"
                            checked={provider === "payeer"}
                            onChange={onSelectProvider}
                        />
                        <label htmlFor="payeer">
                            PAYEER {asset.substr(6, 3)}
                            (FEE 2%)
                        </label>
                        <small>max. {max}</small>

                        {/*
                        <br/>
                        <input type="radio" id="qiwi" name="provider" value="qiwi"  checked={provider === "qiwi"} onChange={this.onSelectProvider.bind(this)}/>
                        <label
                            htmlFor="qiwi">QIWI {asset.substr(6,3)}(FEE 5%)
                        </label>
                        <small>max. {max}</small>
                         */}

                        <br />
                        <input
                            type="radio"
                            id="card"
                            name="provider"
                            value="card"
                            checked={false}
                            disabled={true}
                            onChange={onSelectProvider}
                        />
                        <label htmlFor="card">
                            Visa/Master {asset.substr(6, 3)}
                            (5$ + 5%)
                        </label>
                        <small>max. {max}</small>
                    </p>
                    <p>
                        <small style={{color: "pink"}}>
                            Attention! Please check the number and number format
                            before sending! In case of an error, money will not
                            be returned!
                        </small>
                    </p>
                </div>

                <form onSubmit={_onSubmit}>
                    <div style={{padding: "20px 0"}}>
                        <Translate content="gateway.balance" />: &nbsp;
                        <span
                            style={{
                                fontWeight: "bold",
                                color: "#4A90E2",
                                textAlign: "right"
                            }}
                        >
                            <AccountBalance
                                account={account.get("name")}
                                asset={asset}
                            />
                        </span>
                    </div>

                    <label>
                        WALLET ADDRESS
                        <input
                            required
                            ref={ibanRef}
                            id="iban"
                            type="text"
                            placeholder={providers[provider].placeholder}
                        />
                    </label>

                    <label>
                        <Translate content="exchange.quantity" />
                        <input
                            required
                            ref={amountRef}
                            id="amount"
                            type="number"
                            min={min}
                            max={max}
                        />
                    </label>

                    <button className="button" type="submit">
                        <Translate content="gateway.withdraw_now" />
                    </button>
                </form>
            </div>
        );
    };

    const changeAction = (newAction: string) => {
        setAction(newAction);

        (SettingsActions as any).changeViewSetting({
            xbtsFiatAction: newAction
        });
    };

    const onTrxIncluded = (confirm_store_state: any) => {
        if (
            confirm_store_state.included &&
            confirm_store_state.broadcasted_transaction
        ) {
            (TransactionConfirmStore as any).unlisten(onTrxIncluded);
            (TransactionConfirmStore as any).reset();
        } else if (confirm_store_state.closed) {
            (TransactionConfirmStore as any).unlisten(onTrxIncluded);
            (TransactionConfirmStore as any).reset();
        }
    };

    const _onSubmit = (e: any) => {
        e.preventDefault();

        const amount = parseInt((amountRef.current as any).value, 10);
        const iban = (ibanRef.current as any).value;

        const re = new RegExp("[Pp]{1}[0-9]{7,15}");
        const isValid = re.test(iban);

        if (!isValid) {
            //return;
        }

        const assetId = cur[asset].id;

        const precision = (utils as any).get_asset_precision(
            assetObject.get("precision")
        );

        if (amount < min || amount > max) {
            return;
        }

        (AccountActions as any)
            .transfer(
                account.get("id"), // from user
                xbtsFiatAccount.get("id"), // to XbtsFiat account
                parseInt((amount * precision) as any, 10), // amount in full precision
                assetId, //asset.get("id"), // XBTS Fiat asset id
                //new Buffer(cur[this.state.asset].ticker + ":" + iban.toUpperCase(), "utf-8"), // memo
                new Buffer(
                    provider +
                        ":" +
                        cur[asset].ticker +
                        ":" +
                        iban.toUpperCase().trim(),
                    "utf-8"
                ), // memo
                null, // propose set to false
                assetId //asset.get("id") // Pay fee with XBTS FIAT or 1.3.0 BTS
            )
            .then(() => {
                (TransactionConfirmStore as any).unlisten(onTrxIncluded);
                (TransactionConfirmStore as any).listen(onTrxIncluded);
            });
    };

    return (
        <div className="XbtsFiat">
            <div className="content-block">
                <div style={{paddingBottom: 15}}>
                    <div
                        style={{marginRight: 10}}
                        onClick={() => changeAction("deposit")}
                        className={cnames(
                            "button",
                            action === "deposit" ? "active" : "outline"
                        )}
                    >
                        <Translate content="gateway.deposit" />
                    </div>
                    <div
                        onClick={() => changeAction("withdraw")}
                        className={cnames(
                            "button",
                            action === "withdraw" ? "active" : "outline"
                        )}
                    >
                        <Translate content="gateway.withdraw" />
                    </div>
                </div>

                {action === "deposit" ? _renderDeposits() : _renderWithdrawals()}
            </div>
        </div>
    );
}

interface XbtsFiatContainerProps {
    viewSettings: any;
    account: any;
    XbtsFiat?: string;
    asset?: string;
    provider?: string;
}

function XbtsFiatContainer({
    viewSettings,
    account,
    XbtsFiat: xbtsFiatAccountId = "1.2.1003283",
    asset: assetSymbol = "XBTSX.USD"
}: XbtsFiatContainerProps) {
    useChainStoreTick();
    const xbtsFiatAccount = (ChainStore as any).getAccount(xbtsFiatAccountId);
    const assetObject = (ChainStore as any).getAsset(assetSymbol);

    if (!xbtsFiatAccount || !assetObject) {
        return <span />;
    }

    return (
        <XbtsFiat
            viewSettings={viewSettings}
            account={account}
            XbtsFiat={xbtsFiatAccount}
            assetObject={assetObject}
        />
    );
}

export default XbtsFiatContainer;
