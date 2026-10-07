// TypeScript/functional-component port of the legacy
// CryptoLinkFormatter.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// The original's `static assetTemplates = {}` (a static class field) was
// shadowed by an identically-named instance field
// (`this.assetTemplates = {...}`) assigned in the constructor - the
// static one was never actually read anywhere, dead from the start.
// Replicated as a plain module-scope constant (computed once, matching
// the constructor's "runs once per mount" semantics closely enough since
// it's a pure literal with no prop dependency).
//
// Given an asset name, amount and label generates uri for its refilling
import * as React from "react";
import QRCode from "qrcode.react";

const assetTemplates: {
    [asset: string]: {
        template: string;
        params: {name?: string; bind: string}[];
    };
} = {
    BTS: {
        template: "{address}",
        params: []
    },
    BTC: {
        template: "bitcoin:{address}", // template of the link with optional variables - {address} or other component's properties names in curly braces
        params: [
            // list of parameters appended to link above in the manner of HTTP GET query parameters : ?name=value&name2=value2
            {
                // parameters now supports two props: optional `name` - parameter's name (if its not equal to bound property name) and `bind` - actual property of the component
                // name: "value"
                bind: "amount" // components property name, value of which would be assigned to this parameter. In this particullary case we would get &amount=<component's `amount` property value>
            },
            {
                // message=<message>
                bind: "message"
            }
        ]
    },
    LTC: {
        template: "litecoin:{address}",
        params: [
            {
                // &amount=<amount>
                bind: "amount"
            },
            {
                // &message=<message>
                bind: "message"
            }
        ]
    },
    ETH: {
        template: "ethereum:{address}",
        params: [
            {
                // &value=<amount>
                name: "value", // name of the parameter. if not provided - bind param name would be set as name
                bind: "amount" // actual param value got from components props
            },
            {
                // &message=<message>
                bind: "message"
            }
        ]
    },
    BCH: {
        template: "bitcoincash:{address}",
        params: [
            {
                bind: "amount"
            },
            {
                bind: "message"
            }
        ]
    }
};

interface CryptoLinkFormatterProps {
    asset: string;
    address: string;
    amount?: number;
    message?: string;
    size?: number;
    [key: string]: any;
}

function CryptoLinkFormatter({size = 140, asset, ...conf}: CryptoLinkFormatterProps) {
    const assetTemplate = assetTemplates[asset];

    let error = false;
    if (typeof assetTemplate != "undefined") {
        // template handling
        let link = assetTemplate.template.replace(
            /{([a-zA-Z0-9]+)}/g,
            function(match, tokenName) {
                if (tokenName in conf) {
                    return (conf as any)[tokenName];
                } else {
                    // some variable required by template was not found  - can't proceed next
                    error = true;
                    return true as any;
                }
            }
        );

        // if error encountered - its better not to show any broken qr
        if (error) {
            return "";
        }

        // query param handling
        if (assetTemplate.params.length > 0) {
            const parameters: string[] = [];

            assetTemplate.params.forEach(function(parameter) {
                let name = "";

                if (typeof parameter["name"] != "undefined") {
                    name = parameter["name"] as string;
                }

                if (name == "") {
                    name = parameter["bind"];
                }

                if (typeof (conf as any)[parameter["bind"]] !== "undefined") {
                    parameters.push(name + "=" + (conf as any)[parameter["bind"]]);
                }
            });

            if (parameters.length > 0) {
                link += "?" + parameters.join("&");
            }
        }

        return (
            <div className="QR">
                <QRCode size={size} value={link} />
            </div>
        );
    } else {
        return "";
    }
}

export default CryptoLinkFormatter;
