# Pools de liquidez

Un pool de liquidez contiene dos activos y permite a cualquiera cambiar uno por el otro a un precio fijado por la proporción de lo que hay en el pool. Nadie tiene que poner una orden y esperar: cambias contra el pool y la transacción se ejecuta al precio mostrado o falla.

## Intercambiar

Abre **Pools de liquidez** en el menú, elige un pool y pulsa **Intercambiar**. Introduce lo que pagas o lo que quieres recibir; el otro campo se calcula con el estado actual del pool. El cuadro muestra

 * el **precio** que obtienes y el **impacto en el precio**, cuánto mueve tu operación el precio del pool. Una operación grande en un pool pequeño cuesta más;
 * la **comisión** del pool, que se descuenta de lo que recibes y se queda en el pool para quienes aportan la liquidez;
 * el **mínimo que recibes**: el importe menos el deslizamiento que aceptas. Si el pool se mueve más que eso antes de que se incluya tu transacción, el intercambio falla en lugar de ejecutarse a peor precio.

El cuadro también compara el mismo importe con el libro de órdenes del par y te dice dónde es mejor el precio. En la página de trading, una línea bajo la cabecera del mercado hace lo mismo para importes pequeños.

## Aportar liquidez

**Añadir / retirar** pone ambos activos en un pool y te da tokens de participación. En **Tu liquidez** ves tu parte de cada pool y lo que vale en cada uno de los dos activos. Al retirar recibes tu parte de ambos activos, menos la comisión de retirada del pool.

Las comisiones que gana un pool se quedan en el pool y aumentan el valor de cada participación. Aportar liquidez conlleva el riesgo de pérdida impermanente: si el precio de un activo se aleja mucho del otro, tu parte del pool puede valer menos que los dos activos si simplemente los hubieras conservado.

## El grafo

La vista **Grafo** dibuja cada activo como un punto y cada pool como una línea entre sus dos activos, para que veas qué activos se pueden cambiar directamente y cuáles solo a través de BTS u otro nodo central.
