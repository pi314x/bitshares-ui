import {Asset as AssetClass, Price as PriceClass} from "common/MarketClasses";
import {applyMarketPrice, withMarketPrice} from "../../lib/common/orderForm";

// (the classes are plain JavaScript; the form's state is `any` as in the exchange)
const Asset: any = AssetClass;
const Price: any = PriceClass;

// BTS (5 decimals) is the base of the market, USDT (4 decimals) its quote
const BTS = {asset_id: "1.3.0", precision: 5};
const USDT = {asset_id: "1.3.100", precision: 4};

// the two forms as the exchange opens them (initialOrderState)
function emptyForm(isBid: boolean) {
    const forSale = new Asset(isBid ? BTS : USDT);
    const toReceive = new Asset(isBid ? USDT : BTS);
    return {
        forSaleText: "",
        toReceiveText: "",
        priceText: "",
        for_sale: forSale,
        to_receive: toReceive,
        price: isBid
            ? new Price({base: forSale, quote: toReceive})
            : new Price({base: toReceive, quote: forSale})
    };
}

// an order of the book sells USDT for BTS: 10 USDT for 120 BTS, 12 BTS apiece
const askSellPrice = () =>
    new Price({
        base: new Asset({...USDT, amount: 100000}),
        quote: new Asset({...BTS, amount: 12000000})
    });

describe("lib/common/orderForm: the order forms' market price", () => {
    it("puts the price in an empty buy form, inverted to what the form shows", () => {
        const form = emptyForm(true);
        const result = withMarketPrice(form, true, askSellPrice());
        expect(result).not.toBe(form);
        expect(result.price.isValid()).toBe(true);
        expect(result.priceText).toBeCloseTo(
            askSellPrice()
                .invert()
                .toReal(),
            8
        );
        expect(result.priceText).toBeGreaterThan(0);
        // no amount yet: nothing else is filled in
        expect(result.forSaleText).toBe("");
        expect(result.toReceiveText).toBe("");
    });

    it("puts the price in an empty sell form as it is", () => {
        const result = withMarketPrice(emptyForm(false), false, askSellPrice());
        expect(result.priceText).toBeCloseTo(askSellPrice().toReal(), 8);
    });

    it("leaves a form alone that has a price, an amount or a total, or has no price to use", () => {
        const typed = {...emptyForm(true), priceText: "0.5"};
        expect(withMarketPrice(typed, true, askSellPrice())).toBe(typed);

        const withAmount = emptyForm(true);
        withAmount.to_receive.setAmount({real: 3});
        expect(withMarketPrice(withAmount, true, askSellPrice())).toBe(
            withAmount
        );

        const withTotal = emptyForm(true);
        withTotal.for_sale.setAmount({real: 3});
        expect(withMarketPrice(withTotal, true, askSellPrice())).toBe(
            withTotal
        );

        const empty = emptyForm(true);
        expect(withMarketPrice(empty, true, null)).toBe(empty);
    });

    it("works out the other side when an amount is there (the click replaces a price)", () => {
        const form = emptyForm(true);
        form.to_receive.setAmount({real: 2});
        form.priceText = "0.5";
        const result = applyMarketPrice(form, true, askSellPrice());
        // 2 USDT at the market price, paid in BTS
        expect(result.for_sale.getAmount({real: true})).toBeCloseTo(
            2 *
                askSellPrice()
                    .invert()
                    .toReal(),
            4
        );
        expect(result.forSaleText).not.toBe("");
    });
});
