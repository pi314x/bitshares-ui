// TypeScript port of the legacy backupUtils.js (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import {ChainConfig} from "bitsharesjs-ws";

export function backupName(
    walletName: string,
    date: Date = new Date()
): string {
    let name = walletName;
    const address_prefix = (ChainConfig as any).address_prefix.toLowerCase();
    if (name.indexOf(address_prefix) !== 0) name = address_prefix + "_" + name;

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const stampedName = `${name}_${date.getFullYear()}${
        month >= 10 ? month : "0" + month
    }${day >= 10 ? day : "0" + day}`;

    name = stampedName + ".bin";
    return name;
}
