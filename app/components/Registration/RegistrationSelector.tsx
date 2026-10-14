// TypeScript/functional-component port of the legacy
// RegistrationSelector.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear; this component only toggles a local "which registration
// path is highlighted" UI state and delegates navigation to react-router.
//
// Rendered via `<Route path="/registration" exact
// component={RegistrationSelector} />` in `App.jsx` (react-router-dom v5),
// which injects `history`/`location`/`match` as props - `props.history
// .push(...)` is real, not dead.
//
// Dropped as confirmed dead (grepped): `static contextTypes = {router:
// PropTypes.object.isRequired}` - the legacy React context API - `this
// .context` is never read anywhere in the file. Has no hooks/functional
// equivalent need since it was never used.
//
// `props.children`'s early-return branch is never actually exercised by
// the one real call site above (`<Route component={...}>` never supplies
// `children`), but it's a real conditional gated on a real, explicitly
// typed prop (with its own default), so it's kept as-is rather than
// treated as dead code - unlike the `contextTypes` case, nothing here
// prevents `children` from someday being passed by a different caller.
import * as React from "react";
import counterpart from "counterpart";
import {Button} from "../../design-system/Button";
import {Tooltip} from "../../design-system/Tooltip";
import styles from "./RegistrationSelector.module.scss";

interface RegistrationSelectorProps {
    children?: React.ReactElement | null;
    history: {push: (path: string) => void};
}

const t = (key: string) => counterpart.translate(key) as string;

interface Model {
    route: string;
    title: string;
    subtitle: string;
    help: string;
    recommended: boolean;
    rows: Array<{
        label: string;
        value: string;
        tone?: "good" | "fair" | "none";
    }>;
}

// The two ways to hold an account, side by side: what each one is, what it
// guarantees, and the way to go on with it. (It used to be one card at a time
// in focus, the other greyed out, with a "Select" that only moved the focus.)
export default function RegistrationSelector({
    children = null,
    history
}: RegistrationSelectorProps) {
    if (children) {
        return children;
    }

    const models: Model[] = [
        {
            route: "local",
            title: t("registration.walletModelTitle"),
            subtitle: t("wallet.wallet_model"),
            help: t("tooltip.registration.walletModel"),
            recommended: true,
            rows: [
                {
                    label: t("registration.securityKey"),
                    value: t("registration.securityWalletModel"),
                    tone: "good"
                },
                {
                    label: t("registration.loginByKey"),
                    value: t("registration.walletLoginByValue")
                },
                {
                    label: t("registration.backUpRestoreKey"),
                    value: t("settings.yes"),
                    tone: "good"
                }
            ]
        },
        {
            route: "cloud",
            title: t("registration.accountModelTitle"),
            subtitle: t("wallet.password_model"),
            help: t("tooltip.registration.accountModel"),
            recommended: false,
            rows: [
                {
                    label: t("registration.securityKey"),
                    value: t("registration.securityAccountModel"),
                    tone: "fair"
                },
                {
                    label: t("registration.loginByKey"),
                    value: t("registration.accountLoginByValue")
                },
                {
                    label: t("registration.backUpRestoreKey"),
                    value: t("settings.no"),
                    tone: "none"
                }
            ]
        }
    ];

    return (
        <div className={`registration-layout ${styles.page}`}>
            <h1 className={styles.title}>{t("registration.title")}</h1>
            <div className={styles.cards}>
                {models.map(model => (
                    <section className={styles.card} key={model.route}>
                        <div className={styles.head}>
                            <div className={styles.names}>
                                <h2 className={styles.name}>{model.title}</h2>
                                <span className={styles.kind}>
                                    {model.subtitle}
                                </span>
                            </div>
                            {model.recommended ? (
                                <span className={styles.badge}>
                                    {t("registration.recommended")}
                                </span>
                            ) : null}
                        </div>
                        <dl className={styles.rows}>
                            {model.rows.map(row => (
                                <div className={styles.row} key={row.label}>
                                    <dt>{row.label}</dt>
                                    <dd
                                        className={
                                            row.tone ? styles[row.tone] : ""
                                        }
                                    >
                                        {row.value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <div className={styles.foot}>
                            {model.help ? (
                                <Tooltip title={model.help}>
                                    <span className={styles.helpLabel}>
                                        {t("registration.whats_this")}
                                    </span>
                                </Tooltip>
                            ) : (
                                <span />
                            )}
                            <Button
                                variant={
                                    model.recommended ? "accent" : "default"
                                }
                                onClick={() =>
                                    history.push(`/registration/${model.route}`)
                                }
                            >
                                {t("registration.continue")}
                            </Button>
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
