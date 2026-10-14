import * as React from "react";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "./hooks/useChainStoreTick";
import styles from "./HeadBlock.module.scss";

// The number of the head block, beside the connection chip. It lives in its own
// component so that the block every three seconds re-renders this chip and not
// the whole shell.
export default function HeadBlock(): JSX.Element | null {
    useChainStoreTick();
    // 2.1.0: the dynamic global properties, updated with every block
    const dynamic: any = (ChainStore as any).getObject("2.1.0");
    const number =
        dynamic && typeof dynamic.get === "function"
            ? Number(dynamic.get("head_block_number"))
            : 0;
    if (!number) return null;
    return (
        <span
            className={styles.block}
            title="Head block"
            aria-label={`Head block ${number}`}
        >
            #{number.toLocaleString("en-US")}
        </span>
    );
}
