# Venta en corto de BitAssets

Para aumentar su exposición a BTS y ofrecer liquidez a BitAssets como USD, EUR,
GOLD, etc., puede *tomar prestado* este bitAsset de la red y *venderlo en corto*.
Aquí describimos brevemente el procedimiento.

## Préstamo

La red BitShares es capaz de emitir cualquier cantidad de cualquier BitAsset y
prestarla a los participantes si hay colateral suficiente.

 * *precio de liquidación* (settlement price): el precio de 1 BTS tal como se negocia en exchanges externos.
 * *ratio de colateral de mantenimiento* (MCR): un ratio definido por los testigos como ratio de colateral mínimo requerido
 * *ratio máximo de short squeeze* (MSQR): un ratio definido por los testigos que indica hasta qué punto están protegidos los cortos frente a los short squeezes
 * *protección contra short squeeze* (SQP): define lo máximo que una posición con margen se verá obligada a pagar para cubrirse
 * *precio de llamada* (CP): el precio al que las posiciones cortas/de préstamo reciben una llamada de margen

### Llamada de margen

La red BitShares es capaz de hacer una llamada de margen a las posiciones que no
tienen colateral suficiente para respaldar sus bitAssets prestados. Una llamada de
margen se produce siempre que la oferta de compra más alta es inferior al *precio
de llamada* y superior a la *SQP*.
La posición con margen se verá obligada a vender su colateral siempre que la
oferta más alta de compra del colateral sea inferior al precio de llamada (x/BTS).

```
SQP = settlement price / MSQR
call price = DEBT / COLLATERAL * MCR
```

La llamada de margen toma el colateral, compra acciones del bitAsset prestado a
precios de mercado hasta la SQP y cierra la posición. Los BTS restantes del
colateral se devuelven al cliente.

### Liquidación (settlement)

Los poseedores de cualquier bitAsset pueden solicitar en cualquier momento una
liquidación a un *precio justo*. La liquidación cierra las posiciones de
préstamo/cortas con el ratio de colateral más bajo y vende el colateral para la
liquidación.

## Venta

Tras tomar prestados los bitAssets, pueden venderse libremente en cualquiera de
los mercados correspondientes al precio que un comprador esté dispuesto a pagar.
Con este paso, la venta en corto queda completada y usted está en corto en ese
bitAsset concreto.

## Actualización del ratio de colateral

En cualquier momento, el titular de una posición de préstamo/corta puede modificar
el ratio de colateral para adaptarse con flexibilidad al comportamiento del
mercado. Si se aumenta el ratio de colateral, se bloquea una cantidad adicional de
BTS como colateral, mientras que reducirlo exigirá devolver a la red una cantidad
del BitAsset correspondiente.

## Cobertura

Para cerrar una posición de préstamo/corta hay que poseer la cantidad prestada de
ese bitAsset concreto para entregarla a la red BitShares. Después, los BitAssets
se restan del suministro correspondiente y el colateral se libera y se devuelve a
su propietario.
