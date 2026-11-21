# Handel

Diese Seite gibt eine sehr kurze Einführung, wie die Begriffe der DEX zu verstehen
sind und wie Handelspaare dargestellt werden.

## Paare

In BitShares kann fast jedes Asset gegen alle anderen Assets gehandelt werden.
Sobald wir zwei Assets ausgewählt haben, sprechen wir meist von einem
*Marktpaar*. Wir können zum Beispiel USD gegen EUR im Paar USD:EUR handeln.

Aus Gründen der Einheitlichkeit verwenden wir die allgemeinen Begriffe *Base* und
*Quote*, sodass Paare so dargestellt werden:

    *Quote* : *Base*

Ist zum Beispiel *Base* gleich USD und *Quote* gleich EUR, ergibt das das Paar
EUR:USD.

## Orderbücher

Das Orderbuch besteht aus einer *Ask*- und einer *Bid*-Seite. Da Handelspaare
keine bevorzugte Richtung haben und umgedreht werden können, gibt die folgende
Tabelle einen Überblick über Ask/Bid und die zugehörigen Kauf-/Verkaufsoperationen
auf jeder Seite:

| Seite      | Verkaufen | Kaufen  |
| ---------- | --------- | ------- |
| Ask        | *Quote*   | *Base*  |
| Bid        | *Base*    | *Quote* |
| ---------- | --------- | ------- |

Was im Paar USD:EUR auf der Bid-Seite steht, steht natürlich im Paar EUR:USD auf
der Ask-Seite. Preise werden intern als Brüche dargestellt, daher sind beide Paare
identisch.

## Handeln

Um einen Handelsauftrag zu erteilen, musst du das Formular entweder auf der
*Ask*- oder der *Bid*-Seite (also *Kaufen* oder *Verkaufen*) ausfüllen. Du musst
einen *Preis* und eine *Menge* zum Verkaufen/Kaufen angeben. Die Kosten für den
Auftrag werden automatisch berechnet. Beachte, dass für das Erteilen des Auftrags
eine zusätzliche Gebühr anfällt.

Sobald der Auftrag ausgeführt ist (d. h. jemand hat dein Angebot gekauft bzw.
verkauft), wird dir das entsprechende Asset gutgeschrieben.

Nicht ausgeführte Aufträge können jederzeit storniert werden.
