[# summary]

### Asset {symbol}

{description}

Emesso da: {issuer}

[# annual]

Se una membership a vita è troppo costosa, puoi comunque ottenere il {feesCashback}% di cashback per l'anno successivo
diventando abbonato annuale per soli {price} all'anno.
![GitHub Logo](/images/logo.png)

[# fee-division]
#### Ripartizione delle commissioni
Ogni volta che {account} paga una commissione di transazione, quella commissione viene ripartita tra diversi account. La rete
trattiene il {networkFee}%, e il membro a vita che ha segnalato {account} riceve il {lifetimeFee}%.

Il _registrar_ è l'account che ha pagato la commissione di transazione per registrare {account} nella rete. Il registrar decide come dividere il
restante {referrerTotalFee}% tra sé e il proprio programma di _Affiliate Referrer_.

Il registrar di {account} ha scelto di condividere il {referrerFee}% della commissione totale con l'_Affiliate Referrer_ e di tenere per sé il {registrarFee}% della commissione totale.


#### Commissioni in sospeso
Le commissioni pagate da {account} vengono ripartite tra la rete, i referrer e i registrar solo una volta per intervallo di manutenzione ({maintenanceInterval} secondi). La
prossima manutenzione è prevista per {nextMaintenanceTime}.

#### Commissioni soggette a vesting

La maggior parte delle commissioni è disponibile subito, ma le commissioni superiori a {vestingThreshold}
(come quelle pagate per passare a una membership superiore o registrare un nome account premium) devono maturare (vesting) per un totale di {vestingPeriod} giorni.
