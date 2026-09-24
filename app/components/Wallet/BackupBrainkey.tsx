// TypeScript/functional-component port of the legacy BackupBrainkey.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
// Security-sensitive per AGENTS.md: this screen exists specifically to
// reveal the account's brainkey after password verification -
// `WalletDb.getBrainKey()`'s result is held only in this component's own
// local state (same as the original), displayed to the user, never
// logged or persisted beyond that. `WalletDb` itself stays a plain `.js`
// module for now (ported separately, with characterization tests, later
// in this phase) and is imported here exactly as before.
import * as React from "react";
import {FormattedDate} from "react-intl";
import Translate from "react-translate-component";
import WalletActions from "actions/WalletActions";
import WalletDb from "stores/WalletDb";
import {hash} from "bitsharesjs";
import {Card, Input, Button, Notification} from "bitshares-ui-style-guide";
import counterpart from "counterpart";

export default function BackupBrainkey() {
    const [password, setPassword] = React.useState<string | null>(null);
    const [brainkey, setBrainkey] = React.useState<string | null>(null);
    const [verified, setVerified] = React.useState(false);

    const reset = (e?: any) => {
        if (e) {
            e.preventDefault();
        }
        setPassword(null);
        setBrainkey(null);
        setVerified(false);
    };

    const onSubmit = (e: any) => {
        e.preventDefault();
        const was_locked = (WalletDb as any).isLocked();
        const {success} = (WalletDb as any).validatePassword(password, true);
        if (success) {
            const newBrainkey = (WalletDb as any).getBrainKey();
            if (was_locked) (WalletDb as any).onLock();
            setBrainkey(newBrainkey);
        } else {
            (Notification as any).error({
                message: counterpart.translate("notifications.invalid_password")
            });
        }
    };

    const onComplete = () => {
        setVerified(true);
        (WalletActions as any).setBrainkeyBackupDate();
    };

    const onPassword = (event: any) => {
        setPassword(event.target.value);
    };

    let content;
    const brainkey_backup_date = (WalletDb as any).getWallet()
        .brainkey_backup_date;

    const brainkey_backup_time = brainkey_backup_date ? (
        <div>
            <Translate content="wallet.brainkey_backed_up" />:{" "}
            <FormattedDate value={brainkey_backup_date} />
        </div>
    ) : (
        <Translate
            className="facolor-error"
            component="p"
            content="wallet.brainkey_not_backed_up"
        />
    );

    if (verified) {
        const sha1 = (hash as any)
            .sha1(brainkey)
            .toString("hex")
            .substring(0, 4);
        content = (
            <div>
                <h3>
                    <Translate content="wallet.brainkey" />
                </h3>
                <Card>{brainkey}</Card>
                <br />
                <pre className="no-overflow">
                    sha1 hash of the brainkey: {sha1}
                </pre>
                <br />
                {brainkey_backup_time}
            </div>
        );
    }

    if (!content && brainkey) {
        const sha1 = (hash as any)
            .sha1(brainkey)
            .toString("hex")
            .substring(0, 4);
        content = (
            <span>
                <h3>
                    <Translate content="wallet.brainkey" />
                </h3>
                <Card>{brainkey}</Card>
                <div style={{padding: "10px 0"}}>
                    <pre className="no-overflow">
                        sha1 hash of your brainkey: {sha1}
                    </pre>
                </div>
                <hr />
                <div style={{padding: "10px 0 20px 0"}}>
                    <Translate content="wallet.brainkey_w1" />
                    <br />
                    <Translate content="wallet.brainkey_w2" />
                    <br />
                    <Translate content="wallet.brainkey_w3" />
                </div>

                <Button type={"primary"} onClick={onComplete}>
                    <Translate content="wallet.verify" />
                </Button>
                <Button type={"default"} onClick={reset}>
                    <Translate content="wallet.cancel" />
                </Button>
            </span>
        );
    }

    if (!content) {
        content = (
            <span>
                <label>
                    <Translate content="wallet.enter_password" />
                </label>
                <form onSubmit={onSubmit} className="name-form" noValidate>
                    <Input
                        type="password"
                        id="password"
                        onChange={onPassword}
                    />
                    <div>
                        {brainkey_backup_time}
                        <br />
                    </div>
                    <Button type="primary" onClick={onSubmit}>
                        <Translate content="wallet.show_brainkey" />
                    </Button>
                </form>
            </span>
        );
    }
    return (
        <div className="grid-block vertical">
            <div className="grid-content no-overflow">{content}</div>
        </div>
    );
}
