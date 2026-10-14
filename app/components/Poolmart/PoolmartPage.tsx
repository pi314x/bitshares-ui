import * as React from "react";
import LiquidityPools from "./LiquidityPools";
import styles from "./PoolmartPage.module.scss";

// /pools: the list in a panel with the same 16px inset as the explorer's tabs.
export default function PoolmartPage() {
    return (
        <div className={styles.panel}>
            <LiquidityPools />
        </div>
    );
}
