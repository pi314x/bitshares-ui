const mockConnect = jest.fn();
const mockState = jest.fn();
jest.mock("../../actions/ExternalSignerActions", () => ({
    __esModule: true,
    default: {
        connect: (...a: any[]) => mockConnect(...a),
        getState: (...a: any[]) => mockState(...a)
    }
}));

import {connectFromChip} from "../../next/extensionChip";

beforeEach(() => {
    mockConnect.mockReset();
    mockState.mockReset();
    mockConnect.mockResolvedValue(undefined);
});

describe("the Connect extension chip of the top bar", () => {
    it("leads to Settings -> Signing, where the reason is shown, when the connection failed", async () => {
        mockState.mockReturnValue({
            status: "disconnected",
            error: "The extension connects only to pages opened over HTTPS"
        });
        const navigate = jest.fn();
        await connectFromChip(navigate);
        expect(mockConnect).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("/settings/signing");
    });

    it("stays where it is when the extension connected", async () => {
        mockState.mockReturnValue({status: "connected", error: null});
        const navigate = jest.fn();
        await connectFromChip(navigate);
        expect(navigate).not.toHaveBeenCalled();
    });

    it("stays where it is when there is nothing to say (the approval window was closed)", async () => {
        mockState.mockReturnValue({status: "disconnected", error: null});
        const navigate = jest.fn();
        await connectFromChip(navigate);
        expect(navigate).not.toHaveBeenCalled();
    });
});
