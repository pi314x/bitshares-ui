// The page for the AI assistants' side of BitShares Desk (MCP, docs/MCP.md): what the MCP
// server is, how to connect an assistant to it, every tool with its arguments and its
// annotations, and how trading through an assistant is kept safe. The tool
// list is the server's own catalog (mcp/src/catalog.js), so the page cannot describe a tool
// the server does not have. Only in a build made with MCP_ENABLED=true.
import * as React from "react";
import counterpart from "counterpart";
import {Alert} from "../../design-system/Alert";
import {Button} from "../../design-system/Button";
import {SubMenu} from "../../design-system/SubMenu";
import {copyText} from "../../lib/common/clipboard";
import {mcpTrading} from "../../lib/common/mcpFlags";
import {TOOLS} from "../../../mcp/src/catalog";
import styles from "./Mcp.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`mcp.${key}`, params) as string;

interface Tool {
    name: string;
    title: string;
    group: string;
    requires?: string;
    description: string;
    annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
    };
    inputSchema: {
        properties: Record<string, {type: string; description?: string}>;
        required?: string[];
    };
}

/** Text with `code` in backticks as code. */
function rich(text: string): React.ReactNode[] {
    return text
        .split(/`([^`]+)`/)
        .map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}

const SERVER = "/path/to/bitshares-ui/mcp/server.js";

type Client = "local" | "http";

/** The settings the trading tools need, when the build has them (the same names as the
 * example file; the accounts and limits are examples to change). */
function environment(trading: boolean): Record<string, string> {
    return trading
        ? {
              MCP_ENABLED: "true",
              MCP_TRADING_ENABLED: "true",
              MCP_TRADING_ACCOUNTS: "alice",
              MCP_TRADE_LIMITS: "BTS:1000:5000,XBTSX.USDT:100:500"
          }
        : {MCP_ENABLED: "true"};
}

const SCHEMA = "https://opencode.ai/config.json";
const TOKEN = "<the token>";

/** What to show for connecting opencode: one or more blocks of text, each with a caption
 * key. `local` is a server opencode starts itself; `http` is one that is already running. */
function snippets(
    client: Client,
    trading: boolean
): Array<{key: string; text: string}> {
    if (client === "local") {
        return [
            {
                key: "config",
                text: JSON.stringify(
                    {
                        $schema: SCHEMA,
                        mcp: {
                            desk: {
                                type: "local",
                                command: ["node", SERVER],
                                enabled: true,
                                environment: environment(trading)
                            }
                        }
                    },
                    null,
                    2
                )
            }
        ];
    }
    const env = environment(trading);
    const start =
        Object.keys(env)
            .map(name => `${name}=${env[name]}`)
            .join(" \\\n  ") +
        ` \\\n  MCP_TRANSPORT=http MCP_AUTH_TOKEN=${TOKEN} \\\n  node ${SERVER}`;
    return [
        {key: "token", text: `node ${SERVER} --new-token`},
        {key: "start", text: start},
        {
            key: "config",
            text: JSON.stringify(
                {
                    $schema: SCHEMA,
                    mcp: {
                        desk: {
                            type: "remote",
                            url: "http://127.0.0.1:8765/mcp",
                            enabled: true,
                            headers: {Authorization: `Bearer ${TOKEN}`}
                        }
                    }
                },
                null,
                2
            )
        }
    ];
}

function CodeBlock({text}: {text: string}) {
    const [copied, setCopied] = React.useState(false);
    return (
        <div className={styles.codeWrap}>
            <pre className={styles.code}>{text}</pre>
            <span className={styles.copy}>
                <Button
                    size="small"
                    onClick={() => {
                        copyText(text).then(ok => {
                            setCopied(ok);
                            if (ok) setTimeout(() => setCopied(false), 1500);
                        });
                    }}
                >
                    {t(copied ? "copied" : "copy")}
                </Button>
            </span>
        </div>
    );
}

/** The annotations of a tool as chips; each chip says what it means in its title. */
function Chips({tool}: {tool: Tool}) {
    const a = tool.annotations;
    const chips: Array<{text: string; title: string; tone: string}> = [];
    chips.push(
        a.readOnlyHint
            ? {
                  text: t("chip.read_only"),
                  title: t("annotations.read_only"),
                  tone: "good"
              }
            : {
                  text: t("chip.not_read_only"),
                  title: t("annotations.not_read_only"),
                  tone: "care"
              }
    );
    if (!a.readOnlyHint && a.destructiveHint) {
        chips.push({
            text: t("chip.destructive"),
            title: t("annotations.destructive"),
            tone: "bad"
        });
    }
    if (a.idempotentHint && a.readOnlyHint) {
        chips.push({
            text: t("chip.repeatable"),
            title: t("annotations.idempotent"),
            tone: "plain"
        });
    }
    chips.push(
        a.openWorldHint
            ? {
                  text: t("chip.open_world"),
                  title: t("annotations.open_world"),
                  tone: "plain"
              }
            : {
                  text: t("chip.local"),
                  title: t("annotations.local"),
                  tone: "plain"
              }
    );
    return (
        <span className={styles.chips}>
            {chips.map(chip => (
                <span
                    key={chip.text}
                    className={`${styles.chip} ${styles[`chip_${chip.tone}`]}`}
                    title={chip.title}
                >
                    {chip.text}
                </span>
            ))}
        </span>
    );
}

function ToolCard({tool}: {tool: Tool}) {
    const props = tool.inputSchema.properties || {};
    const names = Object.keys(props);
    // a closed card shows what the tool is called and how it is annotated; the description
    // and the arguments open under it
    return (
        <details className={styles.tool} data-tool={tool.name}>
            <summary className={styles.toolHead}>
                <span className={styles.chevron} aria-hidden="true" />
                <span className={styles.toolTitle}>{tool.title}</span>
                <code className={styles.toolName}>{tool.name}</code>
                <Chips tool={tool} />
            </summary>
            <div className={styles.toolBody}>
                <p className={styles.toolText}>{rich(tool.description)}</p>
                {names.length ? (
                    <ul className={styles.args}>
                        {names.map(name => (
                            <li key={name}>
                                <span className={styles.argHead}>
                                    <code>{name}</code>
                                    <span className={styles.argType}>
                                        {props[name].type}
                                        {(
                                            tool.inputSchema.required || []
                                        ).indexOf(name) !== -1
                                            ? `, ${t("required")}`
                                            : ""}
                                    </span>
                                </span>
                                <span className={styles.argText}>
                                    {rich(props[name].description || "")}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className={styles.noArgs}>{t("no_arguments")}</p>
                )}
            </div>
        </details>
    );
}

const LAYERS = [
    "keys",
    "off",
    "limits",
    "price",
    "review",
    "reference",
    "client",
    "untrusted",
    "http"
];

export default function McpPage() {
    const trading = mcpTrading();
    const [client, setClient] = React.useState<Client>("local");
    const tools = (TOOLS as unknown) as Tool[];
    const groups = [
        {id: "read", tools: tools.filter(tool => tool.group === "read")},
        {id: "trade", tools: tools.filter(tool => tool.group === "trade")}
    ];

    return (
        <div className={styles.page}>
            <h2 className={styles.title}>{t("title")}</h2>
            <p className={styles.lead}>{t("intro")}</p>

            <section className={styles.card} aria-label={t("status.title")}>
                <h3 className={styles.heading}>{t("status.title")}</h3>
                <ul className={styles.status}>
                    <li>
                        <span className={`${styles.dot} ${styles.dotOn}`} />
                        {t("status.page")}
                    </li>
                    <li>
                        <span
                            className={`${styles.dot} ${
                                trading ? styles.dotOn : styles.dotOff
                            }`}
                        />
                        {t(
                            trading ? "status.trading_on" : "status.trading_off"
                        )}
                    </li>
                </ul>
                <p className={styles.muted}>{t("status.note")}</p>
            </section>

            <section className={styles.card} aria-label={t("connect.title")}>
                <h3 className={styles.heading}>{t("connect.title")}</h3>
                <p className={styles.muted}>{t("connect.intro")}</p>
                <SubMenu
                    toggle
                    flush
                    aria-label={t("connect.title")}
                    items={[
                        {key: "local", label: t("connect.tab_local")},
                        {key: "http", label: t("connect.tab_http")}
                    ]}
                    value={client}
                    onChange={key => setClient(key as Client)}
                />
                <p className={styles.muted}>
                    {rich(t(`connect.text_${client}`))}
                </p>
                {snippets(client, trading).map(block => (
                    <div key={block.key} className={styles.block}>
                        <span className={styles.blockLabel}>
                            {t(`connect.step_${block.key}_${client}`)}
                        </span>
                        <CodeBlock text={block.text} />
                    </div>
                ))}
                <p className={styles.muted}>{rich(t("connect.check"))}</p>
            </section>

            <section className={styles.card} aria-label={t("tools.title")}>
                <h3 className={styles.heading}>{t("tools.title")}</h3>
                <p className={styles.muted}>{t("tools.intro")}</p>
                <details className={styles.legend}>
                    <summary>{t("annotations.title")}</summary>
                    <ul>
                        {[
                            "read_only",
                            "not_read_only",
                            "destructive",
                            "idempotent",
                            "open_world",
                            "local"
                        ].map(key => (
                            <li key={key}>{t(`annotations.${key}`)}</li>
                        ))}
                    </ul>
                </details>
                {groups.map(group => (
                    <div key={group.id} className={styles.group}>
                        <h4 className={styles.groupTitle}>
                            {t(`tools.group_${group.id}`)}
                            <span className={styles.count}>
                                {group.tools.length}
                            </span>
                        </h4>
                        {group.id === "trade" ? (
                            <Alert
                                type={trading ? "warning" : "info"}
                                showIcon
                                message={t(
                                    trading
                                        ? "tools.trade_on_title"
                                        : "tools.trade_off_title"
                                )}
                                description={t(
                                    trading
                                        ? "tools.trade_on"
                                        : "tools.trade_off"
                                )}
                            />
                        ) : null}
                        <div className={styles.toolList}>
                            {group.tools.map(tool => (
                                <ToolCard key={tool.name} tool={tool} />
                            ))}
                        </div>
                    </div>
                ))}
            </section>

            <section className={styles.card} aria-label={t("security.title")}>
                <h3 className={styles.heading}>{t("security.title")}</h3>
                <p className={styles.muted}>{t("security.intro")}</p>
                <ol className={styles.layers}>
                    {LAYERS.map(id => (
                        <li key={id}>
                            <strong>{t(`security.${id}_title`)}</strong>
                            <span>{t(`security.${id}_text`)}</span>
                        </li>
                    ))}
                </ol>
                <Alert
                    type="info"
                    showIcon
                    message={t("security.not_done_title")}
                    description={t("security.not_done_text")}
                />
                <Alert
                    type="warning"
                    showIcon
                    message={t("security.residual_title")}
                    description={t("security.residual_text")}
                />
            </section>

            <p className={styles.muted}>{t("docs")}</p>
        </div>
    );
}
