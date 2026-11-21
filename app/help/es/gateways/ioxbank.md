# Servicio de gateway instantáneo de ioxbank
El servicio de gateway instantáneo de ioxbank conecta criptomonedas entre BitShares y otras blockchains. Las transacciones de blockchain se liquidan inmediatamente en cuanto los bloques se confirman en la blockchain. Las criptomonedas admitidas por ioxbank se identifican fácilmente: llevan el prefijo **IOB.** y se encuentran en la página de exploración de activos.

### Información de transparencia del gateway

## XRP
- [Saldo en XRPL](https://livenet.xrpl.org/accounts/rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y)
- [Suministro actual de IOB.XRP](/asset/IOB.XRP)

## XLM
- [Saldo en XLM](https://stellarchain.io/accounts/GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH)
- [Suministro actual de IOB.XLM](/asset/IOB.XLM)

## Funciones del gateway

### Funciones de IOB.XRP
- Gateway instantáneo
- Importe mín.: 10 XRP
- Sin KYC
- Sin límites
- 0 % de comisión de mercado para maker/taker
- Comisión de retirada baja

### Funciones de IOB.XLM
- Gateway instantáneo
- Importe mín.: 50 XLM
- Sin KYC
- Sin límites
- 0 % de comisión de mercado para maker/taker
- Comisión de retirada baja

## Métodos del gateway

### Depositar/retirar con la interfaz de la billetera de referencia

- **Depósito:** haga clic en *Depositar* en el menú de hamburguesa y elija XRP o XLM; se le mostrará una dirección y (una etiqueta o un memo) que debe usar externamente para depositar; asegúrese de indicar la etiqueta o el memo en el origen de su transacción hacia el gateway.
- **Retirada:** haga clic en *Retirar* en el menú de hamburguesa y elija XRP o XLM; escriba con cuidado su dirección de destino y (la etiqueta o el memo). Si usa la dirección de un exchange y no una propia, utilice exactamente lo que el exchange le proporcionó.

### Depósito de XRP si ya conoce su **user-id** de BitShares
- **Dirección de destino del gateway XRP:** rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y
- **Destino del gateway XRP (etiqueta o memo):** user-id de BitShares (sin 1.2.)

### Depósito de XLM si ya conoce su **user-id** de BitShares
- **Dirección de destino del gateway XLM:** GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH
- **Destino del gateway XLM (etiqueta o memo):** user-id de BitShares (sin 1.2.)

### Retirada manual **enviando** activos

### Retirada de XRP desde su billetera de BitShares a su billetera de XRP
Envíe sus activos **IOB.XRP** a la cuenta de la blockchain de BitShares [ioxbank-gateway](/account/ioxbank-gateway) e incluya en el memo de BitShares su dirección de destino de XRP y el destino (etiqueta o memo) como en los ejemplos siguientes: sustituya *xrp-address* por su dirección de destino de XRP y **tag-or-memo-number** por el número de su destino (etiqueta o memo). Si NO necesita un número (etiqueta o memo), por ejemplo porque posee las claves de la dirección de destino, puede enviar simplemente su activo **IOB.XRP** a [ioxbank-gateway](/account/ioxbank-gateway) e incluir solo su **xrp-destination-address** sin ningún número (etiqueta o memo):

Formato del memo de BitShares
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xrp:**xrp-destination-address**

Ejemplos de memo de BitShares
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**:thanks ioxbank
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**

### Retirada de XLM desde su billetera de BitShares a su billetera de XLM
Envíe sus activos **IOB.XLM** a la cuenta de la blockchain de BitShares [ioxbank-gateway](/account/ioxbank-gateway) e incluya en el memo de BitShares su dirección de destino de XLM y el destino (etiqueta o memo) como en los ejemplos siguientes: sustituya *xlm-address* por su dirección de destino de XLM y **tag-or-memo-number** por el número de su destino (etiqueta o memo). Si NO necesita un número (etiqueta o memo), por ejemplo porque posee las claves de la dirección de destino, puede enviar simplemente su activo **IOB.XLM** a [ioxbank-gateway](/account/ioxbank-gateway) e incluir solo su **xlm-destination-address** sin ningún número (etiqueta o memo):

Formato del memo de BitShares
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xlm:**xlm-destination-address**

Ejemplos de memo de BitShares
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**:thanks ioxbank
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**

## Soporte técnico
- [Soporte en vivo](https://t.me/ioxbank)
- [Abrir un ticket](https://support.ioxbank.com)
