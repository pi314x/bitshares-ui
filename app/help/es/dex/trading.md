# Trading

Esta página ofrece una introducción muy rápida sobre cómo interpretar los
términos que usa el DEX y cómo se presentan los pares de trading.

## Pares

En BitShares casi cualquier activo puede negociarse con todos los demás. Una vez
elegidos dos activos, solemos hablar de un *par de mercado*. Por ejemplo,
podemos negociar USD contra EUR en el par USD:EUR.

Por coherencia, usaremos los términos generalizados *base* y *quote*, de modo que
los pares se representan como

    *quote* : *base*

y, por ejemplo, con *base* igual a USD y *quote* igual a EUR, se obtiene el par
EUR:USD.

## Libros de órdenes

El libro de órdenes consta de un lado *ask* (venta) y un lado *bid* (compra). Como
los pares de trading no tienen una orientación preferida y pueden invertirse, la
siguiente tabla ofrece un resumen de ask/bid y de las operaciones de
compra/venta correspondientes a cada lado:

| Lado       | Vender  | Comprar |
| ---------- | ------- | ------- |
| Ask        | *quote* | *base*  |
| Bid        | *base*  | *quote* |
| ---------- | ------- | ------- |

Obviamente, lo que está en el lado bid del par USD:EUR estará en el lado ask del
par EUR:USD. Por supuesto, los precios se representan internamente como
fracciones, por lo que ambos pares resultan idénticos.

## Operar

Para colocar una orden hay que rellenar el formulario del lado *ask* o del lado
*bid* (respectivamente, el lado de *compra* o de *venta*). Deberá definir un
*precio* y una *cantidad* para vender o comprar. El coste de esta orden se
calculará automáticamente. Tenga en cuenta que se requiere una comisión adicional
para colocar la orden.

Cuando la orden se ejecuta (es decir, alguien vendió o compró su oferta), se
acreditará en su cuenta el activo correspondiente.

Las órdenes sin ejecutar pueden cancelarse en cualquier momento.
