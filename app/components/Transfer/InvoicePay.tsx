// TypeScript/functional-component port of the legacy InvoicePay.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Preserved verbatim (not "fixed"): `UNSAFE_componentWillReceiveProps`
// reads `this.props.currentAccount` (the *previous* render's props, not
// the incoming `nextProps.currentAccount`) when it recovers
// `pay_from_name`/`paymentOperation` after an error path left them unset.
// Replicated with a `prevCurrentAccountRef` updated *after* being read,
// so this render sees the previous render's value exactly like
// `this.props` did.
//
// `getTotal`/`_findPayment`'s original two-phase
// `setState({...}, this.getTotal)` (set fields, then read them back from
// `this.state` inside the callback to compute derived ones) is
// restructured into computing the derived values eagerly from the
// already-known local values and setting everything in one state update -
// same end state, since `getTotal`/`_findPayment` are pure functions of
// data this component already has in hand at the call site; this avoids
// trying to replicate `setState`'s callback timing with hooks state
// (whose setters don't support a synchronous "read the just-applied
// value back" the way `this.state` does).
//
// `onBroadcastAndConfirm` is registered/unregistered by reference
// (`TransactionConfirmStore.listen`/`.unlisten`), so - like the
// original's `this.onBroadcastAndConfirm.bind(this)` in the constructor -
// it needs a *stable* identity across renders, not a fresh closure every
// render (which would make a later `.unlisten` silently fail to remove
// the listener actually registered). Given via `useCallback` with an
// empty dependency array, since its own body only calls the (React-
// guaranteed stable) `setBlockNum` state setter and
// `TransactionConfirmStore` methods.
import * as React from "react";
import FormattedAsset from "../Utility/FormattedAsset";
import AccountActions from "actions/AccountActions";
import AccountSelector from "../Account/AccountSelector";
import {ChainStore, FetchChain, FetchChainObjects} from "bitsharesjs/es";
import NotificationActions from "actions/NotificationActions";
import TransactionConfirmStore from "stores/TransactionConfirmStore";
import {decompress} from "lzma";
import bs58 from "common/base58";
import PrintReceiptButton from "./PrintReceiptButton";
import Translate from "react-translate-component";
import {Button} from "../../design-system/Button";
import {Row} from "../../design-system/Row";
import {Col} from "../../design-system/Col";
import {Icon} from "../../design-system/Icon";
import {Tooltip} from "../../design-system/Tooltip";
import utils from "common/utils";
import counterpart from "counterpart";
import {hasLoaded} from "../Utility/BindToCurrentAccount";
import Operation from "../Blockchain/Operation";
import QRCode from "qrcode.react";
import ScanOrEnterText from "./ScanOrEnterText";

// invoice example:
//{
//    "to" : "merchant_account_name",
//    "to_label" : "Merchant Name",
//    "currency": "TEST",
//    "memo" : "Invoice #1234",
//    "line_items" : [
//        { "label" : "Something to Buy", "quantity": 1, "price" : "1000.00" },
//        { "label" : "10 things to Buy", "quantity": 10, "price" : "1000.00" }
//    ],
//    "note" : "Something the merchant wants to say to the user",
//    "callback" : "https://merchant.org/complete"
//}
// http://localhost:8080/#/invoice/8Cv8ZjMa8XCazX37XgNhj4jNc4Z5WgZFM5jueMEs2eEvL3pEmELjAVCWZEJhj9tEG5RuinPCjY1Fi34ozb8Cg3H5YBemy9JoTRt89X1QaE76xnxWPZzLcUjvUd4QZPjCyqZNxvrpCN2mm1xVRY8FNSVsoxsrZwREMyygahYz8S23ErWPRVsfZXTwJNCCbqjWDTReL5yytTKzxyKhg4YrnntYG3jdyrBimDGBRLU7yRS9pQQLcAH4T7j8LXkTocS7w1Zj4amckBmpg5EJCMATTRhtH8RSycfiXWZConzqqzxitWCxZK846YHNh

function parsePrice(price: any): number {
    const m = price.match(/([\d\,\.\s]+)/);
    if (!m || m.length < 2) 0.0;
    return parseFloat(m[1].replace(/[\,\s]/g, ""));
}

function computeTotal(invoice: any, asset: any): number {
    const items = invoice.line_items;
    if (!items || items.length === 0) return 0.0;
    const total_amount = items.reduce((total: number, item: any) => {
        const price = parsePrice(item.price);
        if (!price) return total;
        return total + item.quantity * price;
    }, 0.0);
    return parseFloat(total_amount.toFixed(asset.get("precision")));
}

function findPayment(
    currentAccount: any,
    invoice: any,
    asset: any,
    pay_to_account: any,
    total_amount: any
): any {
    if (hasLoaded(currentAccount) && total_amount && pay_to_account) {
        const find_to = pay_to_account.get("id");
        const find_asset_id = asset.get("id");
        const find_amount = total_amount * Math.pow(10, asset.get("precision"));

        let transaction: any = null;
        currentAccount
            .get("history")
            .toJS()
            .forEach((_op: any) => {
                const op = _op.op;
                if (op[0] == 0) {
                    const to = op[1].to;
                    const amount = op[1].amount.amount;
                    const asset_id = op[1].amount.asset_id;

                    console.log(
                        find_to,
                        to,
                        find_asset_id,
                        asset_id,
                        find_amount,
                        amount
                    );

                    if (
                        find_to == to &&
                        find_asset_id == asset_id &&
                        find_amount == amount
                    ) {
                        transaction = _op;
                    }
                }
            });
        return transaction;
    }
}

interface InvoicePayProps {
    match: {params: {data: string}};
    currentAccount: any;
    validateFormat: (invoice: any) => boolean;
}

function InvoicePay({match, currentAccount, validateFormat}: InvoicePayProps) {
    const [invoice, setInvoice] = React.useState<any>(null);
    const [asset, setAsset] = React.useState<any>(null);
    const [pay_from_name, setPayFromName] = React.useState<string | null>(null);
    const [pay_from_account, setPayFromAccount] = React.useState<any>(null);
    const [pay_to_account, setPayToAccount] = React.useState<any>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [blockNum, setBlockNum] = React.useState<any>(null);
    const [invoiceQr, setInvoiceQr] = React.useState(false);
    const [rawDataInputValue, setRawDataInputValue] = React.useState("");
    const [isRawDataInputVisible, setIsRawDataInputVisible] = React.useState(
        false
    );
    const [total_amount, setTotalAmount] = React.useState<any>(undefined);
    const [paymentOperation, setPaymentOperation] = React.useState<any>(
        undefined
    );

    const decompressRawData = (data: any): Promise<any> => {
        return new Promise((resolve, reject) => {
            (decompress as any)(data, (result: any, error: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    };

    const parseInvoiceData = async (data: any) => {
        try {
            data = (utils as any).sanitize(data, {
                whiteList: [], // empty, means filter out all tags
                stripIgnoreTag: true // filter out all HTML not in the whilelist
            });

            const newInvoice = JSON.parse(data);
            if (validateFormat(newInvoice)) {
                const assetsArray = await (FetchChainObjects as any)(
                    (ChainStore as any).getAsset,
                    [newInvoice.currency]
                );
                const newAsset = assetsArray[0];
                const newPayToAccount = await (FetchChain as any)(
                    "getAccount",
                    newInvoice.to,
                    undefined,
                    {
                        [newInvoice.to]: false
                    }
                );
                const newTotalAmount = computeTotal(newInvoice, newAsset);
                const newPaymentOperation = findPayment(
                    currentAccount,
                    newInvoice,
                    newAsset,
                    newPayToAccount,
                    newTotalAmount
                );

                setInvoice(newInvoice);
                setAsset(newAsset);
                setPayToAccount(newPayToAccount);
                setPayFromName(currentAccount.get("name"));
                setError(null);
                setIsRawDataInputVisible(false);
                setTotalAmount(newTotalAmount);
                setPaymentOperation(newPaymentOperation);
            } else {
                setError(counterpart.translate("invoice.invalid_format"));
            }
        } catch (error: any) {
            setError(error.message);
        }
    };

    const onBroadcastAndConfirm = React.useCallback(
        (confirm_store_state: any) => {
            if (
                confirm_store_state.included &&
                confirm_store_state.broadcasted_transaction
            ) {
                (TransactionConfirmStore as any).unlisten(
                    onBroadcastAndConfirm
                );
                (TransactionConfirmStore as any).reset();
                setBlockNum(confirm_store_state.trx_block_num);

                /*  if (this.state.invoice.callback) {
                let trx = confirm_store_state.broadcasted_transaction;
                let url = `${this.state.invoice.callback}?block=${
                    trx.ref_block_num
                }&trx=${trx.id()}`;
                window.location.href = url;
            }  */
            }
            // eslint-disable-next-line
        },
        []
    );

    // Mirrors componentDidMount.
    React.useEffect(() => {
        const compressed_data = (bs58 as any).decode(match.params.data);
        (TransactionConfirmStore as any).unlisten(onBroadcastAndConfirm);
        (TransactionConfirmStore as any).listen(onBroadcastAndConfirm);
        (async () => {
            try {
                const data = await decompressRawData(compressed_data);
                await parseInvoiceData(data);
            } catch (e) {
                setIsRawDataInputVisible(true);
            }
        })();
        // eslint-disable-next-line
    }, []);

    // Mirrors UNSAFE_componentWillReceiveProps, using the *previous*
    // render's currentAccount (see file header).
    const prevCurrentAccountRef = React.useRef(currentAccount);
    const isFirstRenderRef = React.useRef(true);
    if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
    } else if (pay_from_name == null && prevCurrentAccountRef.current) {
        const newPaymentOperation = findPayment(
            prevCurrentAccountRef.current,
            invoice,
            asset,
            pay_to_account,
            total_amount
        );
        setPayFromName(prevCurrentAccountRef.current.get("name"));
        setPaymentOperation(newPaymentOperation);
    }
    prevCurrentAccountRef.current = currentAccount;

    const handleRawInvoiceDataChange = (e: any) => {
        const value = e.target.value.replace(/\s/g, "");
        setRawDataInputValue(value);
        (async () => {
            try {
                const compressedData = (bs58 as any).decode(value);
                const decompressedData = await decompressRawData(
                    compressedData
                );
                parseInvoiceData(decompressedData);
            } catch (e: any) {
                console.log(e);
                setError(e.message);
            }
        })();
    };

    const handleQrScanSuccess = async ({address}: {address: string}) => {
        try {
            const compressedData = (bs58 as any).decode(address);
            const decompressedData = await decompressRawData(compressedData);
            parseInvoiceData(decompressedData);
        } catch (e: any) {
            console.log(e);
            setError(e.message);
        }
    };

    const onPayClick = (e: any) => {
        e.preventDefault();
        const precision = (utils as any).get_asset_precision(
            asset.get("precision")
        );
        const to_account = (ChainStore as any).getAccount(invoice.to);
        if (!to_account) {
            (NotificationActions as any).error(
                `Account ${invoice.to} not found`
            );
            return;
        }
        (AccountActions as any)
            .transfer(
                pay_from_account.get("id"),
                to_account.get("id"),
                parseInt(String(total_amount * precision), 10),
                asset.get("id"),
                invoice.memo
            )
            .then(() => {
                (TransactionConfirmStore as any).unlisten(
                    onBroadcastAndConfirm
                );
                (TransactionConfirmStore as any).listen(onBroadcastAndConfirm);
            })
            .catch((e: any) => {
                console.log("error: ", e);
            });
    };

    const fromChanged = (newPayFromName: string) => {
        setPayFromName(newPayFromName);
        setPayFromAccount(null);
    };

    const onFromAccountChanged = (newPayFromAccount: any) => {
        setPayFromAccount(newPayFromAccount);
    };

    const onToAccountChanged = (newPayToAccount: any) => {
        setPayToAccount(newPayToAccount);
    };

    const {data} = match.params;
    if (isRawDataInputVisible) {
        return (
            <div>
                <ScanOrEnterText
                    labelContent={
                        <Translate
                            component="span"
                            content="invoice.raw_invoice_data"
                        />
                    }
                    submitBtnText={counterpart.translate(
                        "invoice.use_invoice_data"
                    )}
                    dataFoundText={
                        counterpart.translate("invoice.invoice_data_found") +
                        ":"
                    }
                    onInputChange={handleRawInvoiceDataChange}
                    inputValue={rawDataInputValue}
                    handleQrScanSuccess={handleQrScanSuccess}
                />
                <br />
                <h4 className="has-error text-center">{error}</h4>
            </div>
        );
    }
    if (error)
        return (
            <div>
                <br />
                <h4 className="has-error text-center">{error}</h4>
            </div>
        );
    if (!invoice) return null;
    if (!asset)
        return (
            <div>
                <Translate
                    className="has-error text-center"
                    component="h4"
                    content="transfer.errors.asset_unsupported"
                    currency={invoice.currency}
                />
            </div>
        );

    const assetSymbol = invoice.currency;
    // Original also computed a `balance` element here (and a
    // corresponding `if (pay_from_account) {...}` block below it) but
    // never actually rendered it anywhere in its returned JSX - confirmed
    // dead, dropped.

    if (invoice.to_label) {
        invoice.to_name = invoice.to_label;
    }

    const receiptData = {
        ...invoice,
        total_amount: total_amount ? total_amount.toString() : 0,
        asset: assetSymbol,
        from: pay_from_account,
        blockNum
    };

    const items = invoice.line_items.map((i: any, index: number) => {
        const price = parsePrice(i.price);
        const amount = i.quantity * price;
        return (
            <Row key={"invoice_item_" + index}>
                <Col span={10}>
                    <div className="item-name">{i.label}</div>
                    <div className="item-description" />
                </Col>
                <Col span={3}>{i.quantity} x</Col>
                <Col span={5}>
                    <FormattedAsset
                        amount={i.price}
                        asset={assetSymbol}
                        exact_amount={true}
                    />
                </Col>
                <Col span={5}>
                    <FormattedAsset
                        amount={amount}
                        asset={assetSymbol}
                        exact_amount={true}
                    />
                </Col>
            </Row>
        );
    });
    const invoiceData = data !== "pay" ? data : rawDataInputValue;

    let qrcode = null;
    if (invoiceQr) {
        qrcode = invoiceData;
    } else {
        if (pay_from_name && invoice.to !== pay_from_name) {
            qrcode =
                `bitshares:operation/transfer?to=${invoice.to}&from=${pay_from_name}&asset=${assetSymbol}&amount=${total_amount}` +
                (invoice.memo ? `&memo=${invoice.memo}` : "");
        }
    }

    return (
        <div className="merchant-protocol--pay">
            <div style={{float: "right"}}>
                <PrintReceiptButton
                    data={receiptData}
                    parsePrice={parsePrice}
                />
            </div>
            <Translate component="h3" content="invoice.payment_request" />
            <br />
            <Row>
                <Col
                    span={10}
                    style={{
                        width: "30rem"
                    }}
                >
                    <h4>{invoice.memo}</h4>
                    <AccountSelector
                        label="invoice.paid_by"
                        accountName={pay_from_name}
                        onChange={fromChanged}
                        onAccountChanged={onFromAccountChanged}
                        account={pay_from_name}
                        typeahead={true}
                        size={32}
                    />

                    <AccountSelector
                        label="invoice.pay_to"
                        accountName={invoice.to}
                        disabled={true}
                        onAccountChanged={onToAccountChanged}
                        account={pay_to_account}
                        size={32}
                    />
                </Col>
                <Col span={6} offset={4}>
                    <div className="inline-block">
                        <Translate
                            component="h4"
                            content="invoice.pay.barcode"
                        />
                        <Button
                            style={{
                                width: "180px",
                                marginBottom: "20px"
                            }}
                            onClick={() => {
                                setInvoiceQr(!invoiceQr);
                            }}
                        >
                            <Translate
                                component="span"
                                content={
                                    invoiceQr
                                        ? "invoice.pay.invoice_qr_code"
                                        : "invoice.pay.payment_qr_code"
                                }
                            />
                        </Button>
                    </div>
                    <QRCode
                        size={180}
                        value={qrcode ? qrcode : ""}
                        bgColor={qrcode ? undefined : "#000000"}
                    />
                </Col>
            </Row>
            {invoice.to_name && (
                <div>
                    <Translate content="invoice.request.recipient_name" />
                    <p>{invoice.to_name}</p>
                </div>
            )}
            {invoice.note && (
                <div>
                    <Translate content="invoice.note" />
                    <p>{invoice.note}</p>
                </div>
            )}
            <Row>
                <Col span={10}>
                    <Translate component="span" content="invoice.items" />
                </Col>
                <Col span={3}>
                    <Translate component="span" content="invoice.amount" />
                </Col>
                <Col span={5}>
                    <Translate component="span" content="invoice.unit" />
                </Col>
                <Col span={5}>
                    <Translate component="span" content="invoice.total" />
                </Col>
            </Row>
            <div className="divider" />
            {items}
            <div className="divider" />
            <Row>
                <Col span={18}>
                    <Translate component="span" content="invoice.total" />
                </Col>
                <Col span={5}>
                    <FormattedAsset
                        amount={total_amount}
                        asset={assetSymbol}
                        exact_amount={true}
                    />
                </Col>
            </Row>
            {paymentOperation ? (
                <div>
                    <h3>
                        {counterpart.translate("invoice.payment_proof")}
                        &nbsp;
                        <Tooltip
                            title={counterpart.translate(
                                "invoice.tooltip_payment_proof"
                            )}
                            mouseEnterDelay={0.5}
                        >
                            <Icon type="question-circle" />
                        </Tooltip>
                    </h3>

                    <table className="table">
                        <tbody>
                            <Operation
                                includeOperationId={true}
                                key={paymentOperation.id}
                                operationId={paymentOperation.id}
                                op={paymentOperation.op}
                                result={paymentOperation.result}
                                block={paymentOperation.block_num}
                                current={currentAccount.get("id")}
                            />
                        </tbody>
                    </table>
                </div>
            ) : (
                <Button
                    variant="accent"
                    style={{marginTop: "30px"}}
                    disabled={!pay_from_account}
                    onClick={onPayClick}
                >
                    <Translate
                        content="invoice.pay_button"
                        asset={
                            <FormattedAsset
                                amount={total_amount}
                                asset={assetSymbol}
                                exact_amount={true}
                            />
                        }
                        name={invoice.to}
                    />
                </Button>
            )}
        </div>
    );
}

export default InvoicePay;
