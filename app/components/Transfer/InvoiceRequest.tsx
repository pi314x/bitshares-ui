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
import * as React from "react";
import {ChainStore} from "bitsharesjs";
import AccountSelector from "../Account/AccountSelector";
import AssetSelect from "../Utility/AssetSelect";
import {compress} from "lzma";
import bs58 from "common/base58";
import Translate from "react-translate-component";
import {
    Button,
    Row,
    Col,
    Form,
    Input,
    Tooltip,
    Icon
} from "bitshares-ui-style-guide";
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

interface InvoiceRequestProps {
    form: any;
    currentAccount: any;
    validateFormat: (invoice: any) => boolean;
    [key: string]: any;
}

function InvoiceRequest({
    form,
    currentAccount,
    validateFormat
}: InvoiceRequestProps) {
    const [invoiceData, setInvoiceData] = React.useState<string | null>(null);
    const [recipientName, setRecipientName] = React.useState<string | null>(
        null
    );
    const [, setRecipientNameAccount] = React.useState<any>(null);
    const [currency, setCurrency] = React.useState("BTS");

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

    const hasErrors = () => {
        let formError: any = false;
        const values = form.getFieldsValue(["line_items", "memo", "keys"]);

        formError = Object.keys(values).some(field => {
            if (field !== "line_items") {
                return !values[field];
            } else {
                if (values.keys)
                    return values.keys.some((item: any) => {
                        return (
                            !values[field][item].label ||
                            !values[field][item].price ||
                            !values[field][item].quantity
                        );
                    });
            }
        });

        return formError || !recipientName;
    };

    const remove = (k: any) => {
        const keys = form.getFieldValue("keys");
        if (keys.length === 1) {
            return;
        }
        const nextKeys = keys.filter((key: any) => key !== k);
        form.setFieldsValue({
            keys: nextKeys
        });
    };

    const add = () => {
        const keys = form.getFieldValue("keys");
        const nextKeys = keys.concat(id++);
        form.setFieldsValue({
            keys: nextKeys
        });
    };

    const handleSubmit = (e: any) => {
        e.preventDefault();
        form.validateFields((err: any, values: any) => {
            if (!err) {
                // eslint-disable-next-line prefer-const
                let {line_items, memo, note, to_label} = values;
                // remove empty lines
                line_items = line_items.filter((item: any) => !!item);
                _printInvoice({
                    currency,
                    line_items,
                    memo,
                    note,
                    to: recipientName,
                    to_label
                });
            }
        });
    };

    const onChangeCurrency = (e: any) => {
        const asset = (ChainStore as any).getAsset(e);
        setCurrency(asset.get("symbol"));
    };

    const {getFieldValue, getFieldDecorator} = form;
    getFieldDecorator("keys", {initialValue: [0]});
    const keys = getFieldValue("keys");
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
            {keys.map((k: any) => (
                <Form.Item key={k} style={{marginBottom: "0px"}}>
                    <Input.Group compact>
                        <Row>
                            <Col span={12}>
                                {getFieldDecorator(`line_items[${k}]label`)(
                                    <Input />
                                )}
                            </Col>
                            <Col span={5}>
                                {getFieldDecorator(`line_items[${k}]quantity`)(
                                    <Input type="number" />
                                )}
                            </Col>
                            <Col span={5}>
                                {getFieldDecorator(`line_items[${k}]price`)(
                                    <Input type="number" />
                                )}
                            </Col>
                            <Col span={2}>
                                {k == keys[keys.length - 1] ? (
                                    <Button
                                        type="primary"
                                        icon="plus-circle-o"
                                        onClick={() => add()}
                                    />
                                ) : (
                                    <Button
                                        type="primary"
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
            <Form onSubmit={handleSubmit} required={true}>
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
                    {getFieldDecorator("memo")(<Input />)}
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
                    {getFieldDecorator("to_label")(<Input />)}
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
                    {getFieldDecorator("note")(<Input.TextArea rows={3} />)}
                </Form.Item>

                {formItems}
                <Form.Item>
                    <Button type="primary" htmlType="submit" disabled={error}>
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

export default Form.create({name: "invoice_request"})(InvoiceRequest as any);
