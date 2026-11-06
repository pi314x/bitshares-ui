import {
    MAX_FAVORITE_POOLS,
    getFavoritePools,
    reloadFavoritePools,
    toggleFavoritePool
} from "../../lib/common/favoritePools";

const KEY = "__graphene__favoritePools";

beforeEach(() => {
    window.localStorage.clear();
    reloadFavoritePools();
});

describe("favorite pools", () => {
    it("stars a pool by its share asset, newest first, and takes the star away again", () => {
        toggleFavoritePool("1.3.100");
        toggleFavoritePool("1.3.200");
        expect(getFavoritePools()).toEqual(["1.3.200", "1.3.100"]);
        toggleFavoritePool("1.3.200");
        expect(getFavoritePools()).toEqual(["1.3.100"]);
        toggleFavoritePool("1.3.100");
        expect(getFavoritePools()).toEqual([]);
    });

    it("keeps the stars in this browser", () => {
        toggleFavoritePool("1.3.100");
        expect(JSON.parse(window.localStorage.getItem(KEY) || "[]")).toEqual([
            "1.3.100"
        ]);
        reloadFavoritePools();
        expect(getFavoritePools()).toEqual(["1.3.100"]);
    });

    it("does not trust what was kept, or what it is given", () => {
        window.localStorage.setItem(
            KEY,
            JSON.stringify([
                "1.3.5",
                "1.3.5",
                "1.19.7",
                42,
                "<b>",
                null,
                "1.3.6"
            ])
        );
        reloadFavoritePools();
        expect(getFavoritePools()).toEqual(["1.3.5", "1.3.6"]);
        toggleFavoritePool("1.19.9");
        toggleFavoritePool("evil");
        expect(getFavoritePools()).toEqual(["1.3.5", "1.3.6"]);
        window.localStorage.setItem(KEY, "{not json");
        reloadFavoritePools();
        expect(getFavoritePools()).toEqual([]);
    });

    it("keeps no more than the limit: the oldest go", () => {
        for (let i = 0; i < MAX_FAVORITE_POOLS + 5; i++) {
            toggleFavoritePool(`1.3.${1000 + i}`);
        }
        const all = getFavoritePools();
        expect(all).toHaveLength(MAX_FAVORITE_POOLS);
        expect(all[0]).toBe(`1.3.${1000 + MAX_FAVORITE_POOLS + 4}`);
        expect(all).not.toContain("1.3.1000");
    });
});
