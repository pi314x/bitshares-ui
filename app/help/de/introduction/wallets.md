# Wallet

Wie du vielleicht schon bemerkt hast, ist diese Anwendung eine Webanwendung und
läuft im Browser. Sie verbindet sich mit einem vertrauenswürdigen Knoten im
Netzwerk, der als Zugang zum Rest des Ökosystems dient.

## Cloud-Wallet

Wenn du dich mit Benutzername und Passwort registriert hast, besitzt du eine
Cloud-Wallet. Technisch wird zwar nichts in der Cloud gespeichert, wir nennen sie
aber Cloud-Wallet, weil du mit diesen Zugangsdaten (Benutzername und Passwort)
jederzeit von jedem Webbrowser aus auf dein Konto zugreifen kannst. Mit der
Cloud-Wallet ist immer nur ein einzelnes Konto zugänglich. Für neue Nutzer ist
das in der Regel die richtige Wahl. Das automatisch erzeugte Passwort lässt sich
zwar ändern, wir raten derzeit aber davon ab. Das Team arbeitet an einer
verantwortungsvollen Lösung für den Passwortwechsel, die keine technischen
Kenntnisse erfordert. Sobald sie verfügbar ist, geben wir es bekannt.

## Lokale Wallet

Die lokale Wallet legt eine Datenbank in deinem Browser an. Das bedeutet, dass
der Zugriff auf dein Guthaben **an diesen Browser gebunden** ist. Wenn du von
einem anderen Computer oder einem anderen Browser aus auf deine lokale Wallet
zugreifen willst, schlägt das fehl, solange du nicht die Backup-Datei aus dem
ursprünglichen Browser importierst. Das ist eigentlich einfach. Siehe die
Verwaltung von [Backups](/help/introduction/backups).

## Sicherheit

Unsere Server haben keinen Zugriff auf dein Guthaben, denn keiner deiner privaten
Schlüssel verlässt jemals deinen Browser. Sie werden mit deiner Passphrase
verschlüsselt und in der Datenbank deines Browsers gespeichert. Du solltest
deshalb ein ordentliches [Backup](/help/introduction/backups) anlegen, falls
deinem Computer oder Browser etwas zustößt.

## Verwaltung

Die Benutzeroberfläche kann mehrere getrennte Wallets verwalten und darauf
zugreifen, die jeweils mehrere Konten und das zugehörige Guthaben enthalten
können. Du kannst Wallets unter `Einstellungen->Wallets` anlegen, sichern und
wechseln.
