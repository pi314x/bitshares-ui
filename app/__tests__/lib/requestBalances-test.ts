// ChainStore.requestAllDataForAccount reaches for the node's database API without looking whether there
// is one. The account overview calls it in every render, so a render in the seconds after a reconnect
// (or a node switch) took the whole page down ("undefined is not an object (evaluating
// 'db_api().exec')"). The call is made only when the API is there, and a failure is left for the next render.
let mockDb: any = undefined;
const mockRequest = jest.fn();
jest.mock("bitsharesjs-ws", () => ({
    Apis: {instance: () => ({db_api: () => mockDb})}
}));
jest.mock("bitsharesjs", () => ({
    ChainStore: {
        requestAllDataForAccount: (...args: any[]) => mockRequest(...args)
    }
}));

import {requestAllBalances} from "../../lib/chain/requestBalances";

beforeEach(() => {
    mockDb = undefined;
    mockRequest.mockReset();
});

describe("requestAllBalances", () => {
    it("asks for the balances of the account when the API is there", () => {
        mockDb = {exec: jest.fn()};
        requestAllBalances("1.2.100");
        expect(mockRequest).toHaveBeenCalledWith("1.2.100", "balance");
    });

    it("asks for nothing, and does not throw, while there is no API", () => {
        expect(() => requestAllBalances("1.2.100")).not.toThrow();
        expect(mockRequest).not.toHaveBeenCalled();
    });

    it("leaves a failure of the library for the next render", () => {
        mockDb = {exec: jest.fn()};
        mockRequest.mockImplementation(() => {
            throw new TypeError("undefined is not an object");
        });
        expect(() => requestAllBalances("1.2.100")).not.toThrow();
    });
});
