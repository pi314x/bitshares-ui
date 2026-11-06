import * as React from "react";
import styles from "./Carousel.module.scss";

// Replaces antd's `Carousel` (react-slick) (docs/UI_MIGRATION_PLAN.md §7.3
// follow-up (c)). Grepped the one real call site before designing it
// (`Layout/NewsHeadline.tsx`'s rotating news banner): `autoplay`,
// `autoplaySpeed={15000}` and `dots={false}` over an array of slide
// elements - nothing else (`effect`, `arrows`, `afterChange`, vertical,
// `slidesToShow`, ref methods such as `.next()`) is used anywhere, so none
// of it is built. Shows one slide at a time and, with `autoplay`, advances
// every `autoplaySpeed` ms (wrapping around), pausing while the pointer is
// over it (react-slick's own `pauseOnHover` default). There is no slide
// transition animation (the same "no animation primitives yet" gap
// already documented for `Modal`/`Tabs`): slides swap instantly.
export interface CarouselProps {
    autoplay?: boolean;
    /** Milliseconds between slides; antd's default is 3000. */
    autoplaySpeed?: number;
    /** Show the slide-selector dots; antd's default is true. */
    dots?: boolean;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

export function Carousel({
    autoplay = false,
    autoplaySpeed = 3000,
    dots = true,
    className,
    style,
    children
}: CarouselProps): JSX.Element {
    const slides = React.Children.toArray(children);
    const count = slides.length;
    const [index, setIndex] = React.useState(0);
    const [paused, setPaused] = React.useState(false);

    React.useEffect(() => {
        if (!autoplay || paused || count < 2) return;
        const id = window.setInterval(
            () => setIndex(i => (i + 1) % count),
            autoplaySpeed
        );
        return () => window.clearInterval(id);
    }, [autoplay, paused, autoplaySpeed, count]);

    const active = count ? Math.min(index, count - 1) : 0;

    return (
        <div
            className={[styles.carousel, className].filter(Boolean).join(" ")}
            style={style}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {slides.map((slide, i) => (
                <div
                    key={i}
                    className={i === active ? styles.slide : styles.hidden}
                    aria-hidden={i !== active}
                >
                    {slide}
                </div>
            ))}
            {dots && count > 1 ? (
                <ul className={styles.dots}>
                    {slides.map((_, i) => (
                        <li key={i}>
                            <button
                                type="button"
                                aria-label={`Slide ${i + 1}`}
                                className={
                                    i === active
                                        ? `${styles.dot} ${styles.dotActive}`
                                        : styles.dot
                                }
                                onClick={() => setIndex(i)}
                            />
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
