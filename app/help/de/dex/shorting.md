# BitAssets leerverkaufen

Um deine Position in BTS zu erhöhen und BitAssets wie USD, EUR, GOLD usw. Liquidität
bereitzustellen, kannst du dieses BitAsset vom Netzwerk *leihen* und *leer
verkaufen*. Das Verfahren beschreiben wir hier kurz.

## Leihen

Das BitShares-Netzwerk kann jede beliebige Menge jedes BitAssets ausgeben und bei
ausreichender Besicherung an Teilnehmer verleihen.

 * *Settlement-Preis*: Der Preis für 1 BTS, wie er an externen Börsen gehandelt wird.
 * *Maintenance Collateral Ratio* (MCR): Ein von den Witnesses festgelegtes Mindestverhältnis der Besicherung
 * *Maximum Short Squeeze Ratio* (MSQR): Ein von den Witnesses festgelegtes Verhältnis, das bestimmt, wie weit Shorts gegen Short Squeezes geschützt sind
 * *Short-Squeeze-Schutz* (SQP): Legt fest, wie viel eine Margin-Position höchstens zahlen muss, um sich einzudecken
 * *Call-Preis* (CP): Der Preis, bei dem Short-/Leih-Positionen einen Margin Call erhalten

### Margin Call

Das BitShares-Netzwerk kann Margin Calls für Positionen auslösen, deren
Besicherung nicht ausreicht, um ihre geliehenen BitAssets zu decken. Ein Margin
Call erfolgt, sobald das höchste Gebot unter dem *Call-Preis* und über dem
*SQP* liegt.
Die Margin-Position muss ihre Sicherheiten verkaufen, sobald das höchste
Kaufangebot für die Sicherheiten unter dem Call-Preis (x/BTS) liegt.

```
SQP = settlement price / MSQR
call price = DEBT / COLLATERAL * MCR
```

Beim Margin Call werden die Sicherheiten genommen, davon Anteile des geliehenen
BitAssets zu Marktpreisen bis zum SQP gekauft und die Position geschlossen. Die
übrigen BTS der Sicherheiten gehen an den Kunden zurück.

### Settlement

Inhaber eines BitAssets können jederzeit eine Abrechnung zu einem *fairen Preis*
verlangen. Die Abrechnung schließt die Leih-/Short-Positionen mit der niedrigsten
Besicherungsquote und verkauft die Sicherheiten für die Abrechnung.

## Verkaufen

Nach dem Leihen können die BitAssets an jedem entsprechenden Markt zu jedem Preis
frei verkauft werden, den ein Käufer zu zahlen bereit ist. Damit ist der
Leerverkauf abgeschlossen, und du bist short in diesem BitAsset.

## Besicherungsquote anpassen

Der Inhaber einer Leih-/Short-Position kann die Besicherungsquote jederzeit ändern,
um sich flexibel an das Marktgeschehen anzupassen. Wird die Besicherungsquote
erhöht, wird ein zusätzlicher BTS-Betrag als Sicherheit gesperrt; wird sie
gesenkt, muss ein Betrag des entsprechenden BitAssets an das Netzwerk
zurückgezahlt werden.

## Eindecken

Um eine Leih-/Short-Position zu schließen, muss man die geliehene Menge dieses
BitAssets besitzen und an das BitShares-Netzwerk zurückgeben. Danach werden die
BitAssets aus dem entsprechenden Umlauf entfernt, und die Sicherheiten werden
freigegeben und an ihren Eigentümer zurückgegeben.
