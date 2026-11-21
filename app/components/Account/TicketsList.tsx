// The account's locks (tickets): what is locked, how, and when the chain changes it
// next; and for the account's own, the way to change a lock (ticket_update). Read
// from the node (`TicketActions.getByAccount`); nothing is kept in a store.
import * as React from "react";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import {Button} from "../../design-system/Button";
import {Select} from "../../design-system/Select";
import {Input} from "../../design-system/Input";
import FormattedAsset from "../Utility/FormattedAsset";
import {
    DialogField,
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import TicketActions from "../../actions/TicketActions";
import {
    Ticket,
    buildTicketUpdateOp,
    targetsFor
} from "../../lib/common/tickets";
import styles from "./TicketsList.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`voting.tickets.${key}`, params) as string;
const typeName = (type: number) =>
    counterpart.translate(`operation.ticket_types.${type}`) as string;

function assetOf(assetId: string): any {
    try {
        const asset: any = (ChainStore as any).getAsset(assetId);
        return asset && asset.get ? asset : null;
    } catch (e) {
        return null;
    }
}

/** "12.5" (human) -> "1250000" (smallest steps, text); null when not an amount. */
export function toStepsText(text: string, precision: number): string | null {
    const cleaned = text.trim().replace(",", ".");
    if (!/^\d+(\.\d*)?$/.test(cleaned)) return null;
    const [whole, fraction = ""] = cleaned.split(".");
    if (fraction.length > precision) return null;
    const digits = whole + fraction.padEnd(precision, "0");
    return digits.replace(/^0+(?=\d)/, "");
}

interface UpdateDialogProps {
    ticket: Ticket | null;
    onCancel: () => void;
    onDone: () => void;
}

function TicketUpdateDialog({ticket, onCancel, onDone}: UpdateDialogProps) {
    const visible = !!ticket;
    const [target, setTarget] = React.useState<number>(0);
    const [partText, setPartText] = React.useState("");
    const {submitting, error, run} = useOperationSubmit(
        visible,
        onDone,
        t("success")
    );

    React.useEffect(() => {
        if (!ticket) return;
        setTarget(targetsFor(ticket)[0]);
        setPartText("");
    }, [ticket]);

    if (!ticket) {
        return (
            <OperationDialog
                visible={false}
                title=""
                submitLabel=""
                canSubmit={false}
                submitting={false}
                error={null}
                onSubmit={() => {}}
                onCancel={onCancel}
            >
                {null}
            </OperationDialog>
        );
    }

    const asset = assetOf(ticket.assetId);
    const precision = asset ? asset.get("precision") : 5;
    const symbol = asset ? asset.get("symbol") : ticket.assetId;
    const partSteps =
        partText.trim() === "" ? null : toStepsText(partText, precision);
    const partError =
        partText.trim() !== "" &&
        (partSteps === null ||
            !buildTicketUpdateOp({
                ticket,
                targetType: target,
                amount: partSteps
            }))
            ? t("err_part")
            : null;
    const op = buildTicketUpdateOp({
        ticket,
        targetType: target,
        amount: partText.trim() === "" ? null : partSteps
    });

    const submit = () => {
        if (op) run(() => TicketActions.update(op));
    };

    return (
        <OperationDialog
            visible={visible}
            title={t("update_title", {id: ticket.id})}
            submitLabel={t("update_submit")}
            canSubmit={!!op && !partError}
            submitting={submitting}
            error={error}
            onSubmit={submit}
            onCancel={onCancel}
        >
            <DialogNote>{t("update_note")}</DialogNote>
            <DialogField label={t("update_target")}>
                <Select
                    value={String(target)}
                    onChange={v => setTarget(Number(v))}
                >
                    {targetsFor(ticket).map(type => (
                        <Select.Option key={type} value={String(type)}>
                            {typeName(type)}
                        </Select.Option>
                    ))}
                </Select>
            </DialogField>
            <DialogField
                label={t("update_part", {symbol})}
                help={t("update_part_help")}
                error={partError}
            >
                <Input
                    value={partText}
                    inputMode="decimal"
                    placeholder={t("update_all")}
                    onChange={e => setPartText(e.target.value)}
                />
            </DialogField>
        </OperationDialog>
    );
}

export interface TicketsListProps {
    /** the account's name or id */
    account: string;
    /** the signed-in account may change the locks of this one */
    canChange: boolean;
}

export default function TicketsList({account, canChange}: TicketsListProps) {
    const [tickets, setTickets] = React.useState<Ticket[] | null>(null);
    const [updating, setUpdating] = React.useState<Ticket | null>(null);
    const [reload, setReload] = React.useState(0);

    React.useEffect(() => {
        let cancelled = false;
        TicketActions.getByAccount(account)
            .then(rows => {
                if (!cancelled) setTickets(rows);
            })
            .catch(() => {
                if (!cancelled) setTickets([]);
            });
        return () => {
            cancelled = true;
        };
    }, [account, reload]);

    if (!tickets || !tickets.length) return null;

    return (
        <section className={styles.card} aria-label={t("title")}>
            <h3 className={styles.title}>{t("title")}</h3>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>{t("col_ticket")}</th>
                        <th className={styles.right}>{t("col_amount")}</th>
                        <th>{t("col_type")}</th>
                        <th>{t("col_status")}</th>
                        <th>{t("col_next")}</th>
                        {canChange ? <th /> : null}
                    </tr>
                </thead>
                <tbody>
                    {tickets.map(ticket => (
                        <tr key={ticket.id}>
                            <td className={styles.mono}>{ticket.id}</td>
                            <td className={styles.right}>
                                <FormattedAsset
                                    amount={Number(ticket.amount)}
                                    asset={ticket.assetId}
                                />
                            </td>
                            <td>
                                {typeName(ticket.currentType)}
                                {ticket.targetType !== ticket.currentType ? (
                                    <span className={styles.muted}>
                                        {" "}
                                        → {typeName(ticket.targetType)}
                                    </span>
                                ) : null}
                            </td>
                            <td>{t(`status_${ticket.status}`)}</td>
                            <td className={styles.mono}>
                                {ticket.nextUpdate
                                    ? ticket.nextUpdate.replace("T", " ")
                                    : "-"}
                            </td>
                            {canChange ? (
                                <td className={styles.right}>
                                    <Button
                                        size="small"
                                        onClick={() => setUpdating(ticket)}
                                    >
                                        {t("change")}
                                    </Button>
                                </td>
                            ) : null}
                        </tr>
                    ))}
                </tbody>
            </table>
            <TicketUpdateDialog
                ticket={updating}
                onCancel={() => setUpdating(null)}
                onDone={() => {
                    setUpdating(null);
                    setReload(n => n + 1);
                }}
            />
        </section>
    );
}
