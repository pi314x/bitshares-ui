// The "Connect extension" chip of the top bar. A click that ends with nothing to see is the worst answer: the reason a
// connection failed (the page is not on HTTPS, the extension is locked, it is on another network ...) is shown by
// Settings -> Signing, so that is where a failed click leads.
import ExternalSignerActions from "../actions/ExternalSignerActions";

export async function connectFromChip(
    navigate: (to: string) => void
): Promise<void> {
    await ExternalSignerActions.connect();
    const after = ExternalSignerActions.getState();
    if (after.error && after.status !== "connected") {
        navigate("/settings/signing");
    }
}
