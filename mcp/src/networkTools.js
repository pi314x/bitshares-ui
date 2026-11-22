"use strict";
// The network tools: what a block holds, who produces the blocks and who is voted for, the workers
// that are paid out of the reserve, and how one account voted. They only READ the chain (what the
// Explorer and the Voting pages show): nothing here builds, signs or sends a transaction.
const {UserError, fromUnits, cleanText} = require("./format");
const OPERATION_NAMES = require("./opnames");

const CORE = "1.3.0";
const ID_CHUNK = 100;
/** The transactions of a block that are listed one by one; the rest are only counted. */
const TX_SHOWN = 30;
const OPS_SHOWN = 20;
/** Proxy-to-self: the account that has not named a proxy points at this one. */
const NO_PROXY = "1.2.5";
const WORKER_KINDS = ["refund", "vesting", "burn"];

const big = v => BigInt(String(v));

function createNetworkHandlers({db, getAsset, getAccount}) {
    /** Core units as a decimal in BTS, using the core asset's own precision. */
    async function coreFormatter(ctx) {
        const core = await getAsset(ctx, CORE);
        return units => fromUnits(big(units), core.precision);
    }

    /** `get_accounts` over any number of ids, as a map id -> name. */
    async function accountNames(ctx, ids) {
        const unique = Array.from(new Set(ids.filter(Boolean)));
        const names = {};
        for (let i = 0; i < unique.length; i += ID_CHUNK) {
            const rows =
                (await db(ctx, "get_accounts", [
                    unique.slice(i, i + ID_CHUNK)
                ])) || [];
            rows.forEach(row => {
                if (row) names[row.id] = cleanText(row.name, 64);
            });
        }
        return names;
    }

    /** The records of ids (witnesses, committee members), read in chunks of what the node answers. */
    async function records(ctx, method, ids) {
        const out = [];
        for (let i = 0; i < ids.length; i += ID_CHUNK) {
            const rows =
                (await db(ctx, method, [ids.slice(i, i + ID_CHUNK)])) || [];
            rows.forEach(row => {
                if (row) out.push(row);
            });
        }
        return out;
    }

    /**
     * The candidates of an election, most votes first: the node lists their names, then their records.
     * `activeIds` are those that hold a seat now.
     */
    async function candidates(ctx, args, spec) {
        const [properties, listed, format] = await Promise.all([
            db(ctx, "get_global_properties", []),
            db(ctx, spec.lookup, ["", 1000]),
            coreFormatter(ctx)
        ]);
        const active = new Set(properties[spec.activeKey] || []);
        const nameOf = {};
        (listed || []).forEach(pair => {
            nameOf[pair[1]] = cleanText(pair[0], 64);
        });
        const rows = await records(ctx, spec.fetch, Object.keys(nameOf));
        rows.sort((a, b) => {
            const d = big(b.total_votes) - big(a.total_votes);
            return d > BigInt(0) ? 1 : d < BigInt(0) ? -1 : 0;
        });
        const ranked = rows.map((row, index) => ({row, rank: index + 1}));
        const shown = ranked
            .filter(entry => !args.active_only || active.has(entry.row.id))
            .slice(0, args.limit || 30);
        return {
            registered: (listed || []).length,
            seats: active.size,
            count: shown.length,
            list: shown.map(({row, rank}) => ({
                rank,
                name: nameOf[row.id] || row.id,
                id: row.id,
                has_a_seat: active.has(row.id),
                votes: format(row.total_votes),
                url: row.url ? cleanText(row.url, 120) : null,
                extra: spec.extra(row)
            }))
        };
    }

    return {
        async bitshares_get_block(ctx, args) {
            const properties = await db(
                ctx,
                "get_dynamic_global_properties",
                []
            );
            const head = properties.head_block_number;
            const number = args.block === undefined ? head : args.block;
            const block = await db(ctx, "get_block", [number]);
            if (!block) {
                throw new UserError(
                    `There is no block ${number} yet: the head block is ${head}.`,
                    "not_found"
                );
            }
            let producer = {id: block.witness};
            try {
                const witness = ((await db(ctx, "get_witnesses", [
                    [block.witness]
                ])) || [])[0];
                if (witness) {
                    const names = await accountNames(ctx, [
                        witness.witness_account
                    ]);
                    producer = {
                        id: witness.id,
                        account:
                            names[witness.witness_account] ||
                            witness.witness_account
                    };
                }
            } catch (e) {
                // the block is still told, without the producer's name
            }
            const transactions = block.transactions || [];
            const byType = {};
            let operations = 0;
            const listed = transactions.slice(0, TX_SHOWN).map((tx, index) => {
                const names = (tx.operations || []).map(
                    op => OPERATION_NAMES[op[0]] || "operation_" + op[0]
                );
                return {
                    index,
                    operation_count: names.length,
                    operations: names.slice(0, OPS_SHOWN)
                };
            });
            transactions.forEach(tx =>
                (tx.operations || []).forEach(op => {
                    const name = OPERATION_NAMES[op[0]] || "operation_" + op[0];
                    byType[name] = (byType[name] || 0) + 1;
                    operations++;
                })
            );
            return {
                number,
                head_block_number: head,
                time: block.timestamp ? String(block.timestamp) + " UTC" : null,
                producer,
                transaction_count: transactions.length,
                operation_count: operations,
                operations_by_type: byType,
                transactions: listed,
                transactions_not_listed: Math.max(
                    0,
                    transactions.length - TX_SHOWN
                )
            };
        },

        async bitshares_get_witnesses(ctx, args) {
            const out = await candidates(ctx, args, {
                lookup: "lookup_witness_accounts",
                fetch: "get_witnesses",
                activeKey: "active_witnesses",
                extra: row => ({
                    missed_blocks: row.total_missed,
                    last_confirmed_block: row.last_confirmed_block_num
                })
            });
            return {
                registered: out.registered,
                active_seats: out.seats,
                count: out.count,
                witnesses: out.list.map(w =>
                    Object.assign(
                        {
                            rank: w.rank,
                            name: w.name,
                            id: w.id,
                            active: w.has_a_seat,
                            votes: w.votes + " BTS",
                            url: w.url
                        },
                        w.extra
                    )
                ),
                note:
                    "Votes are the BTS stake behind each witness, as the chain counts them."
            };
        },

        async bitshares_get_committee_members(ctx, args) {
            const out = await candidates(ctx, args, {
                lookup: "lookup_committee_member_accounts",
                fetch: "get_committee_members",
                activeKey: "active_committee_members",
                extra: () => ({})
            });
            return {
                registered: out.registered,
                active_seats: out.seats,
                count: out.count,
                committee_members: out.list.map(m => ({
                    rank: m.rank,
                    name: m.name,
                    id: m.id,
                    active: m.has_a_seat,
                    votes: m.votes + " BTS",
                    url: m.url
                })),
                note:
                    "Votes are the BTS stake behind each member, as the chain counts them."
            };
        },

        async bitshares_get_workers(ctx, args) {
            const [rows, format, properties] = await Promise.all([
                db(ctx, "get_all_workers", [false]),
                coreFormatter(ctx),
                db(ctx, "get_dynamic_global_properties", [])
            ]);
            const nowMs = Date.parse(String(properties.time) + "Z");
            const net = w =>
                big(w.total_votes_for || 0) - big(w.total_votes_against || 0);
            const sorted = (rows || []).slice().sort((a, b) => {
                const d = net(b) - net(a);
                return d > BigInt(0) ? 1 : d < BigInt(0) ? -1 : 0;
            });
            const shown = sorted.slice(0, args.limit || 30);
            const names = await accountNames(
                ctx,
                shown.map(w => w.worker_account)
            );
            const stateOf = w => {
                const begin = Date.parse(String(w.work_begin_date) + "Z");
                const end = Date.parse(String(w.work_end_date) + "Z");
                if (
                    Number.isFinite(nowMs) &&
                    Number.isFinite(begin) &&
                    nowMs < begin
                )
                    return "waiting to start";
                if (
                    Number.isFinite(nowMs) &&
                    Number.isFinite(end) &&
                    nowMs > end
                )
                    return "ended";
                return "working";
            };
            return {
                count: shown.length,
                workers_total: sorted.length,
                workers: shown.map(w => ({
                    id: w.id,
                    name: cleanText(w.name, 100),
                    account: names[w.worker_account] || w.worker_account,
                    kind: WORKER_KINDS[(w.worker || [])[0]] || "other",
                    state: stateOf(w),
                    daily_pay: format(w.daily_pay) + " BTS",
                    votes_for: format(w.total_votes_for || 0),
                    votes_against: format(w.total_votes_against || 0),
                    net_votes: format(net(w)),
                    starts: String(w.work_begin_date) + " UTC",
                    ends: String(w.work_end_date) + " UTC",
                    url: w.url ? cleanText(w.url, 120) : null
                })),
                note:
                    "kind: refund returns the pay to the reserve, vesting pays the worker's account over time, burn destroys it. Votes are BTS stake."
            };
        },

        async bitshares_get_account_votes(ctx, args) {
            const account = await getAccount(ctx, args.account);
            const options = account.options || {};
            const voteIds = options.votes || [];
            const proxyId = options.voting_account;
            const hasProxy = !!proxyId && proxyId !== NO_PROXY;
            const found = [];
            for (let i = 0; i < voteIds.length; i += ID_CHUNK) {
                const rows =
                    (await db(ctx, "lookup_vote_ids", [
                        voteIds.slice(i, i + ID_CHUNK)
                    ])) || [];
                rows.forEach(row => {
                    if (row) found.push(row);
                });
            }
            const names = await accountNames(
                ctx,
                [hasProxy ? proxyId : null].concat(
                    found.map(
                        row =>
                            row.witness_account ||
                            row.committee_member_account ||
                            row.worker_account
                    )
                )
            );
            const chosen = new Set(voteIds);
            const pick = (prefix, build) =>
                found.filter(row => row.id.indexOf(prefix) === 0).map(build);
            const witnesses = pick("1.6.", row => ({
                id: row.id,
                name: names[row.witness_account] || row.witness_account
            }));
            const committee = pick("1.5.", row => ({
                id: row.id,
                name:
                    names[row.committee_member_account] ||
                    row.committee_member_account
            }));
            const workers = pick("1.14.", row => ({
                id: row.id,
                name: cleanText(row.name, 100),
                vote: chosen.has(row.vote_for) ? "for" : "against"
            }));
            return {
                account: {id: account.id, name: account.name},
                proxy: hasProxy
                    ? {id: proxyId, name: names[proxyId] || proxyId}
                    : null,
                votes: voteIds.length,
                witnesses_wanted: options.num_witness,
                committee_members_wanted: options.num_committee,
                witnesses,
                committee_members: committee,
                workers,
                not_resolved: voteIds.length - found.length,
                note: hasProxy
                    ? "This account has named a proxy: the chain counts the proxy's votes, not the ones listed here. Ask for the proxy's account to see what counts."
                    : "These are the votes that count, weighted by the account's BTS stake."
            };
        }
    };
}

module.exports = {createNetworkHandlers};
