import * as React from "react";
import styles from "./TreeSelect.module.scss";
import {useClickOutside} from "../next/hooks/useClickOutside";

// Replaces antd's `TreeSelect` (docs/UI_MIGRATION_PLAN.md §7.3 follow-up
// (d), the last antd widget). Grepped the one real call site before
// designing it (`Utility/NodeSelector.tsx`'s node-region picker): a two-
// level `treeData` (regions -> node URLs), a controlled array `value`,
// `treeCheckable` with `showCheckedStrategy: SHOW_PARENT`, an inline
// search box with a `searchPlaceholder`, `size`, and `style`. So this
// component *is* the checkable multi-select tree with SHOW_PARENT
// semantics - none of antd's other modes (single select, SHOW_ALL/
// SHOW_CHILD, async `loadData`, `treeDataSimpleMode`, `labelInValue`,
// `allowClear`, custom `dropdownRender`) are used anywhere, so none are
// built, and `treeCheckable`/`showCheckedStrategy` are not props.
//
// SHOW_PARENT semantics, as antd's rc-tree-select implements them:
// - a value naming a parent counts as every descendant leaf being checked;
// - a parent whose descendants are *all* checked is represented in the
//   emitted/displayed value by the parent alone (its children are not
//   listed again); a partially-checked parent is represented by the
//   individually-checked descendants.
// Values in `value` that match no node are kept (shown as a tag with the
// raw value, and re-emitted) rather than silently dropped, so a stale
// persisted selection is never lost by merely opening and toggling.
//
// The inline search filters on the node's `value` (antd's default
// `treeNodeFilterProp`) case-insensitively and keeps ancestors of every
// match, auto-expanding them. The dropdown is positioned directly below
// the selection box inside this component's own relatively-positioned
// wrapper (antd rendered it into a caller-supplied container via
// `getPopupContainer`/`dropdownPopupAlign` - `NodeSelector`'s sibling
// `#node-selector--drop-down` div, which only ever served to host it
// right below the box).
export interface TreeSelectNode {
    title: string;
    value: string;
    key?: string;
    children?: TreeSelectNode[];
    [extra: string]: any;
}

export interface TreeSelectProps {
    treeData: TreeSelectNode[];
    value?: string[];
    onChange?: (value: string[]) => void;
    /** Placeholder of the inline search box while nothing is selected. */
    searchPlaceholder?: string;
    size?: "small" | "default" | "large";
    className?: string;
    style?: React.CSSProperties;
}

function isLeaf(node: TreeSelectNode): boolean {
    return !node.children || node.children.length === 0;
}

function leafValues(node: TreeSelectNode): string[] {
    if (isLeaf(node)) return [node.value];
    return (node.children as TreeSelectNode[]).reduce<string[]>(
        (acc, child) => acc.concat(leafValues(child)),
        []
    );
}

function indexTree(
    nodes: TreeSelectNode[],
    into: Map<string, TreeSelectNode> = new Map()
) {
    nodes.forEach(node => {
        into.set(node.value, node);
        if (node.children) indexTree(node.children, into);
    });
    return into;
}

function matches(node: TreeSelectNode, query: string): boolean {
    return (
        String(node.value)
            .toLowerCase()
            .indexOf(query) >= 0
    );
}

function isVisible(node: TreeSelectNode, query: string): boolean {
    if (!query) return true;
    if (matches(node, query)) return true;
    return (node.children || []).some(child => isVisible(child, query));
}

function CheckBox({
    checked,
    indeterminate,
    label,
    onChange
}: {
    checked: boolean;
    indeterminate: boolean;
    label: string;
    onChange: () => void;
}) {
    return (
        <input
            type="checkbox"
            aria-label={label}
            checked={checked}
            ref={el => {
                if (el) el.indeterminate = indeterminate;
            }}
            onChange={onChange}
        />
    );
}

export function TreeSelect({
    treeData,
    value = [],
    onChange,
    searchPlaceholder,
    size = "default",
    className,
    style
}: TreeSelectProps): JSX.Element {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
    const close = React.useCallback(() => setOpen(false), []);
    const wrapRef = useClickOutside<HTMLDivElement>(close, open);

    const index = React.useMemo(() => indexTree(treeData), [treeData]);

    const checkedLeaves = new Set<string>();
    const unknown: string[] = [];
    value.forEach(v => {
        const node = index.get(v);
        if (node) leafValues(node).forEach(l => checkedLeaves.add(l));
        else unknown.push(v);
    });

    function isFullyChecked(node: TreeSelectNode) {
        return leafValues(node).every(l => checkedLeaves.has(l));
    }

    function isPartlyChecked(node: TreeSelectNode) {
        return leafValues(node).some(l => checkedLeaves.has(l));
    }

    function emit(leaves: Set<string>): string[] {
        const out: string[] = [];
        const visit = (node: TreeSelectNode) => {
            const ls = leafValues(node);
            if (isLeaf(node)) {
                if (leaves.has(node.value)) out.push(node.value);
            } else if (ls.every(l => leaves.has(l))) {
                out.push(node.value);
            } else {
                (node.children as TreeSelectNode[]).forEach(visit);
            }
        };
        treeData.forEach(visit);
        return out.concat(unknown);
    }

    function toggle(node: TreeSelectNode) {
        const next = new Set(checkedLeaves);
        const ls = leafValues(node);
        if (ls.every(l => next.has(l))) ls.forEach(l => next.delete(l));
        else ls.forEach(l => next.add(l));
        if (onChange) onChange(emit(next));
    }

    function removeValue(v: string) {
        const node = index.get(v);
        if (node) toggle(node);
        else if (onChange) onChange(value.filter(x => x !== v));
    }

    const selected = emit(checkedLeaves);
    const q = query.trim().toLowerCase();

    function toggleExpanded(v: string) {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(v)) next.delete(v);
            else next.add(v);
            return next;
        });
    }

    function renderNode(node: TreeSelectNode, depth: number): React.ReactNode {
        if (!isVisible(node, q)) return null;
        const hasChildren = !isLeaf(node);
        const isOpen = hasChildren && (q ? true : expanded.has(node.value));
        const full = isFullyChecked(node);
        const partly = !full && isPartlyChecked(node);
        return (
            <li
                key={node.key || node.value}
                role="treeitem"
                aria-expanded={hasChildren ? isOpen : undefined}
            >
                <div
                    className={styles.row}
                    style={{paddingLeft: 8 + depth * 18}}
                >
                    {hasChildren ? (
                        <button
                            type="button"
                            className={styles.expander}
                            aria-label={`${isOpen ? "Collapse" : "Expand"} ${
                                node.title
                            }`}
                            onClick={() => toggleExpanded(node.value)}
                        >
                            {isOpen ? "▾" : "▸"}
                        </button>
                    ) : (
                        <span className={styles.expander} />
                    )}
                    <label className={styles.nodeLabel}>
                        <CheckBox
                            checked={full}
                            indeterminate={partly}
                            label={node.title}
                            onChange={() => toggle(node)}
                        />
                        <span>{node.title}</span>
                    </label>
                </div>
                {isOpen ? (
                    <ul role="group" className={styles.tree}>
                        {(node.children as TreeSelectNode[]).map(child =>
                            renderNode(child, depth + 1)
                        )}
                    </ul>
                ) : null}
            </li>
        );
    }

    const visibleRoots = treeData.filter(node => isVisible(node, q));

    return (
        <div
            ref={wrapRef}
            className={[
                styles.wrap,
                size === "small" ? styles.small : "",
                size === "large" ? styles.large : "",
                className
            ]
                .filter(Boolean)
                .join(" ")}
            style={style}
        >
            <div
                className={styles.box}
                onClick={() => setOpen(true)}
                role="combobox"
                aria-expanded={open}
            >
                {selected.map(v => (
                    <span key={v} className={styles.tag}>
                        {index.get(v)
                            ? (index.get(v) as TreeSelectNode).title
                            : v}
                        <button
                            type="button"
                            className={styles.tagRemove}
                            aria-label={`Remove ${v}`}
                            onClick={e => {
                                e.stopPropagation();
                                removeValue(v);
                            }}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    className={styles.search}
                    value={query}
                    placeholder={selected.length ? "" : searchPlaceholder}
                    onChange={e => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                />
            </div>
            {open ? (
                <div className={styles.dropdown}>
                    {visibleRoots.length ? (
                        <ul role="tree" className={styles.tree}>
                            {visibleRoots.map(node => renderNode(node, 0))}
                        </ul>
                    ) : (
                        <div className={styles.empty}>Not Found</div>
                    )}
                </div>
            ) : null}
        </div>
    );
}
