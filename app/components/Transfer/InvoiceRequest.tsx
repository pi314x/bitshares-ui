// TypeScript/functional-component port of the legacy InvoiceRequest.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Preserved verbatim (not "fixed"): the original's
// `UNSAFE_componentWillReceiveProps(nextProps)` reads `this.props
// .currentAccount` - the *previous* render's props, not `nextProps
// .currentAccount` - so it re-applies whatever `currentAccount` was
// already there rather than the incoming one. In practice this is inert:
// `componentDidMount` already sets `recipient_name` from the (already
// chain-state-loaded, since `Invoice.jsx`'s `bindToCurrentAccount` gates
// rendering on that) `currentAccount` on mount, so `recipient_name` is
// never actually `null` by the time this would run. Replicated with a
// `prevCurrentAccountRef` updated *after* being read, so this render
// sees the previous render's value exactly like `this.props` did.
//
// Dropped as confirmed dead: the `invoice` state field (set to `null` in
// the constructor, never read or written anywhere else). `defaultAssets`
// is hoisted to a module-level constant rather than kept in `useState`,
// since the original never updates it either - a static list masquerading
// as state.
//
// UPDATE (call-site migration, docs/UI_MIGRATION_PLAN.md §7.1): moved
// off `bitshares-ui-style-guide` and off antd's managed-form API
// (`Form.create()`/`getFieldDecorator`/`validateFields`/`setFieldsValue`)
// entirely, onto the design-system `Form` (built as a layout primitive
// only, not a managed-form replacement - see its own header comment) and
// plain local state. `memo`/`toLabel`/`note` replace the 3 scalar
// `getFieldDecorator`-wired fields 1:1, each a controlled `Input`/
// `Input.TextArea`. `keys`/`lineItems` replace antd's dynamic-field-list
// pattern (`line_items[${k}]label`-style bracket-path field names,
// antd's own mechanism for building a nested array from flat field
// names) with the equivalent plain shape directly: `keys: number[]`
// (same role as the original `form`'s own "keys" field - the live line-
// item row ids) and `lineItems: Record<number, {label, quantity,
// price}>` (keyed by that same row id, replacing the auto-built nested
// object antd's bracket-path syntax produced). `add`/`remove` now call
// `setKeys` directly instead of `form.setFieldsValue({keys: ...})`.
//
// `hasErrors()` previously read `form.getFieldsValue(["line_items",
// "memo", "keys"])` and iterated its 3 keys - inspection showed the
// `"keys"` branch was always inert (`!values.keys` on a non-empty array
// is always `false`, so it never contributed an error), and `note`/
// `to_label` were never included in that field list at all, i.e. never
// actually required for the submit button to enable. Replicated exactly
// (not widened to also require `note`/`to_label`): only `memo` and every
// live `line_items` entry's `label`/`quantity`/`price` gate `hasErrors`.
//
// `handleSubmit` previously ran everything inside `form.validateFields`'s
// callback, gated on `!err` - but no field anywhere had a `rules` option
// passed to `getFieldDecorator` (none of the decorator calls take a
// second argument), so antd had nothing to actually validate and `err`
// was always `null`/falsy in practice. Replicated by just always running
// the body directly (the submit button is independently disabled by
// `hasErrors()` already, exactly as before).
//
// `Form`'s `required={true}` prop is dropped: not a real antd `Form`
// prop (antd's own `Form` never had one; `required` is an *input*-level
// HTML attribute, not a form-level one) and confirmed inert under antd
// too. `Button`'s antd-only `htmlType="submit"` becomes this component's
// native `type="submit"` (`Button.type` already is the real HTML button
// type here, unlike antd which overloads a separate `type` prop for
// visual variant - see `variant="accent"` below).
import * as React from "react";
import {ChainStore} from "bitsharesjs";
import AccountSelector from "../Account/AccountSelector";
import AssetSelect from "../Utility/AssetSelect";
import {compress} from "lzma";
import bs58 from "common/base58";
import Translate from "react-translate-component";
import {Button} from "../../design-system/Button";
import {Row} from "../../design-system/Row";
import {Col} from "../../design-system/Col";
import {Form} from "../../design-system/Form";
import {Input} from "../../design-system/Input";
import {Tooltip} from "../../design-system/Tooltip";
import {Icon} from "../../design-system/Icon";
import counterpart from "counterpart";
import CopyButton from "../Utility/CopyButton";

let id = 1;

const DEFAULT_ASSETS = [
    "BTS",
    "CNY",
    "USD",
    "XBTSX.USDT",
    "HONEST.USD",
    "GDEX.USDT",
    "HONEST.CNY",
    "URTHR",
    "SKULD",
    "VERTHANDI",
    "HERTZ"
];

interface LineItem {
    label: string;
    quantity: string;
    price: string;
}

interface InvoiceRequestProps {
    currentAccount: any;
    validateFormat: (invoice: any) => boolean;
    [key: string]: any;
}

export default function InvoiceRequest({
    currentAccount,
    validateFormat
}: InvoiceRequestProps) {
    const [invoiceData, setInvoiceData] = React.useState<string | null>(null);
    const [recipientName, setRecipientName] = React.useState<string | null>(
        null
    );
    const [, setRecipientNameAccount] = React.useState<any>(null);
    const [currency, setCurrency] = React.useState("BTS");

    const [memo, setMemo] = React.useState("");
    const [toLabel, setToLabel] = React.useState("");
    const [note, setNote] = React.useState("");
    const [keys, setKeys] = React.useState<number[]>([0]);
    const [lineItems, setLineItems] = React.useState<
        Record<number, LineItem>
    >({});

    // Mirrors componentDidMount exactly (runs after the first paint, so
    // the same brief "empty recipient" flash the original had on mount
    // is preserved too).
    React.useEffect(() => {
        setRecipientName(currentAccount.get("name"));
        // eslint-disable-next-line
    }, []);

    const prevCurrentAccountRef = React.useRef(currentAccount);
    const isFirstRenderRef = React.useRef(true);
    if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
    } else {
        if (recipientName == null && prevCurrentAccountRef.current) {
            setRecipientName(prevCurrentAccountRef.current.get("name"));
        }
    }
    prevCurrentAccountRef.current = currentAccount;

    const _printInvoice = (invoice: any) => {
        if (validateFormat(invoice)) {
            (compress as any)(JSON.stringify(invoice), 9, (result: any) => {
                const newInvoiceData = (bs58 as any).encode(
                    Buffer.from(result)
                );
                setInvoiceData(newInvoiceData);
                console.log("Invoice data", invoice, newInvoiceData);
            });
        }
    };

    const fromChanged = (newRecipientName: string) => {
        setRecipientName(newRecipientName);
        setRecipientNameAccount(null);
    };

    const onFromAccountChanged = (newRecipientNameAccount: any) => {
        setRecipientNameAccount(newRecipientNameAccount);
    };

    const updateLineItem = (
        k: number,
        field: keyof LineItem,
        value: string
    ) => {
        setLineItems(prev => ({
            ...prev,
            [k]: {...prev[k], [field]: value} as LineItem
        }));
    };

    const hasErrors = () => {
        const lineItemsError = keys.some(k => {
            const item = lineItems[k];
            return !item || !item.label || !item.price || !item.quantity;
        });

        return !memo || lineItemsError || !recipientName;
    };

    const remove = (k: number) => {
        if (keys.length === 1) {
            return;
        }
        setKeys(keys.filter(key => key !== k));
    };

    const add = () => {
        setKeys([...keys, id++]);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const line_items = keys
            .map(k => lineItems[k])
            .filter(item => !!item);
        _printInvoice({
            currency,
            line_items,
            memo,
            note,
            to: recipientName,
            to_label: toLabel
        });
    };

    const onChangeCurrency = (e: any) => {
        const asset = (ChainStore as any).getAsset(e);
        setCurrency(asset.get("symbol"));
    };

    const formItems = (
        <React.Fragment>
            <Row style={{marginTop: "0.5rem", marginBottom: "0.5rem"}}>
                <Col span={12}>
                    <Translate
                        component="span"
                        content="invoice.request.items"
                    />
                </Col>
                <Col span={5}>
                    <Translate
                        component="span"
                        content="invoice.request.quantity"
                    />
                </Col>
                <Col span={5}>
                    <Translate
                        component="span"
                        content="invoice.request.price"
                    />
                </Col>
                <Col span={2}>
                    <Translate
                        component="span"
                        content="invoice.request.action"
                    />
                </Col>
            </Row>
            {keys.map(k => (
                <Form.Item key={k} style={{marginBottom: "0px"}}>
                    <Input.Group compact>
                        <Row>
                            <Col span={12}>
                                <Input
                                    value={lineItems[k]?.label || ""}
                                    onChange={e =>
                                        updateLineItem(
                                            k,
                                            "label",
                                            e.target.value
                                        )
                                    }
                                />
                            </Col>
                            <Col span={5}>
                                <Input
                                    type="number"
                                    value={lineItems[k]?.quantity || ""}
                                    onChange={e =>
                                        updateLineItem(
                                            k,
                                            "quantity",
                                            e.target.value
                                        )
                                    }
                                />
                            </Col>
                            <Col span={5}>
                                <Input
                                    type="number"
                                    value={lineItems[k]?.price || ""}
                                    onChange={e =>
                                        updateLineItem(
                                            k,
                                            "price",
                                            e.target.value
                                        )
                                    }
                                />
                            </Col>
                            <Col span={2}>
                                {k == keys[keys.length - 1] ? (
                                    <Button
                                        variant="accent"
                                        icon="plus-circle-o"
                                        onClick={() => add()}
                                    />
                                ) : (
                                    <Button
                                        variant="accent"
                                        icon="minus-circle-o"
                                        onClick={() => remove(k)}
                                    />
                                )}
                            </Col>
                        </Row>
                    </Input.Group>
                </Form.Item>
            ))}
        </React.Fragment>
    );

    const error = hasErrors();

    return (
        <div className="merchant-protocol--request">
            <AccountSelector
                className="invoice-request-input"
                label="invoice.request.recipient_account"
                accountName={recipientName}
                onChange={fromChanged}
                onAccountChanged={onFromAccountChanged}
                account={recipientName}
                typeahead={true}
                size={32}
            />
            <Form onSubmit={handleSubmit}>
                <Form.Item
                    className="invoice-request-input"
                    label={
                        <span>
                            {counterpart.translate(
                                "invoice.request.identifier"
                            )}
                            <Tooltip
                                placement="topLeft"
                                title={counterpart.translate(
                                    "invoice.request.identifier_tooltip"
                                )}
                            >
                                &nbsp;
                                <Icon type="question-circle" theme="filled" />
                            </Tooltip>
                        </span>
                    }
                >
                    <Input
                        value={memo}
                        onChange={e => setMemo(e.target.value)}
                    />
                </Form.Item>

                <Form.Item
                    className="invoice-request-input"
                    label={
                        <span>
                            {counterpart.translate(
                                "invoice.request.payment_asset"
                            )}
                            <Tooltip
                                placement="topLeft"
                                title={counterpart.translate(
                                    "invoice.request.payment_asset_tooltip"
                                )}
                            >
                                &nbsp;
                                <Icon type="question-circle" theme="filled" />
                            </Tooltip>
                        </span>
                    }
                >
                    <AssetSelect
                        value={currency}
                        assets={DEFAULT_ASSETS}
                        onChange={onChangeCurrency}
                    />
                </Form.Item>

                <Form.Item
                    className="invoice-request-input"
                    label={
                        <span>
                            {counterpart.translate(
                                "invoice.request.recipient_name"
                            )}
                            <Tooltip
                                placement="topLeft"
                                title={counterpart.translate(
                                    "invoice.request.recipient_name_tooltip"
                                )}
                            >
                                &nbsp;
                                <Icon type="question-circle" theme="filled" />
                            </Tooltip>
                        </span>
                    }
                >
                    <Input
                        value={toLabel}
                        onChange={e => setToLabel(e.target.value)}
                    />
                </Form.Item>
                <Form.Item
                    className="invoice-request-input"
                    label={
                        <span>
                            {counterpart.translate("invoice.request.note")}
                            <Tooltip
                                placement="topLeft"
                                title={counterpart.translate(
                                    "invoice.request.note_tooltip"
                                )}
                            >
                                &nbsp;
                                <Icon type="question-circle" theme="filled" />
                            </Tooltip>
                        </span>
                    }
                >
                    <Input.TextArea
                        rows={3}
                        value={note}
                        onChange={e => setNote(e.target.value)}
                    />
                </Form.Item>

                {formItems}
                <Form.Item>
                    <Button variant="accent" type="submit" disabled={error}>
                        <Translate content="invoice.request.create_invoice_string" />
                    </Button>
                </Form.Item>
            </Form>
            {invoiceData && (
                <React.Fragment>
                    <div style={{marginTop: "2rem"}}>
                        <Input.TextArea disabled rows={4} value={invoiceData} />
                    </div>
                    <div style={{float: "right"}}>
                        <CopyButton useDiv={false} text={invoiceData} />
                    </div>
                </React.Fragment>
            )}
        </div>
    );
}
