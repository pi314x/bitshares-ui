// TypeScript/functional-component port of the legacy Assets.jsx (the
// "/explorer/assets" tab) and its trivial AssetsContainer.jsx wrapper
// (Phase 2, docs/UI_MIGRATION_PLAN.md). Read-only public chain-explorer
// data, same lower-risk category as the other Explorer tables.
//
// Two confirmed-dead props dropped, both injected by AssetsContainer.jsx
// but never read anywhere in Assets.jsx: `filterMPA` and `filterUIA`
// (from SettingsStore's viewSettings). `filterSearch` was also injected
// as a prop name but AssetsContainer never actually provided it, so it
// was always `undefined` there too - the port keeps the resulting
// `useState(() => "")` behavior without the pointless prop plumbing.
// Also dropped `_onFilter(type, e)`, defined but never called anywhere, and
// a `placeholder` variable (computed via counterpart.translate but never
// passed to any prop in the original either).
//
// The legacy "user" and "market" filter modes had byte-for-byte
// identical `columns` array definitions (only their filter *predicate*
// over `assets` differed) - consolidated into one shared `columns`
// definition here since duplicating it changes nothing observable.
//
// `_checkAssets`'s incremental-fetch/pagination logic (fetch 100 assets
// at a time, using a localStorage-cached total-asset-count estimate to
// know when to stop) is ported as faithfully as the class-to-hooks
// translation allows, including one subtlety: the legacy code's final
// "stop loading" check reads `this.state.assetsFetched` *before* the
// `setState({assetsFetched: ...})` earlier in the same call has taken
// effect (React state updates are deferred, not applied mid-function) -
// so it's always one batch behind. This port reads the same closure
// variable throughout the function body, which reproduces that same
// staleness for free (hooks' setters are equally deferred within one
// function execution).
import * as React from "react";
import AssetActions from "actions/AssetActions";
import {Link, LinkProps} from "react-router-dom";
import Translate from "react-translate-component";
import LinkToAccountById from "../Utility/LinkToAccountById";
import assetUtils from "common/asset_utils";
import FormattedAsset from "../Utility/FormattedAsset";
import AssetName from "../Utility/AssetName";
import {ChainStore} from "bitsharesjs";
import ls from "common/localStorage";
import {Apis} from "bitsharesjs-ws";
import {Radio, Table, Select, Icon} from "bitshares-ui-style-guide";
import {List} from "antd";
import SearchInput from "../Utility/SearchInput";
import AssetStore from "stores/AssetStore";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const accountStorage = ls("__graphene__");
const TypedSearchInput = SearchInput as React.ComponentType<any>;
const TypedLink = Link as React.ComponentType<LinkProps>;

type FilterMode = "market" | "user" | "prediction";

interface AssetRow {
    symbol: string;
    issuer: string;
    currentSupply: any;
    assetId: string;
    marketId: string;
}

function computeInitialChainID(): string {
    const chainId = (Apis as any).instance().chain_id;
    return chainId ? chainId.substr(0, 8) : "4018d784";
}

function computeInitialTotalAssets(chainID: string): number {
    const stored = accountStorage.get(`totalAssets_${chainID}`);
    if (typeof stored != "object") return stored;
    return chainID && chainID === "4018d784" ? 3000 : 50;
}

function linkToAccount(nameOrId: string | undefined) {
    if (!nameOrId) return <span>-</span>;
    return <LinkToAccountById account={nameOrId} />;
}

function buildMarketId(asset: any, coreAsset: any): string {
    const description = assetUtils.parseDescription(asset.options.description);
    return (
        asset.symbol +
        "_" +
        (description.market
            ? description.market
            : coreAsset
            ? coreAsset.get("symbol")
            : "BTS")
    );
}

export default function Assets() {
    useChainStoreTick();
    const assetState = useAltStore<any>(AssetStore);
    const assets: Immutable.Map<string, any> = assetState.assets;

    const [chainID] = React.useState(computeInitialChainID);
    const [totalAssets] = React.useState(() =>
        computeInitialTotalAssets(chainID)
    );
    const [isLoading, setIsLoading] = React.useState(false);
    const [assetsFetched, setAssetsFetched] = React.useState(0);
    const [activeFilter, setActiveFilter] = React.useState<FilterMode>(
        "market"
    );
    const [filterSearch, setFilterSearch] = React.useState("");
    const [rowsOnPage, setRowsOnPage] = React.useState("25");

    function checkAssets(currentAssets: Immutable.Map<string, any>, force?: boolean) {
        setIsLoading(true);
        const lastAsset = currentAssets
            .sort((a: any, b: any) =>
                a.symbol > b.symbol ? 1 : a.symbol < b.symbol ? -1 : 0
            )
            .last();

        if (currentAssets.size === 0 || force) {
            (AssetActions.getAssetList as any).defer("A", 100);
            setAssetsFetched(100);
        } else if (currentAssets.size >= assetsFetched) {
            (AssetActions.getAssetList as any).defer(lastAsset.symbol, 100);
            setAssetsFetched(assetsFetched + 99);
        }

        if (currentAssets.size > totalAssets) {
            accountStorage.set(`totalAssets_${chainID}`, currentAssets.size);
        }

        if (assetsFetched >= totalAssets - 100) {
            setIsLoading(false);
        }
    }

    const isFirstRun = React.useRef(true);
    React.useEffect(() => {
        checkAssets(assets, isFirstRun.current);
        isFirstRun.current = false;
        // eslint-disable-next-line
    }, [assets]);

    function handleFilterChange(e: React.ChangeEvent<HTMLInputElement>) {
        setFilterSearch((e.target.value || "").toUpperCase());
    }

    function toggleFilter(e: any) {
        setActiveFilter(e.target.value);
    }

    const coreAsset = ChainStore.getAsset("1.3.0");

    const listColumns = [
        {
            key: "symbol",
            title: "symbol",
            dataIndex: "symbol",
            defaultSortOrder: "ascend" as const,
            sorter: (a: AssetRow, b: AssetRow) =>
                a.symbol > b.symbol ? 1 : a.symbol < b.symbol ? -1 : 0,
            render: (item: string) => (
                <TypedLink to={`/asset/${item}`}>
                    <AssetName name={item} />
                </TypedLink>
            )
        },
        {
            key: "issuer",
            title: "issuer",
            dataIndex: "issuer",
            sorter: (a: AssetRow, b: AssetRow) => {
                let issuerA: any = ChainStore.getAccount(a.issuer, false);
                let issuerB: any = ChainStore.getAccount(b.issuer, false);
                if (issuerA) issuerA = issuerA.get("name");
                if (issuerB) issuerB = issuerB.get("name");
                if (issuerA > issuerB) return 1;
                if (issuerA < issuerB) return -1;
                return 0;
            },
            render: (item: string) => linkToAccount(item)
        },
        {
            key: "currentSupply",
            title: "Supply",
            dataIndex: "currentSupply",
            sorter: (a: AssetRow, b: AssetRow) => {
                a.currentSupply = parseFloat(a.currentSupply);
                b.currentSupply = parseFloat(b.currentSupply);
                return a.currentSupply > b.currentSupply
                    ? 1
                    : a.currentSupply < b.currentSupply
                    ? -1
                    : 0;
            },
            render: (item: any, record: AssetRow) => (
                <FormattedAsset
                    amount={record.currentSupply}
                    asset={record.assetId}
                    hide_asset={true}
                />
            )
        },
        {
            key: "marketId",
            title: "",
            dataIndex: "marketId",
            render: (item: string) => (
                <TypedLink to={`/market/${item}`}>
                    <Icon type={"line-chart"} /> <Translate content="header.exchange" />
                </TypedLink>
            )
        }
    ];

    let columns: typeof listColumns = [];
    const dataSource: AssetRow[] = [];
    let predictionMarkets: any[] = [];

    if (activeFilter === "user" || activeFilter === "market") {
        columns = listColumns;
        assets
            .filter((a: any) =>
                activeFilter === "user"
                    ? !a.market_asset && a.symbol.indexOf(filterSearch) !== -1
                    : a.bitasset_data &&
                      !a.bitasset_data.is_prediction_market &&
                      a.symbol.indexOf(filterSearch) !== -1
            )
            .forEach((asset: any) => {
                dataSource.push({
                    symbol: asset.symbol,
                    issuer: asset.issuer,
                    currentSupply: asset.dynamic.current_supply,
                    assetId: asset.id,
                    marketId: buildMarketId(asset, coreAsset)
                });
            });
    }

    if (activeFilter === "prediction") {
        predictionMarkets = assets
            .filter((a: any) => {
                const description = assetUtils.parseDescription(
                    a.options.description
                );
                return (
                    a.bitasset_data &&
                    a.bitasset_data.is_prediction_market &&
                    (a.symbol.toLowerCase().indexOf(filterSearch.toLowerCase()) !==
                        -1 ||
                        description.main
                            .toLowerCase()
                            .indexOf(filterSearch.toLowerCase()) !== -1)
                );
            })
            .sort((a: any, b: any) =>
                a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0
            )
            .map((asset: any) => ({
                asset,
                description: assetUtils.parseDescription(asset.options.description),
                marketID: buildMarketId(asset, coreAsset)
            }))
            .valueSeq()
            .toArray();
    }

    return (
        <div className="grid-block vertical">
            <div className="grid-block vertical">
                <div className="grid-block main-content small-12 medium-10 medium-offset-1 main-content vertical">
                    <div className="generic-bordered-box">
                        <div style={{textAlign: "left", marginBottom: "24px"}}>
                            <span
                                style={{
                                    display: "inline-block",
                                    width: "0px",
                                    marginTop: "2px",
                                    float: "left",
                                    fontSize: "18px"
                                }}
                            >
                                {isLoading ? <Icon type="loading" /> : null}
                            </span>
                            <TypedSearchInput
                                value={filterSearch}
                                style={{width: "200px"}}
                                onChange={handleFilterChange}
                            />
                            <Radio.Group
                                value={activeFilter}
                                onChange={toggleFilter}
                                style={{marginBottom: "7px", marginLeft: "24px"}}
                            >
                                <Radio value={"market"}>
                                    <Translate content="explorer.assets.market" />
                                </Radio>
                                <Radio value={"user"}>
                                    <Translate content="explorer.assets.user" />
                                </Radio>
                                <Radio value={"prediction"}>
                                    <Translate content="explorer.assets.prediction" />
                                </Radio>
                            </Radio.Group>

                            <Select
                                style={{width: "150px", marginLeft: "24px"}}
                                value={rowsOnPage}
                                onChange={setRowsOnPage}
                            >
                                <Select.Option key={"10"}>10 rows</Select.Option>
                                <Select.Option key={"25"}>25 rows</Select.Option>
                                <Select.Option key={"50"}>50 rows</Select.Option>
                                <Select.Option key={"100"}>
                                    100 rows
                                </Select.Option>
                                <Select.Option key={"200"}>
                                    200 rows
                                </Select.Option>
                            </Select>
                        </div>

                        {activeFilter === "prediction" ? (
                            <List
                                style={{paddingBottom: 20}}
                                size="large"
                                itemLayout="horizontal"
                                dataSource={predictionMarkets}
                                renderItem={(item: any) => (
                                    <List.Item
                                        key={item.asset.id.split(".")[2]}
                                        actions={[
                                            <TypedLink
                                                key="exchange"
                                                className="button outline"
                                                to={`/market/${item.marketID}`}
                                            >
                                                <Translate content="header.exchange" />
                                            </TypedLink>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={
                                                <div>
                                                    <span
                                                        style={{
                                                            paddingTop: 10,
                                                            fontWeight: "bold"
                                                        }}
                                                    >
                                                        <TypedLink
                                                            to={`/asset/${item.asset.symbol}`}
                                                        >
                                                            <AssetName
                                                                name={item.asset.symbol}
                                                            />
                                                        </TypedLink>
                                                    </span>
                                                    {item.description.condition ? (
                                                        <span>
                                                            {" "}
                                                            ({item.description.condition})
                                                        </span>
                                                    ) : null}
                                                </div>
                                            }
                                            description={
                                                <span>
                                                    {item.description ? (
                                                        <div
                                                            style={{
                                                                padding:
                                                                    "10px 20px 5px 0",
                                                                lineHeight: "18px"
                                                            }}
                                                        >
                                                            {item.description.main}
                                                        </div>
                                                    ) : null}
                                                    <span
                                                        style={{
                                                            padding: "0 20px 5px 0",
                                                            lineHeight: "18px"
                                                        }}
                                                    >
                                                        <LinkToAccountById
                                                            account={item.asset.issuer}
                                                        />
                                                        <span>
                                                            {" "}
                                                            -{" "}
                                                            <FormattedAsset
                                                                amount={
                                                                    item.asset.dynamic
                                                                        .current_supply
                                                                }
                                                                asset={item.asset.id}
                                                            />
                                                        </span>
                                                        {item.description.expiry ? (
                                                            <span>
                                                                {" "}
                                                                - {item.description.expiry}
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                </span>
                                            }
                                        />
                                    </List.Item>
                                )}
                                pagination={{
                                    position: "bottom" as any,
                                    pageSize: rowsOnPage as any
                                }}
                            />
                        ) : (
                            <Table
                                style={{width: "100%", marginTop: "16px"}}
                                rowKey="symbol"
                                columns={columns}
                                dataSource={dataSource}
                                pagination={{
                                    pageSize: rowsOnPage as any,
                                    total: dataSource.length
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
