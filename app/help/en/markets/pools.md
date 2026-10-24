# Liquidity pools

A liquidity pool holds two assets and lets anyone swap one for the other at a price set by the ratio of what is in the pool. Nobody has to place an order and wait: you swap against the pool, and the transaction either goes through at the price shown or fails.

## Swapping

Open **Liquidity pools** in the menu, choose a pool and press **Swap**. Enter what you pay or what you want to receive; the other field is worked out from the pool as it is right now. The dialog shows

 * the **price** you get and the **price impact**, how far your trade moves the pool's price. A large trade in a small pool costs more;
 * the pool's **fee**, taken from what you receive and kept in the pool for the people who provide its liquidity;
 * the **least you receive**: the amount minus the slippage you accept. If the pool moves further than that before your transaction is included, the swap fails instead of filling at a worse price.

The dialog also sets the same amount against the order book of the pair and tells you where the price is better. On the trade page a line under the market header does the same for small amounts.

## Providing liquidity

**Add / remove** puts both assets into a pool and gives you share tokens of it. Under **Your liquidity** you see your part of each pool and what it is worth in each of the two assets. Removing returns your part of both assets, less the pool's withdrawal fee.

The fees a pool earns stay in the pool and raise the value of every share. Providing liquidity carries the risk of impermanent loss: if the price of one asset moves far against the other, your part of the pool can be worth less than the two assets would have been if you had just kept them.

## The graph

The **Graph** view draws every asset as a dot and every pool as a line between its two assets, so you can see which assets can be swapped directly and which only through BTS or another hub.
