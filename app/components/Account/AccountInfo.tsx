// TypeScript/functional-component port of the legacy AccountInfo.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(AccountInfo)` HOC (resolving the required `account`
// prop via `ChainStore.getAccount`) is replaced by a Container under
// `useChainStoreTick()`, per this migration's established pattern.
import * as React from "react";
import AccountImage from "./AccountImage";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import Translate from "react-translate-component";
import QRCode from "qrcode.react";

interface AccountInfoCoreProps {
    account: any;
    title?: string | null;
    image_size?: {height: number; width: number};
    my_account?: boolean;
    showQR?: boolean;
    titleClass?: string;
    toggleQR?: (next: boolean) => void;
}

function AccountInfo({
    account,
    title = null,
    image_size = {height: 120, width: 120},
    my_account,
    showQR = false,
    titleClass = "account-title",
    toggleQR
}: AccountInfoCoreProps) {
    const [hover, setHover] = React.useState(false);

    const isLTM = account.get("lifetime_referrer_name") === account.get("name");

    const QR = (
        <div className="account-image">
            <QRCode size={image_size.width} value={account.get("name")} />
        </div>
    );

    const qrState = !hover ? showQR : !showQR;

    return (
        <div
            style={{maxWidth: image_size.width}}
            className={"account-info" + (my_account ? " my-account" : "")}
        >
            {title ? <h4>{title}</h4> : null}
            <div
                onMouseEnter={() => {
                    setHover(true);
                }}
                onMouseLeave={() => {
                    setHover(false);
                }}
                className="clickable"
                onClick={() => {
                    setHover(false);
                    if (toggleQR) toggleQR(!showQR);
                }}
            >
                {qrState ? (
                    QR
                ) : (
                    <AccountImage
                        size={image_size}
                        account={account.get("name")}
                        custom_image={null}
                    />
                )}
            </div>
            <p>
                <Translate content="account.deposit_address" />!
            </p>
            <p className={titleClass}>
                <span className={isLTM ? "lifetime" : ""}>
                    {account.get("name")}
                </span>
            </p>
            {/* <div className="secondary">
                <span className="subheader">#{display_id}</span>
                {this.props.my_account ? <span className="my-account-label"><Translate content="account.mine" /></span> : null}
            </div> */}
        </div>
    );
}

interface AccountInfoProps extends Omit<AccountInfoCoreProps, "account"> {
    account: string;
}

function AccountInfoContainer({account, ...rest}: AccountInfoProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account, false);

    if (!resolvedAccount) {
        return <span />;
    }

    return <AccountInfo {...rest} account={resolvedAccount} />;
}

export default AccountInfoContainer;
