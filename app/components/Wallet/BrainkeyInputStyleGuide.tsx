// TypeScript/functional-component port of the legacy
// BrainkeyInputStyleGuide.jsx (Phase 5, docs/UI_MIGRATION_PLAN.md) - the
// antd-styled variant of `BrainkeyInput.tsx` (same logic, `Input.TextArea`
// instead of a raw `<textarea>`), used by `WalletCreate.jsx`. Mechanical,
// no logic changes; same security notes as `BrainkeyInput.tsx` apply.
import * as React from "react";
import cname from "classnames";
import {hash, key} from "bitsharesjs";
import {Input} from "bitshares-ui-style-guide";

let dictionary_set: Set<string> | undefined;

if (__ELECTRON__) {
    // Conditional require, not a top-level import: this ~339KB
    // dictionary is only needed (and bundled) for the Electron build -
    // the browser build fetches it lazily instead (see the effect
    // below). A static import would pull it into the browser bundle
    // unconditionally.
    dictionary_set = new Set(
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        (require("common/dictionary_en.json") as any).en.split(",")
    );
}

interface BrainkeyInputProps {
    onChange: (brnkey: string | null) => void;
    tabIndex?: number;
    hideCheckDigits?: boolean;
    errorCallback?: (valid: boolean) => void;
}

export default function BrainkeyInput({
    onChange,
    tabIndex,
    hideCheckDigits,
    errorCallback
}: BrainkeyInputProps) {
    const [brnkey, setBrnkey] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [checkDigits, setCheckDigits] = React.useState<string | null>(null);

    const isFirstRender = React.useRef(true);
    React.useEffect(() => {
        if (!isFirstRender.current) return;
        isFirstRender.current = false;

        if (!__ELECTRON__) {
            fetch(`${__BASE_URL__}dictionary.json`)
                .then(reply => {
                    return reply.json().then((result: any) => {
                        dictionary_set = new Set(result.en.split(","));
                        setLoading(false);
                    });
                })
                .catch(err => {
                    console.log("fetch dictionary error:", err);
                });
        } else {
            setLoading(false);
        }
    }, []);

    const checkBrainKey = () => {
        const spellcheck_words = brnkey.split(" ");
        const checked_words: any[] = [];
        spellcheck_words.forEach((word, i) => {
            if (word === "") return;
            let spellcheckword: any = word.toLowerCase();
            spellcheckword = spellcheckword.match(/[a-z]+/); //just spellcheck letters
            if (
                spellcheckword === null ||
                (dictionary_set as Set<string>).has(spellcheckword[0])
            )
                checked_words.push(
                    <span key={i} style={{padding: "1px", margin: "1px"}}>
                        {word}
                    </span>
                );
            else
                checked_words.push(
                    <MisspelledWord key={i}>{word}</MisspelledWord>
                );
        });
        let word_count_label;
        let warn = true;
        let valid = true;
        if (checked_words.length > 0) {
            if (brnkey.length < 50) {
                word_count_label = brnkey.length + " characters (50 minimum)";
                valid = false;
            } else {
                if (checked_words.length < 16)
                    word_count_label =
                        checked_words.length + " words (16 recommended)";
                else {
                    word_count_label = checked_words.length + " words";
                    warn = false;
                }
            }
        }

        return {warn, valid, word_count_label, checked_words};
    };

    const formChange = (event: any) => {
        const {id, value} = event.target;
        const {valid} = checkBrainKey();
        if (id === "brnkey") {
            const normalized = (key as any).normalize_brainKey(value);
            setBrnkey(value);
            onChange(normalized.length < 50 ? null : normalized);
            setCheckDigits(
                normalized.length < 50
                    ? null
                    : (hash as any)
                          .sha1(normalized)
                          .toString("hex")
                          .substring(0, 4)
            );
        }

        if (errorCallback) {
            errorCallback(valid);
        }
    };

    if (loading || !dictionary_set) {
        return <div style={{padding: 20}}>Fetching dictionary....</div>;
    }

    const {warn, word_count_label, checked_words} = checkBrainKey();

    return (
        <span className="">
            <div>
                <Input.TextArea
                    tabIndex={tabIndex || 1}
                    onChange={formChange}
                    value={brnkey}
                    id="brnkey"
                    style={{height: 100, minWidth: 450}}
                />
                <div
                    style={{textAlign: "left"}}
                    className="grid-content no-padding no-overflow"
                >
                    {checked_words}
                </div>
                {checkDigits && !hideCheckDigits ? (
                    <div>
                        <br />
                        <pre className="no-overflow">
                            {checkDigits} * Check Digits
                        </pre>
                        <br />
                    </div>
                ) : null}
                <p>
                    <i className={cname({error: warn})}>{word_count_label}</i>
                </p>
            </div>
        </span>
    );
}

function MisspelledWord({children}: {children?: any}) {
    return (
        <span
            style={{
                borderBottom: "1px dotted #ff0000",
                padding: "1px",
                margin: "1px"
            }}
        >
            <span style={{borderBottom: "1px dotted #ff0000"}}>
                {children}
            </span>
        </span>
    );
}
