[# summary]

### Activo {symbol}

{description}

Emitido por: {issuer}

[# annual]

Si una membresía vitalicia es demasiado cara, aún puede obtener un {feesCashback} % de cashback durante el próximo año
haciéndose suscriptor anual por solo {price} al año.
![GitHub Logo](/images/logo.png)

[# fee-division]
#### Reparto de comisiones
Cada vez que {account} paga una comisión de transacción, esa comisión se reparte entre varias cuentas distintas. La red se queda
con un {networkFee} %, y el miembro vitalicio que refirió a {account} se lleva un {lifetimeFee} %.

El _registrador_ es la cuenta que pagó la comisión de transacción para registrar a {account} en la red. El registrador decide cómo
repartir el {referrerTotalFee} % restante entre él y su propio programa de _referidor afiliado_.

El registrador de {account} decidió compartir el {referrerFee} % de la comisión total con el _referidor afiliado_ y quedarse con el {registrarFee} % de la comisión total.


#### Comisiones pendientes
Las comisiones pagadas por {account} solo se reparten entre la red, los referidores y los registradores una vez por intervalo de mantenimiento ({maintenanceInterval} segundos). El
próximo mantenimiento será el {nextMaintenanceTime}.

#### Comisiones con vesting

La mayoría de las comisiones están disponibles de inmediato, pero las comisiones superiores a {vestingThreshold}
(como las que se pagan por mejorar su membresía o registrar un nombre de cuenta premium) deben consolidarse (vesting) durante un total de {vestingPeriod} días.
