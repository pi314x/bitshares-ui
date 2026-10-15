[# lifetime]
### {feesCashback} % Cashback auf Gebühren erhalten

Jede Transaktion im BitShares-Netzwerk wird zwischen dem Netzwerk und den Referrern aufgeteilt. Mit einer Lifetime-Mitgliedschaft erhält das Konto {feesCashback} % Cashback auf jede gezahlte Transaktionsgebühr. Als Bonus kann es außerdem Empfehlungseinnahmen von Nutzern erzielen, die über das Konto im Netzwerk registriert wurden oder an das Netzwerk verwiesen wurden.

Der Preis einer Lifetime-Mitgliedschaft ändert sich mit der Zeit, derzeit beträgt er nur {price}.

[# fee-division]
#### Gebührenaufteilung
Jedes Mal, wenn {account} eine Transaktionsgebühr zahlt, wird diese Gebühr auf mehrere Konten aufgeteilt. Das Netzwerk erhält
einen Anteil von {networkFee} %, und das Lifetime-Mitglied, das {account} empfohlen hat, erhält {lifetimeFee} %.

Der Registrar ist das Konto, das die Transaktionsgebühr für die Registrierung von {account} im Netzwerk bezahlt hat. Der Registrar entscheidet, wie er die verbleibenden {referrerTotalFee} % zwischen sich und seinem eigenen Affiliate-Referrer-Programm aufteilt.

Der Registrar von {account} hat sich entschieden, {referrerFee} % der Gesamtgebühr mit dem Affiliate Referrer zu teilen und {registrarFee} % der Gesamtgebühr selbst zu behalten.


#### Ausstehende Gebühren
Von {account} gezahlte Gebühren werden einmal pro Wartungsintervall ({maintenanceInterval} Sekunden) auf das Netzwerk, die Referrer und die Registrare aufgeteilt. Die
nächste Wartung ist um {nextMaintenanceTime}.

#### Vesting-Gebühren

Die meisten Gebühren stehen sofort zur Verfügung. Gebühren über {vestingThreshold}
(etwa für das Upgrade deiner Mitgliedschaft oder die Registrierung eines Premium-Kontonamens) müssen insgesamt {vestingPeriod} Tage lang freigegeben werden (Vesting).

