// TypeScript/functional-component port of the legacy MemoText.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md, in one spot: `PrivateKeyStore
// .decodeMemo(memo)` decrypts the memo using the caller's private key
// (internally via `WalletDb.decryptTcomb_PrivateKey`, inside
// `PrivateKeyStore` itself, not in this file). That call is transcribed
// verbatim, and its result (`text`) is only ever rendered to the DOM,
// never logged - matching the original. `_toggleLock`'s
// `WalletUnlockActions.unlock()` call (prompting for the wallet
// password) is likewise transcribed verbatim and never touches the
// password/decrypted text itself.
//
// Two original classes:
//
// - `MemoText`: `shouldComponentUpdate` (comparing `memo` via
//   `utils.are_equal_shallow` and `wallet_locked`) is a pure boolean
//   performance guard, no side effects - dropped entirely per this
//   migration's convention, since a function component simply
//   re-renders on every prop change, a superset of what the guard let
//   through. `wallet_locked` itself was *only* ever read inside that
//   dropped guard (grep-confirmed: no other reference in the file) -
//   confirmed dead as a value, so it isn't forwarded into this Core at
//   all; the re-render it existed to trigger (so `decodeMemo(memo)`
//   gets recomputed right after a wallet unlock, even though `memo`
//   itself never changes) is achieved instead by `MemoTextContainer`
//   simply re-rendering on every `WalletUnlockStore` change (via
//   `useAltStore`), which unconditionally re-invokes this Core with a
//   fresh render, no prop needed to carry that signal. `componentDidMount`
//   (`ReactTooltip.rebuild()`) becomes a mount-only `useEffect`, called
//   unconditionally before any early return, per React's rules of hooks
//   (the class's lifecycle method ran regardless of what `render()`
//   returned that pass; a hook must be called on every render for the
//   same reason, so it's placed first, ahead of the `!memo` guard).
//
// - `MemoTextStoreWrapper`: was a trivial one-line wrapper whose only
//   purpose was to be the thing `connect()` wraps (alt-react's
//   `connect()` needs a component to inject store-derived props into) -
//   it added no behavior of its own, so it collapses into
//   `MemoTextContainer` below rather than being kept as a second,
//   pointless layer.
import * as React from "react";
import PrivateKeyStore from "stores/PrivateKeyStore";
import WalletUnlockActions from "actions/WalletUnlockActions";
import counterpart from "counterpart";
import Icon from "../Icon/Icon";
import WalletUnlockStore from "stores/WalletUnlockStore";
import utils from "common/utils";
import ReactTooltip from "react-tooltip";
import {Tooltip} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

interface MemoTextCoreProps {
    memo?: any;
    fullLength?: boolean;
}

function MemoText({memo, fullLength = false}: MemoTextCoreProps) {
    React.useEffect(() => {
        ReactTooltip.rebuild();
    }, []);

    const toggleLock = (e: React.MouseEvent) => {
        e.preventDefault();
        (WalletUnlockActions as any)
            .unlock()
            .then(() => {
                ReactTooltip.rebuild();
            })
            .catch(() => {});
    };

    if (!memo) {
        return null;
    }

    const decoded = (PrivateKeyStore as any).decodeMemo(memo);
    let text = decoded.text;
    const isMine = decoded.isMine;

    if (!text && isMine) {
        return (
            <div className="memo">
                <span>
                    {counterpart.translate("transfer.memo_unlock")}{" "}
                </span>
                <a onClick={toggleLock}>
                    <Icon name="locked" title="icons.locked.action" />
                </a>
            </div>
        );
    }

    text = utils.sanitize(text);

    const full_memo = text;
    if (text && !fullLength && text.length > 35) {
        text = text.substr(0, 35) + "...";
    }

    if (text) {
        return (
            <div className="memo" style={{paddingTop: 5, cursor: "help"}}>
                <Tooltip
                    placement="bottom"
                    title={full_memo !== text ? full_memo : null}
                >
                    <span
                        className="inline-block"
                        data-class="memo-tip"
                        data-offset="{'bottom': 10}"
                    >
                        {text}
                    </span>
                </Tooltip>
            </div>
        );
    } else {
        return null;
    }
}

interface MemoTextContainerProps {
    memo?: any;
    fullLength?: boolean;
}

function MemoTextContainer(props: MemoTextContainerProps) {
    useAltStore<any>(WalletUnlockStore);
    return <MemoText {...props} />;
}

export default MemoTextContainer;
