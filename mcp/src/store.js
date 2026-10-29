"use strict";
// Where the server keeps its ledger (policy.js): a JSON file. Node only - the application's
// bundle never imports this file.
const {UserError} = require("./format");

/**
 * A ledger kept in a JSON file (mode 600, replaced as a whole). A file that exists but cannot
 * be read as a ledger refuses everything until it is removed: a limit that cannot be checked
 * does not pass.
 */
function fileStore(file, fs) {
    const io = fs || require("fs");
    return {
        load() {
            let text;
            try {
                text = io.readFileSync(file, "utf8");
            } catch (e) {
                if (e && e.code === "ENOENT") return {prepared: [], sold: {}};
                throw new UserError(
                    `The limits file ${file} cannot be read (${e &&
                        e.code}); nothing is prepared until it can.`,
                    "state_unreadable"
                );
            }
            try {
                const data = JSON.parse(text);
                const prepared = (data.prepared || []).map(e => ({
                    t: Number(e.t)
                }));
                const sold = {};
                Object.keys(data.sold || {}).forEach(symbol => {
                    sold[symbol] = data.sold[symbol].map(e => ({
                        t: Number(e.t),
                        units: BigInt(String(e.units))
                    }));
                });
                if (
                    prepared.some(e => !Number.isFinite(e.t)) ||
                    Object.keys(sold).some(k =>
                        sold[k].some(e => !Number.isFinite(e.t))
                    )
                ) {
                    throw new Error("bad entry");
                }
                return {prepared, sold};
            } catch (e) {
                throw new UserError(
                    `The limits file ${file} is damaged; remove it to start counting again. Nothing is prepared until then.`,
                    "state_unreadable"
                );
            }
        },
        save(state) {
            const sold = {};
            Object.keys(state.sold).forEach(symbol => {
                sold[symbol] = state.sold[symbol].map(e => ({
                    t: e.t,
                    units: e.units.toString()
                }));
            });
            const temporary = `${file}.${process.pid}.tmp`;
            io.writeFileSync(
                temporary,
                JSON.stringify({prepared: state.prepared, sold}),
                {mode: 0o600}
            );
            io.renameSync(temporary, file);
        }
    };
}

module.exports = {fileStore};
