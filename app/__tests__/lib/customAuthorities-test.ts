import "../../lib/chain/extraOperations";
import {ops} from "bitsharesjs";
import {ChainConfig} from "bitsharesjs-ws";
import vectors from "../fixtures/coreOperationVectors.json";
import {
    authorityIdsFromHistory,
    buildAuthority,
    buildCustomAuthorityCreate,
    buildCustomAuthorityDelete,
    buildCustomAuthorityUpdate,
    chainTimeFromLocal,
    customAuthorityLimits,
    isInForce,
    localFromChainTime,
    normalizeCustomAuthority,
    parseRestrictionIds,
    parseWeightedLines,
    restrictionCount
} from "../../lib/common/customAuthorities";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ByteBuffer: any = require("bytebuffer");
const operation = (ops as any).operation;
const vector = (name: string) => (vectors as any)[name];
const KEY = vector("custom_authority_create").op[1].auth.key_auths[0][0];

beforeAll(() => {
    (ChainConfig as any).setPrefix("BTS");
});

function hexOf(object: any): string {
    const bb = new ByteBuffer(
        ByteBuffer.DEFAULT_CAPACITY,
        ByteBuffer.LITTLE_ENDIAN
    );
    operation.appendByteBuffer(bb, operation.fromObject(object));
    bb.flip();
    return bb.toHex();
}

const authority = () => {
    const built = buildAuthority({
        threshold: "1",
        accounts: [{id: "1.2.6", weight: "1"}],
        keys: [{key: KEY, weight: "1"}]
    });
    if (!built.ok) throw new Error("authority");
    return built.op;
};

const NOW = Date.parse("2029-06-01T00:00:00Z") / 1000;
const limits = {
    max_custom_authority_lifetime_seconds: 365 * 86400,
    max_custom_authorities_per_account: 10,
    max_custom_authorities_per_account_op: 5,
    max_custom_authority_restrictions: 4
};

describe("buildAuthority", () => {
    it("takes accounts and keys with weights", () => {
        expect(authority()).toEqual({
            weight_threshold: 1,
            account_auths: [["1.2.6", 1]],
            key_auths: [[KEY, 1]],
            address_auths: []
        });
    });

    it("refuses what would let anyone sign, or nobody", () => {
        const base = {accounts: [{id: "1.2.6", weight: "1"}], keys: []};
        expect(buildAuthority({...base, threshold: "0"})).toMatchObject({
            ok: false,
            error: "authority_invalid"
        });
        expect(buildAuthority({...base, threshold: "2"})).toMatchObject({
            ok: false,
            error: "authority_invalid"
        });
        expect(
            buildAuthority({threshold: "1", accounts: [], keys: []})
        ).toMatchObject({ok: false, error: "authority_missing"});
        expect(
            buildAuthority({
                threshold: "1",
                accounts: [{id: "1.2.6", weight: "0"}],
                keys: []
            })
        ).toMatchObject({ok: false, error: "authority_invalid"});
    });

    it("refuses a key that is not one, an account that is not an id, a repeat", () => {
        expect(
            buildAuthority({
                threshold: "1",
                accounts: [],
                keys: [{key: "BTS-not-a-key", weight: "1"}]
            })
        ).toMatchObject({ok: false, error: "authority_invalid"});
        expect(
            buildAuthority({
                threshold: "1",
                accounts: [{id: "alice", weight: "1"}],
                keys: []
            })
        ).toMatchObject({ok: false, error: "authority_invalid"});
        expect(
            buildAuthority({
                threshold: "1",
                accounts: [
                    {id: "1.2.6", weight: "1"},
                    {id: "1.2.6", weight: "1"}
                ],
                keys: []
            })
        ).toMatchObject({ok: false, error: "authority_invalid"});
    });
});

describe("times", () => {
    it("turn a local time into the chain's UTC time and back", () => {
        const chain = chainTimeFromLocal("2030-05-06T07:08");
        expect(chain).toMatch(/^2030-05-0[56]T\d\d:08:00$/);
        expect(localFromChainTime(chain as string)).toBe("2030-05-06T07:08");
        expect(chainTimeFromLocal("2030-05-06 07:08:09")).toMatch(/:09$/);
        expect(chainTimeFromLocal("soon")).toBeNull();
        expect(chainTimeFromLocal("2030-13-40T00:00")).toBeNull();
    });
});

describe("restrictionCount", () => {
    it("counts nested restrictions as the chain does", () => {
        expect(restrictionCount([])).toBe(0);
        // the fixture: 10 at the top, one more inside the attr, two inside the or
        expect(
            restrictionCount(
                vector("custom_authority_create").op[1].restrictions
            )
        ).toBe(13);
        expect(
            restrictionCount(
                vector("custom_authority_create variant_assert").op[1]
                    .restrictions
            )
        ).toBe(2);
    });
});

describe("buildCustomAuthorityCreate", () => {
    const base = () => ({
        accountId: "1.2.5",
        operationId: 0,
        enabled: true,
        validFrom: "2029-06-01T00:00:00",
        validTo: "2029-12-01T00:00:00",
        authority: authority(),
        restrictions: [] as any[],
        limits,
        now: NOW
    });

    it("makes an operation the library serializes", () => {
        const built = buildCustomAuthorityCreate(base());
        expect(built.ok).toBe(true);
        if (built.ok) {
            expect(() => hexOf([54, built.op])).not.toThrow();
            expect(built.op.operation_type).toBe(0);
        }
    });

    it("makes the operation the node serializes the same way", () => {
        const node = vector("custom_authority_create").op[1];
        const built = buildCustomAuthorityCreate({
            accountId: node.account,
            operationId: node.operation_type,
            enabled: node.enabled,
            validFrom: node.valid_from,
            validTo: node.valid_to,
            authority: node.auth,
            restrictions: node.restrictions,
            limits: null,
            now: Date.parse("2029-12-31T00:00:00Z") / 1000
        });
        expect(built.ok).toBe(true);
        if (built.ok) {
            expect(hexOf([54, built.op])).toBe(
                vector("custom_authority_create").hex
            );
        }
    });

    it("applies the chain's rules", () => {
        const refuse = (changes: any, error: string, detail?: string) =>
            expect(
                buildCustomAuthorityCreate({...base(), ...changes})
            ).toMatchObject(
                detail ? {ok: false, error, detail} : {ok: false, error}
            );
        refuse({validFrom: "2029-12-01T00:00:00"}, "valid_range");
        refuse(
            {validTo: "2029-01-01T00:00:00", validFrom: "2028-01-01T00:00:00"},
            "valid_range",
            "past"
        );
        refuse({validTo: "2031-01-01T00:00:00"}, "valid_range", "lifetime");
        refuse({validFrom: null}, "valid_range");
        refuse({operationId: 9}, "operation_invalid");
        refuse({operationId: 57}, "operation_invalid");
        refuse({accountId: "1.2.0"}, "account_missing", "special");
        refuse({accountId: null}, "account_missing");
        refuse(
            {restrictions: [1, 2, 3, 4, 5].map(() => ({argument: [2, "1"]}))},
            "restrictions_invalid",
            "count"
        );
    });

    it("does not check limits a chain has not set (the main network has none)", () => {
        const built = buildCustomAuthorityCreate({
            ...base(),
            limits: null,
            validTo: "2039-01-01T00:00:00"
        });
        expect(built.ok).toBe(true);
    });
});

describe("buildCustomAuthorityUpdate", () => {
    const base = {
        accountId: "1.2.5",
        authorityId: "1.17.3",
        enabled: null,
        validFrom: null,
        validTo: null,
        authority: null,
        remove: [] as number[],
        add: [] as any[]
    };

    it("makes the operation the node serializes the same way", () => {
        const node = vector("custom_authority_update").op[1];
        const built = buildCustomAuthorityUpdate({
            ...base,
            enabled: node.new_enabled,
            validFrom: node.new_valid_from,
            validTo: node.new_valid_to,
            authority: node.new_auth,
            remove: node.restrictions_to_remove,
            add: node.restrictions_to_add
        });
        expect(built.ok).toBe(true);
        if (built.ok) {
            expect(hexOf([55, built.op])).toBe(
                vector("custom_authority_update").hex
            );
        }
    });

    it("sends only what changes", () => {
        const built = buildCustomAuthorityUpdate({...base, enabled: false});
        expect(built.ok && Object.keys(built.op).sort()).toEqual(
            [
                "account",
                "authority_to_update",
                "extensions",
                "fee",
                "new_enabled",
                "restrictions_to_add",
                "restrictions_to_remove"
            ].sort()
        );
        const minimal = buildCustomAuthorityUpdate({...base, remove: [2]});
        expect(minimal.ok).toBe(true);
        if (minimal.ok) expect(() => hexOf([55, minimal.op])).not.toThrow();
    });

    it("must change something, keep the order of the times, name a real authority", () => {
        expect(buildCustomAuthorityUpdate(base)).toMatchObject({
            ok: false,
            error: "nothing_changed"
        });
        expect(
            buildCustomAuthorityUpdate({
                ...base,
                validFrom: "2030-01-02T00:00:00",
                validTo: "2030-01-01T00:00:00"
            })
        ).toMatchObject({ok: false, error: "valid_range"});
        expect(
            buildCustomAuthorityUpdate({
                ...base,
                authorityId: "1.7.3",
                enabled: true
            })
        ).toMatchObject({ok: false, error: "id_invalid"});
    });
});

describe("buildCustomAuthorityDelete", () => {
    it("makes the operation the node serializes the same way", () => {
        const built = buildCustomAuthorityDelete({
            accountId: "1.2.5",
            authorityId: "1.17.3"
        });
        expect(built.ok).toBe(true);
        if (built.ok) {
            expect(hexOf([56, built.op])).toBe(
                vector("custom_authority_delete").hex
            );
        }
        expect(
            buildCustomAuthorityDelete({accountId: "1.2.5", authorityId: "x"})
        ).toMatchObject({ok: false});
    });
});

describe("what the chain holds", () => {
    it("reads the chain parameters' limits, none where it has set none", () => {
        expect(customAuthorityLimits({extensions: {}})).toBeNull();
        expect(
            customAuthorityLimits({
                extensions: {custom_authority_options: limits}
            })
        ).toEqual(limits);
    });

    it("normalizes an authority and knows when it is in force", () => {
        const authority = normalizeCustomAuthority({
            id: "1.17.2",
            account: "1.2.5",
            enabled: true,
            valid_from: "2030-01-01T00:00:00",
            valid_to: "2031-01-01T00:00:00",
            operation_type: 0,
            auth: {},
            restrictions: []
        });
        expect(authority).toMatchObject({id: "1.17.2", operationType: 0});
        const at = (iso: string) => Date.parse(iso + "Z") / 1000;
        expect(isInForce(authority!, at("2029-12-31T23:59:59"))).toBe(false);
        expect(isInForce(authority!, at("2030-06-01T00:00:00"))).toBe(true);
        expect(isInForce(authority!, at("2031-01-01T00:00:00"))).toBe(false);
        expect(
            isInForce(
                {...authority!, enabled: false},
                at("2030-06-01T00:00:00")
            )
        ).toBe(false);
        expect(normalizeCustomAuthority({id: "1.7.2"})).toBeNull();
    });

    it("finds an account's authorities in its history", () => {
        const ids = authorityIdsFromHistory([
            {op: [54, {}], result: [1, "1.17.4"]},
            {op: [54, {}], result: [1, "1.17.9"]},
            {op: [55, {authority_to_update: "1.17.4"}], result: [0, {}]},
            {op: [56, {authority_to_delete: "1.17.9"}], result: [0, {}]},
            {op: [0, {}], result: [0, {}]}
        ]);
        expect(ids.sort()).toEqual(["1.17.4", "1.17.9"]);
    });

    it("reads a list of restriction ids", () => {
        expect(parseRestrictionIds("1, 2 3")).toEqual([1, 2, 3]);
        expect(parseRestrictionIds("")).toEqual([]);
        expect(parseRestrictionIds("a")).toBeNull();
        expect(parseRestrictionIds("70000")).toBeNull();
    });
});

describe("parseWeightedLines", () => {
    it("reads a name and a weight per line, one by default", () => {
        expect(parseWeightedLines("alice 2\nbob\n\n  carol: 3 ")).toEqual([
            {token: "alice", weight: "2"},
            {token: "bob", weight: "1"},
            {token: "carol", weight: "3"}
        ]);
        expect(parseWeightedLines("")).toEqual([]);
        expect(parseWeightedLines("alice 1 2")).toBeNull();
    });
});
