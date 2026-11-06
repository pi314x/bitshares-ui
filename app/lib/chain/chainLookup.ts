// Reads of the chain store that say "not loaded yet" instead of throwing. `ChainStore.getAsset` / `getObject` answer
// undefined (or null for something that does not exist) until the object has arrived - a lookup also starts the fetch and the
// store tells its subscribers when it is in - so a screen that renders before that (a phone on a cold start) must not call
// `.get` / `.getIn` / `.toJS` on the answer.
import {ChainStore} from "bitsharesjs";

/** The asset as the chain store has it, or null while it has not loaded it. */
export function chainAsset(id: string | null | undefined): any | null {
    if (!id) return null;
    return ChainStore.getAsset(id) || null;
}

/** The precision of an asset, or null while the chain store has not loaded it. */
export function chainPrecision(id: string | null | undefined): number | null {
    const asset = chainAsset(id);
    const precision = asset ? asset.get("precision") : undefined;
    return typeof precision === "number" ? precision : null;
}

/** A field of a chain object (a balance object's "balance"), or null while the object is not loaded. */
export function chainField(
    id: string | null | undefined,
    field: string
): any | null {
    if (!id) return null;
    const object = ChainStore.getObject(id);
    if (!object || typeof object.get !== "function") return null;
    const value = object.get(field);
    return value === undefined ? null : value;
}
