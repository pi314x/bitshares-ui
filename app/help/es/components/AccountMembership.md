[# lifetime]
### Obtenga un {feesCashback} % de cashback en comisiones

Cada transacción de la red BitShares se reparte entre la red y los referidores. Al registrarse como miembro vitalicio, la cuenta recibirá un {feesCashback} % de cashback en cada comisión de transacción pagada. Como bonificación, también podrá obtener ingresos por referidos de los usuarios registrados con ella o referidos a la red.

El precio de una membresía vitalicia cambiará con el tiempo; ahora mismo es de solo {price}.

[# fee-division]
#### Reparto de comisiones
Cada vez que {account} paga una comisión de transacción, esa comisión se reparte entre varias cuentas distintas. La red se queda
con un {networkFee} %, y el miembro vitalicio que refirió a {account} se lleva un {lifetimeFee} %.

El registrador es la cuenta que pagó la comisión de transacción para registrar a {account} en la red. El registrador decide cómo repartir el {referrerTotalFee} % restante entre él y su propio programa de referidor afiliado.

El registrador de {account} decidió compartir el {referrerFee} % de la comisión total con el referidor afiliado y quedarse con el {registrarFee} % de la comisión total.


#### Comisiones pendientes
Las comisiones pagadas por {account} se reparten entre la red, los referidores y los registradores una vez por intervalo de mantenimiento ({maintenanceInterval} segundos). El
próximo mantenimiento será el {nextMaintenanceTime}.

#### Comisiones con vesting

La mayoría de las comisiones están disponibles de inmediato, pero las comisiones superiores a {vestingThreshold}
(como las que se pagan por mejorar su membresía o registrar un nombre de cuenta premium) deben consolidarse (vesting) durante un total de {vestingPeriod} días.

