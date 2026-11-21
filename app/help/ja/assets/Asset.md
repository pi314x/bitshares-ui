[# summary]

### アセット {symbol}

{description}

発行者: {issuer}

[# annual]

終身会員資格が高すぎると感じる場合でも、年額{price}の年間購読者になれば、翌年の{feesCashback}%のキャッシュバックを受けられます。
![GitHub Logo](/images/logo.png)

[# fee-division]
#### 手数料の分配
{account}が取引手数料を支払うたびに、その手数料はいくつかの異なるアカウントに分配されます。ネットワークは{networkFee}%を受け取り、{account}を紹介した終身会員は{lifetimeFee}%を受け取ります。

_レジストラ_は、{account}をネットワークに登録するための取引手数料を支払ったアカウントです。レジストラは、残りの{referrerTotalFee}%を、自分自身と自分の_アフィリエイト紹介者_プログラムの間でどのように分けるかを決められます。

{account}のレジストラは、手数料総額の{referrerFee}%を_アフィリエイト紹介者_と共有し、手数料総額の{registrarFee}%を自分で保持することを選びました。


#### 保留中の手数料
{account}が支払った手数料は、メンテナンス間隔({maintenanceInterval}秒)ごとに1回だけ、ネットワーク、紹介者、レジストラの間で分配されます。次のメンテナンス時刻は{nextMaintenanceTime}です。

#### 権利確定の対象となる手数料

ほとんどの手数料はすぐに利用できますが、{vestingThreshold}を超える手数料(会員資格のアップグレードやプレミアムアカウント名の登録に支払う手数料など)は、合計{vestingPeriod}日間かけて権利が確定します。
