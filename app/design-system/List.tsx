import * as React from "react";
import styles from "./List.module.scss";

// Replaces antd's `List`/`List.Item`/`List.Item.Meta` (docs/UI_MIGRATION_PLAN.md
// §7.3 follow-up (b)). Grepped the one real call site before designing it
// (`Explorer/Assets.tsx`'s prediction-market list): `dataSource` +
// `renderItem`, `size="large"`, `itemLayout="horizontal"`, `style`, and
// client-side `pagination={{position: "bottom", pageSize}}`; each item is
// a `List.Item` with an `actions` array (right-aligned links) wrapping a
// `List.Item.Meta` (`title` + `description`). Nothing else is real
// anywhere (no `avatar`, `grid`, `header`/`footer`, `loadMore`, vertical
// layout, or server-side pagination), so none of that is built.
//
// `itemLayout` is accepted for API compatibility but is a no-op (only
// "horizontal" is ever used, and it is this component's only layout).
// `pagination.position` is likewise accepted and ignored: the pager is
// always rendered below the items, the only position in use.
export interface ListPaginationConfig {
    pageSize?: number;
    /** Accepted for API compatibility; the pager is always at the bottom. */
    position?: "top" | "bottom" | "both";
}

export interface ListProps<T = any> {
    dataSource: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    size?: "default" | "large" | "small";
    /** Accepted for API compatibility; "horizontal" is the only layout. */
    itemLayout?: "horizontal" | "vertical";
    pagination?: ListPaginationConfig | false;
    className?: string;
    style?: React.CSSProperties;
}

const DEFAULT_PAGE_SIZE = 10;

function ListBase<T = any>({
    dataSource,
    renderItem,
    size = "default",
    pagination,
    className,
    style
}: ListProps<T>): JSX.Element {
    const [page, setPage] = React.useState(1);

    const paginated = pagination !== undefined && pagination !== false;
    const pageSize = (pagination && pagination.pageSize) || DEFAULT_PAGE_SIZE;
    const pageCount = paginated
        ? Math.max(1, Math.ceil(dataSource.length / pageSize))
        : 1;
    const currentPage = Math.min(page, pageCount);
    const visible = paginated
        ? dataSource.slice((currentPage - 1) * pageSize, currentPage * pageSize)
        : dataSource;
    const offset = paginated ? (currentPage - 1) * pageSize : 0;

    return (
        <div
            className={[
                styles.list,
                size === "large" ? styles.large : "",
                size === "small" ? styles.small : "",
                className
            ]
                .filter(Boolean)
                .join(" ")}
            style={style}
        >
            <div role="list">
                {visible.map((item, i) => (
                    <React.Fragment key={offset + i}>
                        {renderItem(item, offset + i)}
                    </React.Fragment>
                ))}
            </div>
            {paginated && pageCount > 1 ? (
                <div className={styles.pagination}>
                    <button
                        type="button"
                        className={styles.pageButton}
                        disabled={currentPage <= 1}
                        onClick={() => setPage(currentPage - 1)}
                    >
                        ‹
                    </button>
                    <span>
                        {currentPage} / {pageCount}
                    </span>
                    <button
                        type="button"
                        className={styles.pageButton}
                        disabled={currentPage >= pageCount}
                        onClick={() => setPage(currentPage + 1)}
                    >
                        ›
                    </button>
                </div>
            ) : null}
        </div>
    );
}

export interface ListItemProps {
    /** Rendered right-aligned, after the item's content. */
    actions?: React.ReactNode[];
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

function ListItem({actions, className, style, children}: ListItemProps) {
    return (
        <div
            role="listitem"
            className={[styles.item, className].filter(Boolean).join(" ")}
            style={style}
        >
            <div className={styles.itemContent}>{children}</div>
            {actions && actions.length ? (
                <ul className={styles.actions}>
                    {actions.map((action, i) => (
                        <li key={i}>{action}</li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

export interface ListItemMetaProps {
    title?: React.ReactNode;
    description?: React.ReactNode;
}

function ListItemMeta({title, description}: ListItemMetaProps) {
    return (
        <div className={styles.meta}>
            {title !== undefined ? (
                <div className={styles.metaTitle}>{title}</div>
            ) : null}
            {description !== undefined ? (
                <div className={styles.metaDescription}>{description}</div>
            ) : null}
        </div>
    );
}

const ListItemWithMeta = Object.assign(ListItem, {Meta: ListItemMeta});

export const List = Object.assign(ListBase, {Item: ListItemWithMeta});
