# Liquiditätspools

Ein Liquiditätspool enthält zwei Assets und erlaubt jedem, das eine gegen das andere zu tauschen, zu einem Preis, der sich aus dem Verhältnis der Bestände im Pool ergibt. Niemand muss eine Order aufgeben und warten: Du tauschst gegen den Pool, und die Transaktion wird entweder zum angezeigten Preis ausgeführt oder schlägt fehl.

## Tauschen

Öffne **Liquiditätspools** im Menü, wähle einen Pool und drücke **Tauschen**. Gib ein, was du zahlst oder was du erhalten möchtest; das andere Feld wird aus dem aktuellen Stand des Pools berechnet. Der Dialog zeigt

 * den **Preis** und den **Preiseinfluss**, also wie weit dein Handel den Preis des Pools verschiebt. Ein großer Handel in einem kleinen Pool kostet mehr;
 * die **Gebühr** des Pools, die von dem abgezogen wird, was du erhältst, und im Pool für die Anbieter der Liquidität bleibt;
 * den **Mindestbetrag, den du erhältst**: der Betrag abzüglich der Slippage, die du akzeptierst. Bewegt sich der Pool weiter, bevor deine Transaktion aufgenommen wird, schlägt der Tausch fehl, statt zu einem schlechteren Preis ausgeführt zu werden.

Der Dialog vergleicht denselben Betrag auch mit dem Orderbuch des Paares und sagt dir, wo der Preis besser ist. Auf der Handelsseite tut das eine Zeile unter der Marktkopfzeile für kleine Beträge.

## Liquidität bereitstellen

**Hinzufügen / entfernen** legt beide Assets in einen Pool und gibt dir Anteilstoken. Unter **Deine Liquidität** siehst du deinen Anteil an jedem Pool und was er in beiden Assets wert ist. Beim Entfernen erhältst du deinen Anteil an beiden Assets zurück, abzüglich der Abhebungsgebühr des Pools.

Die Gebühren, die ein Pool verdient, bleiben im Pool und erhöhen den Wert jedes Anteils. Liquidität bereitzustellen birgt das Risiko eines temporären Verlusts: Verschiebt sich der Preis eines Assets stark gegenüber dem anderen, kann dein Anteil am Pool weniger wert sein, als wenn du beide Assets einfach behalten hättest.

## Der Graph

Die Ansicht **Graph** zeichnet jedes Asset als Punkt und jeden Pool als Linie zwischen seinen beiden Assets. So siehst du, welche Assets direkt getauscht werden können und welche nur über BTS oder einen anderen Knotenpunkt.
