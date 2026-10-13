[# summary]

### Asset {symbol}

{description}

Ausgegeben von: {issuer}

[# annual]

Wenn dir eine Lifetime-Mitgliedschaft zu viel ist, bekommst du für das nächste Jahr trotzdem {feesCashback} % Cashback,
wenn du für nur {price} pro Jahr ein Jahresabonnement abschließt.
![GitHub Logo](/images/logo.png)

[# fee-division]
#### Gebührenaufteilung
Jedes Mal, wenn {account} eine Transaktionsgebühr zahlt, wird diese Gebühr auf mehrere Konten aufgeteilt. Das Netzwerk erhält
einen Anteil von {networkFee} %, und das Lifetime-Mitglied, das {account} empfohlen hat, erhält {lifetimeFee} %.

Der _Registrar_ ist das Konto, das die Transaktionsgebühr für die Registrierung von {account} im Netzwerk bezahlt hat. Der Registrar entscheidet, wie er die
verbleibenden {referrerTotalFee} % zwischen sich und seinem eigenen _Affiliate-Referrer_-Programm aufteilt.

Der Registrar von {account} hat sich entschieden, {referrerFee} % der Gesamtgebühr mit dem _Affiliate Referrer_ zu teilen und {registrarFee} % der Gesamtgebühr selbst zu behalten.


#### Ausstehende Gebühren
Von {account} gezahlte Gebühren werden nur einmal pro Wartungsintervall ({maintenanceInterval} Sekunden) auf das Netzwerk, die Referrer und die Registrare aufgeteilt. Die
nächste Wartung ist um {nextMaintenanceTime}.

#### Vesting-Gebühren

Die meisten Gebühren stehen sofort zur Verfügung. Gebühren über {vestingThreshold}
(etwa für das Upgrade deiner Mitgliedschaft oder die Registrierung eines Premium-Kontonamens) müssen insgesamt {vestingPeriod} Tage lang freigegeben werden (Vesting).
