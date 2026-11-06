# Abstimmung

> Abstimmen ist in BitShares genauso wichtig wie in der Gemeinschaft, in der du lebst. Das Gewicht deiner Stimme entspricht direkt der Menge BTS, die du besitzt. Wenn du dich nicht stark in der Community engagierst, solltest du einen Proxy wählen, der deine Interessen vertritt. Wenn du dich mehr einbringen möchtest, schau dir diese [Kanäle](/help/introduction/bitshares) an.

## Proxy

Du kannst dich entscheiden, bei der Verwaltung von BitShares **nicht** aktiv mitzuwirken. In diesem Fall ist es wichtig, dass du jemanden aus der BitShares-Community wählst, mit dem du dich identifizieren kannst, und diese Instanz als deinen Proxy festlegst. Damit erhält sie die Möglichkeit, in deinem Namen abzustimmen, und deine BTS stehen hinter ihrer Stimme. Das ist vergleichbar mit der Wahl eines Vertreters.

## Witnesses

Witnesses sind Instanzen, die für die Blockchain arbeiten, indem sie neue Blöcke erzeugen. Ihre Rolle ähnelt der der Miner bei Bitcoin und anderen Blockchains. Jeder Witness wird von den Anteilseignern genehmigt, erzeugt aus validierten Transaktionen Blöcke und signiert sie. Jede Transaktion im Netzwerk muss von allen Witnesses validiert werden.

### Konsensmechanismus

Wer zu welchem Zeitpunkt einen Block *erzeugen* darf, legt ein Konsensverfahren
fest, das *Delegated Proof of Stake* heißt. Im Kern könnt ihr, die Anteilseigner von
BitShares, auf der Blockchain für eure bevorzugten Blockproduzenten abstimmen. Diese *Witnesses* mit den meisten Stimmen dürfen Blöcke erzeugen.


## Komitee

Das Komitee besteht aus Instanzen, die von den Anteilseignern genehmigt werden und die Richtlinien der BitShares-Blockchain festlegen, darunter:

* Transaktions- und Handelsgebühren
* Blockchain-Parameter wie Blockgröße und Blockintervall
* Empfehlungs- und Vesting-Parameter wie den Cashback-Prozentsatz und die Vesting-Zeiträume

## Worker

Worker sind Vorschläge, eine Leistung gegen ein Gehalt aus der Blockchain zu erbringen. Ein Worker-Vorschlag enthält mindestens folgende Angaben:

* Ein Start- und ein Enddatum
* Eine tägliche Vergütung
* Eine maximale Gesamtvergütung
* Einen Link zu einer Webseite, auf der der Worker-Vorschlag erläutert wird

### Lebenszyklus eines Workers

#### Vorgeschlagen
Diese Worker-Vorschläge wurden bei der Blockchain eingereicht und es wird aktiv über sie abgestimmt. Um aktiv zu werden, müssen sie insgesamt mehr Stimmen als der Worker refund400k erhalten.
#### Aktiv
Diese Worker-Vorschläge haben die Schwelle überschritten und werden aktiv bezahlt. Aktive Worker können ihre Finanzierung verlieren, wenn ihre Stimmenzahl unter die des Workers refund400k fällt.
#### Abgelaufen
Diese Worker-Vorschläge werden zu historischen Zwecken angezeigt. Hier findest du Vorschläge, deren Enddatum erreicht ist.

### Funktionsweise des Worker-Budgets
Worker erhalten ihre Vergütung aus einem festen Tagesbudget nach dem Prinzip „wer zuerst kommt, mahlt zuerst“, bis keine Mittel mehr übrig sind.

* Ein Tagesbudget von insgesamt 400k BTS für alle Worker
* 5 Worker-Vorschläge mit positiver Stimmensumme und einer täglichen Forderung von je 100k BTS

Die vier Worker mit den meisten Stimmen erhalten nun täglich je 100k BTS, aber danach ist das Worker-Budget aufgebraucht. Der fünfte Worker erhält deshalb nichts.
