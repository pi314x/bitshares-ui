// TypeScript/functional-component port of the legacy Invoice.jsx (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Preserved verbatim (not "fixed"): the original builds `state.tabs`
// (including each tab's `content`, an `<InvoiceRequest {...props} .../>`/
// `<InvoicePay {...props} .../>` element) once in the constructor, closing
// over that first render's `props`. Since nothing ever rebuilds
// `state.tabs` afterward, later prop changes (e.g. a new `currentAccount`
// from `bindToCurrentAccount`, or router `match`/`location` changes) never
// reach the mounted `InvoiceRequest`/`InvoicePay` through this path - they
// keep whatever `props` this component had at construction time.
// Replicated with a `useState` lazy initializer (runs once, on the first
// render only, exactly like a constructor).
import * as React from "react";
import {Card} from "../../design-system/Card";
import {Tabs} from "../../design-system/Tabs";
import counterpart from "counterpart";
import InvoiceRequest from "./InvoiceRequest";
import InvoicePay from "./InvoicePay";
import {bindToCurrentAccount} from "../Utility/BindToCurrentAccount";
import {validate} from "jsonschema";
import "../../assets/stylesheets/components/_merchant.scss";

function _validateFormat(invoice: any): boolean {
    const schema = {
        type: "object",
        properties: {
            to: {type: "string"},
            to_label: {type: "string"},
            currency: {type: "string"},
            memo: {type: "string"},
            line_items: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        label: {type: "string"},
                        quantity: {type: "float", minimum: 1},
                        price: {type: "float"}
                    }
                }
            },
            note: {type: "string"},
            required: ["to", "currency", "line_items"]
        }
    };
    const errors = (validate as any)(invoice, schema).errors;
    return !errors.length;
}

interface InvoiceProps {
    match: {url: string; params: {data: string}};
    location: {pathname: string};
    history: any;
    currentAccount: any;
    [key: string]: any;
}

function Invoice(props: InvoiceProps) {
    const {match, location, history} = props;

    const [tabs] = React.useState(() => [
        {
            name: "Request",
            link: "/invoice/request",
            translate: "invoice.request.title",
            content: (
                <InvoiceRequest {...props} validateFormat={_validateFormat} />
            )
        },
        {
            name: "Pay",
            link: "/invoice/pay",
            translate: "invoice.pay.title",
            content: <InvoicePay {...props} validateFormat={_validateFormat} />
        }
    ]);

    React.useEffect(() => {
        const isTab = tabs.some(tab => tab.link === match.url);
        if (!isTab) history.push("/invoice/pay");
        // eslint-disable-next-line
    }, []);

    const onTabChange = (value: string) => {
        history.push(value);
    };

    return (
        <div className="merchant-protocol center">
            <Card>
                <Tabs
                    activeKey={location.pathname}
                    animated={false}
                    onChange={onTabChange}
                >
                    {tabs.map(tab => {
                        return (
                            <Tabs.TabPane
                                key={tab.link}
                                tab={counterpart.translate(tab.translate)}
                            >
                                <div className="padding">{tab.content}</div>
                            </Tabs.TabPane>
                        );
                    })}
                </Tabs>
            </Card>
        </div>
    );
}

export default bindToCurrentAccount(Invoice as any);
