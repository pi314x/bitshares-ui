import React from "react";
import {Card, Button, Alert, Tooltip} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import WalletDb from "stores/WalletDb";
import ApplicationApi from "api/ApplicationApi";
import accountUtils from "common/account_utils";
import WalletUnlockActions from "actions/WalletUnlockActions";
import WalletUnlockStore from "stores/WalletUnlockStore";
import {connect} from "alt-react";
import {derivePQKey, accountPQKeys, canPublish} from "lib/common/PQKeys";

/**
 * The account's post-quantum key: show it, say whether the chain accepts it, and attach it.
 *
 * A classic key is 33 bytes and fits anywhere. An ML-DSA-65 key is 1952 bytes, which is
 * larger than the historical `maximum_transaction_size` of 2048 all by itself. Attaching one
 * therefore fails on a chain that has not raised that limit, and it fails with a size error
 * that says nothing about post-quantum anything. The panel checks first and explains, rather
 * than offering a button that cannot work.
 *
 * The key itself is derived from the wallet's root secret (see lib/common/PQKeys), so there
 * is nothing extra to write down: whatever restores the account restores this too.
 */
class AccountPQKey extends React.Component {
    state = {
        derived: null,
        deriveError: null,
        onChain: [],
        publishable: null,
        busy: false,
        error: null,
        done: null
    };

    componentDidMount() {
        this._refresh();
    }

    componentDidUpdate(prevProps) {
        // Auf den Sperrzustand zu horchen statt nur auf das eigene Unlock-Promise:
        // entsperrt der Nutzer ueber das Schloss in der Kopfzeile, muss der Schluessel
        // genauso erscheinen. Vorher blieb das Panel dann auf "gesperrt" stehen,
        // obwohl die Wallet offen war.
        if (
            prevProps.account !== this.props.account ||
            prevProps.wallet_locked !== this.props.wallet_locked
        ) {
            this._refresh();
        }
    }

    _refresh() {
        const {account} = this.props;
        if (!account) return;
        const name = account.get("name");
        const secret = WalletDb._rootSecret && WalletDb._rootSecret();
        let derived = null;
        let deriveError = null;
        if (secret) {
            // Ein Fehler hier ist ein Fehler im Code, keine gesperrte Wallet. Frueher
            // fing dieser Block beides ab und zeigte in beiden Faellen "entsperren" an --
            // ein echter Ableitungsfehler sah damit aus wie normaler Betrieb.
            try {
                const pq = derivePQKey(name, secret);
                derived = pq ? pq.toPublicKey().toPublicKeyString() : null;
            } catch (e) {
                deriveError = e && e.message ? e.message : String(e);
            }
        }
        this.setState({
            derived,
            deriveError,
            onChain: accountPQKeys(name)
        });
        canPublish().then(p => this.setState({publishable: p}));
    }

    _unlock = () => {
        WalletUnlockActions.unlock()
            .then(() => this._refresh())
            .catch(() => {
                // Abgebrochenes Entsperren ist kein Fehler, nur eine Entscheidung.
            });
    };

    _attach = () => {
        const {account} = this.props;
        const {derived} = this.state;
        if (!derived) return;
        this.setState({busy: true, error: null, done: null});

        // Append, never replace: the classic keys stay, so a mistake here cannot lock the
        // account out. Removing them is a separate, deliberate act.
        const active = account.get("active").toJS();
        active.pq_key_auths = (active.pq_key_auths || []).concat([
            [derived, 1]
        ]);

        // Derselbe Weg, den die Berechtigungsseite nebenan geht: account_update ueber
        // ApplicationApi, mit ausdruecklich gesetztem Gebuehren-Asset. Die frueher hier
        // gerufene AccountActions.updateAccount existiert nicht.
        ApplicationApi.updateAccount({
            account: account.get("id"),
            active,
            fee: {
                amount: 0,
                asset_id: accountUtils.getFinalFeeAsset(
                    account.get("id"),
                    "account_update"
                )
            }
        })
            .then(() => {
                this.setState({
                    busy: false,
                    done: counterpart.translate("account.pq.attached")
                });
                this._refresh();
            })
            .catch(err =>
                this.setState({
                    busy: false,
                    error: err && err.message ? err.message : String(err)
                })
            );
    };

    render() {
        const {account} = this.props;
        if (!account) return null;
        const {
            derived,
            deriveError,
            onChain,
            publishable,
            busy,
            error,
            done
        } = this.state;
        const alreadyAttached = derived && onChain.indexOf(derived) >= 0;

        return (
            <Card
                className="account-pq-key"
                title={counterpart.translate("account.pq.title")}
            >
                <Translate component="p" content="account.pq.explain" />

                {deriveError && <Alert type="error" message={deriveError} />}

                {!derived && !deriveError && (
                    <div className="futures-form-row">
                        <Alert
                            type="info"
                            message={counterpart.translate("account.pq.locked")}
                        />
                        {/* Die Ableitung braucht das Wurzelgeheimnis, das nur in einer
                            entsperrten Wallet vorliegt. Ohne diesen Knopf endet der
                            gesperrte Zustand in einer Sackgasse: der Hinweis sagt, was
                            fehlt, aber nicht, wo man es behebt. */}
                        <Button onClick={this._unlock}>
                            <Translate content="account.pq.unlock" />
                        </Button>
                    </div>
                )}

                {derived && (
                    <div className="futures-form-row">
                        <label>
                            <Translate content="account.pq.your_key" />
                        </label>
                        {/* 2676 characters. Shown in full rather than truncated: it is the
                            thing the user compares against the chain, and a shortened form
                            invites comparing the wrong halves. */}
                        <div
                            className="pq-key-block"
                            style={{
                                // 2676 Zeichen ohne Trennstellen: ohne Umbruch schiebt
                                // der Schluessel die ganze Seite seitlich aus dem Bild.
                                wordBreak: "break-all",
                                fontFamily: "monospace",
                                fontSize: "0.85em",
                                lineHeight: 1.4,
                                maxHeight: "9em",
                                overflowY: "auto",
                                padding: "0.5em",
                                border: "1px solid rgba(128,128,128,0.35)",
                                borderRadius: "3px"
                            }}
                        >
                            {derived}
                        </div>
                    </div>
                )}

                {onChain.length > 0 && (
                    <Alert
                        type={alreadyAttached ? "success" : "warning"}
                        message={counterpart.translate(
                            alreadyAttached
                                ? "account.pq.attached_already"
                                : "account.pq.foreign_key",
                            {count: onChain.length}
                        )}
                    />
                )}

                {publishable && !publishable.ok && (
                    <Alert
                        type="warning"
                        message={counterpart.translate(
                            "account.pq." + publishable.reason,
                            {limit: publishable.limit}
                        )}
                    />
                )}

                {error && <Alert type="error" message={error} />}
                {done && <Alert type="success" message={done} />}

                <Tooltip
                    title={
                        publishable && !publishable.ok
                            ? counterpart.translate("account.pq.cannot_attach")
                            : null
                    }
                >
                    <Button
                        type="primary"
                        disabled={
                            busy ||
                            !derived ||
                            alreadyAttached ||
                            !(publishable && publishable.ok)
                        }
                        onClick={this._attach}
                    >
                        <Translate content="account.pq.attach" />
                    </Button>
                </Tooltip>
            </Card>
        );
    }
}

export default connect(AccountPQKey, {
    listenTo() {
        return [WalletUnlockStore];
    },
    getProps() {
        return {
            wallet_locked: WalletUnlockStore.getState().locked
        };
    }
});
