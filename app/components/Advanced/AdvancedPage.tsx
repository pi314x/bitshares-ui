// Advanced operations: the operations of the chain that have no screen of their own in
// the rest of the application - handing an account over, custom authorities, data and
// assertions in a transaction, an issuer moving a balance, the committee's own, flash
// loans, blind transfers - and a screen that takes any operation as JSON. Each card says
// what the operation does, who can use it and what the chain calls it; the dialogs check
// the chain's rules before a wallet prompt.
import * as React from "react";
import {Button} from "../../design-system/Button";
import AccountTransferDialog from "./AccountTransferDialog";
import AssertDialog from "./AssertDialog";
import BlindTransferDialog from "./BlindTransferDialog";
import ChainParametersDialog from "./ChainParametersDialog";
import CommitteeMemberDialog from "./CommitteeMemberDialog";
import CustomAuthoritiesDialog from "./CustomAuthoritiesDialog";
import CustomDataDialog from "./CustomDataDialog";
import FlashLoanDialog from "./FlashLoanDialog";
import OperationJsonDialog from "./OperationJsonDialog";
import OverrideTransferDialog from "./OverrideTransferDialog";
import {t, useCurrentAccount} from "./fields";
import styles from "./Advanced.module.scss";

interface Card {
    id: string;
    /** the operations of the chain behind it, by name */
    names: string;
    Dialog: React.ComponentType<{onCancel: () => void; onDone: () => void}>;
}

const SECTIONS: Array<{id: string; cards: Card[]}> = [
    {
        id: "account",
        cards: [
            {
                id: "custom_authorities",
                names: "custom_authority_create / _update / _delete",
                Dialog: CustomAuthoritiesDialog as any
            },
            {
                id: "custom",
                names: "custom",
                Dialog: CustomDataDialog
            },
            {
                id: "assert",
                names: "assert",
                Dialog: AssertDialog
            },
            {
                id: "account_transfer",
                names: "account_transfer",
                Dialog: AccountTransferDialog
            }
        ]
    },
    {
        id: "assets",
        cards: [
            {
                id: "override",
                names: "override_transfer",
                Dialog: OverrideTransferDialog
            }
        ]
    },
    {
        id: "committee",
        cards: [
            {
                id: "committee_member",
                names: "committee_member_update",
                Dialog: CommitteeMemberDialog
            },
            {
                id: "parameters",
                names: "committee_member_update_global_parameters",
                Dialog: ChainParametersDialog
            }
        ]
    },
    {
        id: "lending",
        cards: [
            {
                id: "flash",
                names: "samet_fund_borrow + samet_fund_repay",
                Dialog: FlashLoanDialog
            }
        ]
    },
    {
        id: "confidential",
        cards: [
            {
                id: "blind",
                names:
                    "transfer_to_blind / blind_transfer / transfer_from_blind",
                Dialog: BlindTransferDialog
            }
        ]
    },
    {
        id: "any",
        cards: [
            {
                id: "json",
                names: "any",
                Dialog: OperationJsonDialog
            }
        ]
    }
];

export default function AdvancedPage() {
    const me = useCurrentAccount();
    const [open, setOpen] = React.useState<string | null>(null);
    const cards = SECTIONS.flatMap(section => section.cards);
    const active = cards.find(card => card.id === open);
    const close = () => setOpen(null);

    return (
        <div className={styles.page}>
            <p className={styles.intro}>
                {me.name
                    ? t("page.intro", {name: me.name})
                    : t("page.intro_no_account")}
            </p>
            {SECTIONS.map(section => (
                <div className={styles.section} key={section.id}>
                    <h3 className={styles.sectionTitle}>
                        {t(`page.section_${section.id}`)}
                    </h3>
                    <div className={styles.grid}>
                        {section.cards.map(card => (
                            <div className={styles.card} key={card.id}>
                                <h4 className={styles.cardTitle}>
                                    {t(`cards.${card.id}.title`)}
                                </h4>
                                <p className={styles.cardText}>
                                    {t(`cards.${card.id}.text`)}
                                </p>
                                <p className={styles.cardMeta}>{card.names}</p>
                                <div className={styles.cardFoot}>
                                    <Button
                                        disabled={!me.name}
                                        onClick={() => setOpen(card.id)}
                                    >
                                        {t(`cards.${card.id}.open`)}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            {active ? <active.Dialog onCancel={close} onDone={close} /> : null}
        </div>
    );
}
