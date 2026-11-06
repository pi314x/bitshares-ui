// In the production bundle `ops` is a module namespace: its existing members cannot be
// assigned. The fixes therefore change the library's own serializer objects where they
// stand. (A file of its own: the registry here must not hold the library already fixed.)
it("changes the library's own serializers where they stand", () => {
    jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const {ops} = require("bitsharesjs");
        const before = ops.custom_authority_create;
        const typesBefore = before.types;
        const restrictionBefore = ops.restriction;
        const feeScheduleBefore = ops.fee_schedule;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("../../lib/chain/extraOperations");
        expect(ops.custom_authority_create).toBe(before);
        expect(ops.restriction).toBe(restrictionBefore);
        expect(ops.fee_schedule).toBe(feeScheduleBefore);
        expect(before.types).not.toBe(typesBefore);
        // the operation list the transaction serializer reads holds the same object
        expect(ops.operation.st_operations[54]).toBe(before);
    });
});
