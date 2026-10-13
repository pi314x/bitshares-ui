// Spotlight: the hub for the features that have no menu entry of their own
// (docs/UI_MIGRATION_PLAN.md §7.13/§7.14). Each tile is a real link or button,
// grouped by purpose, with the reason spelled out when it is not available
// ("Log in to use this", "Coming soon") instead of a hover-only tooltip.
//
// What changed against the class-era grid it replaces: tiles are `<a>`/
// `<button>` (keyboard, middle-click and "open in new tab" work), the layout is
// a responsive CSS grid in a CSS Module instead of fixed-height tiles in the
// global theme sheet, strings come from the locale files, and the account is
// read on every chain update (`useChainStoreTick`) so the tiles enable as soon
// as it has loaded. The old code looked it up once and tested `!== null`, which
// is also true for `undefined` ("not loaded yet"), so a tile could be live
// before its account existed.
//
// Not security-sensitive: this only navigates. The one action, the paper
// wallet, calls the unchanged `createPaperWalletAsPDF(account)` (it prints the
// account's keys only if the wallet is already unlocked) and nothing here reads
// or stores a key.
import * as React from "react";
import {Link} from "react-router-dom";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import {createPaperWalletAsPDF} from "common/paperWallet";
import Icon from "../Icon/Icon";
import {Alert} from "../../design-system/Alert";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import styles from "./ShowcaseGrid.module.scss";

type GroupId = "trade" | "payments" | "account";

interface Tile {
    id: string;
    /** key under `showcases.` in the locale files (`.title`, `.description`) */
    locale: string;
    icon: string;
    group: GroupId;
    /** route, or a function of the account's name for account-specific routes */
    to?: string | ((accountName: string) => string);
    /** an action instead of a route */
    onSelect?: (account: any) => void;
}

export const TILES: Tile[] = [
    {
        id: "instant_trade",
        locale: "instant_trade",
        icon: "instant-trade",
        group: "trade",
        to: "/instant-trade"
    },
    {
        id: "prediction_market",
        locale: "prediction_market",
        icon: "prediction",
        group: "trade",
        to: "/prediction"
    },
    {
        id: "borrow",
        locale: "borrow",
        icon: "borrow",
        group: "trade",
        to: "/borrow"
    },
    {
        id: "barter",
        locale: "barter",
        icon: "barter",
        group: "trade",
        to: "/barter"
    },
    {
        id: "merchant_protocol",
        locale: "merchant_protocol",
        icon: "merchant",
        group: "payments",
        to: "/invoice/request"
    },
    {
        id: "direct_debit",
        locale: "direct_debit",
        icon: "direct_debit",
        group: "payments",
        to: "/direct-debit"
    },
    {
        id: "htlc",
        locale: "htlc",
        icon: "htlc",
        group: "payments",
        to: "/htlc"
    },
    {
        id: "timed_transfer",
        locale: "timed_transfer",
        icon: "alarm",
        group: "payments",
        to: "/timed-transfer"
    },
    {
        id: "voting",
        locale: "voting",
        icon: "voting",
        group: "account",
        to: name => `/account/${name}/voting`
    },
    {
        id: "paper_wallet",
        locale: "paper_wallet",
        icon: "wallet",
        group: "account",
        onSelect: account => (createPaperWalletAsPDF as any)(account)
    }
];

const GROUPS: GroupId[] = ["trade", "payments", "account"];

const t = (key: string) => counterpart.translate(key) as string;

function TileBody({tile, badge}: {tile: Tile; badge?: string}) {
    return (
        <>
            <span className={styles.chip} aria-hidden="true">
                <Icon name={tile.icon} size="2x" />
            </span>
            <span className={styles.text}>
                <span className={styles.titleRow}>
                    <span className={styles.name}>
                        {t(`showcases.${tile.locale}.title`)}
                    </span>
                    {badge && <span className={styles.badge}>{badge}</span>}
                </span>
                <span className={styles.description}>
                    {t(`showcases.${tile.locale}.description`)}
                </span>
            </span>
        </>
    );
}

function SpotlightTile({tile, account}: {tile: Tile; account: any}) {
    if (!account) {
        return (
            <div
                className={`${styles.card} ${styles.disabled}`}
                aria-disabled="true"
                data-testid={`tile-${tile.id}`}
            >
                <TileBody tile={tile} badge={t("showcases.login_badge")} />
            </div>
        );
    }
    if (tile.onSelect) {
        const onSelect = tile.onSelect;
        return (
            <button
                type="button"
                className={styles.card}
                onClick={() => onSelect(account)}
                data-testid={`tile-${tile.id}`}
            >
                <TileBody tile={tile} />
            </button>
        );
    }
    const to =
        typeof tile.to === "function"
            ? tile.to(account.get("name"))
            : (tile.to as string);
    return (
        <Link className={styles.card} to={to} data-testid={`tile-${tile.id}`}>
            <TileBody tile={tile} />
        </Link>
    );
}

export default function ShowcaseGrid() {
    const accountState = useReduxState<any>(selectAccountState);
    const currentAccount =
        accountState.currentAccount || accountState.passwordAccount;
    useChainStoreTick(); // re-read the account once the chain has delivered it
    // `undefined` = not loaded yet, `null` = does not exist; either way: no account
    const account = currentAccount
        ? (ChainStore as any).getAccount(currentAccount) || null
        : null;

    return (
        <div className={styles.page}>
            <header className={styles.head}>
                <h1 className={styles.heading}>{t("header.showcases")}</h1>
                <p className={styles.intro}>{t("showcases.intro")}</p>
            </header>

            {!account && (
                <div className={styles.notice} role="status">
                    <Alert
                        type="info"
                        showIcon
                        message={t("showcases.login_required")}
                    />
                </div>
            )}

            {GROUPS.map(group => (
                <section className={styles.group} key={group}>
                    <h2 className={styles.groupTitle}>
                        {t(`showcases.group_${group}`)}
                    </h2>
                    <div className={styles.grid}>
                        {TILES.filter(tile => tile.group === group).map(
                            tile => (
                                <SpotlightTile
                                    key={tile.id}
                                    tile={tile}
                                    account={account}
                                />
                            )
                        )}
                    </div>
                </section>
            ))}
        </div>
    );
}
