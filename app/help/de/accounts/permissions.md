# Berechtigungen

In BitShares ist jedes Konto aufgeteilt in

* **Active-Berechtigung**: Kontrolle über das Guthaben und
* **Owner-Berechtigung**: Kontrolle über das Konto.

Beide lassen sich im Reiter `Berechtigungen` deines Kontos mit sogenannten
*Authorities* (siehe unten) und einem sogenannten *Schwellenwert* festlegen,
der überschritten werden muss, damit eine Transaktion gültig ist.

## Authorities

In BitShares besteht eine *Authority* aus einer oder mehreren Instanzen, die eine
Aktion wie Überweisungen oder Trades autorisieren.

Eine Authority besteht aus einem oder mehreren Paaren aus einem Kontonamen und
einem *Gewicht*.

Damit eine Transaktion gültig ist, muss die Summe der Gewichte der signierenden
Parteien den in den Berechtigungen festgelegten Schwellenwert überschreiten.

# Beispiele

Anhand einiger Beispiele erklären wir die verwendeten Begriffe und Anwendungsfälle.
Wir nehmen an, dass ein neues Konto angelegt wird, dessen Active-Berechtigungen wie
unten beschrieben gesetzt sind. Dasselbe Schema funktioniert auch für die
Owner-Berechtigungen!

## (Flache) Multi-Signatur

Ein flaches Multi-Signatur-Schema besteht aus `M` Instanzen, von denen `N`
unterschreiben müssen, damit die Transaktion gültig ist. In BitShares haben wir
statt `M` und `N` *Gewichte* und einen *Schwellenwert*. Damit erreichen wir
dasselbe mit noch mehr Flexibilität, wie wir gleich sehen.

Angenommen, Alice, Bob, Charlie und Dennis haben gemeinsames Guthaben. Eine gültige
Transaktion soll möglich sein, wenn nur zwei von ihnen zustimmen. Ein
**2-aus-4**-Schema (N-aus-M) kann dann so aussehen:

| Konto      | Gewicht |
| ---------- | ------- |
| Alice      | 33%     |
| Bob        | 33%     |
| Charlie    | 33%     |
| Dennis     | 33%     |
| ---------- | ------- |
| Schwellenwert: | 51% |

Alle vier Teilnehmer haben ein Gewicht von 33 %, der Schwellenwert liegt aber bei 51 %.
Es müssen also nur zwei der vier zustimmen, um die Transaktion zu validieren.

Für ein 3-aus-4-Schema kann man entweder die Gewichte auf 17 senken oder den
Schwellenwert auf 99 % erhöhen.

## (Flache) Flexible Multi-Signatur

Mit Schwellenwert und Gewichten haben wir mehr Flexibilität über unser Guthaben,
genauer gesagt mehr *Kontrolle*. So können wir zum Beispiel verschiedenen Personen
unterschiedliche Gewichte geben. Angenommen, Alice möchte ihr Guthaben per
Multi-Signatur gegen Diebstahl absichern, ihren Freunden aber nicht zu viel
Kontrolle überlassen. Dann legen wir eine Authority ähnlich dieser an:

| Konto      | Gewicht |
| ---------- | ------- |
| Alice      | 49%     |
| Bob        | 25%     |
| Charlie    | 25%     |
| Dennis     | 10%     |
| ---------- | ------- |
| Schwellenwert: | 51% |

Jetzt kann auf das Guthaben entweder Alice zusammen mit einem einzigen Freund oder
können alle drei Freunde gemeinsam zugreifen.

## Mehrstufig hierarchische flexible Multi-Signatur

Sehen wir uns ein einfaches mehrstufig hierarchisches Firmenkonto an. Es geht um
ein Unternehmen mit einem Finanzvorstand (CFO) und einigen ihm unterstellten
Abteilungen wie Treasury, Controlling, Steuern, Buchhaltung usw. Das Unternehmen
hat außerdem einen CEO, der Ausgabeberechtigungen haben soll. Also legen wir für
das Guthaben eine Authority nach diesem Muster an:

| Konto      | Gewicht |
| ---------- | ------- |
| CEO.COMPANY| 51%     |
| CFO.COMPANY| 51%     |
| ---------- | ------- |
| Schwellenwert: | 51% |

wobei CEO.COMPANY und CFO.COMPANY ihre eigenen Authorities haben. Das Konto
CFO.COMPANY könnte zum Beispiel so aussehen:

| CFO.COMPANY         | Gewicht |
| ------------------- | ------- |
| Chief.COMPANY       | 51%     |
| Treasurer.COMPANY   | 33%     |
| Controller.COMPANY  | 33%     |
| Tax Manager.COMPANY | 10%     |
| Accounting.COMPANY  | 10%     |
| ------------------- | ------- |
| Schwellenwert:      | 51%     |

Dieses Schema erlaubt:

* dem CEO, Guthaben auszugeben
* dem Finanzvorstand, Guthaben auszugeben
* dem Treasurer zusammen mit dem Controller, Guthaben auszugeben
* dem Controller oder dem Treasurer zusammen mit dem Tax Manager und der
  Buchhaltung, Guthaben auszugeben.

Damit lässt sich ein Baum beliebiger Tiefe aufspannen, um eine flexible
Authority zu bauen, die nahezu jeden geschäftlichen Anwendungsfall abbildet.
