[# summary]

### 资产 {symbol}

{description}

发行人：{issuer}

[# annual]

如果终身会员对你来说成本太高，你仍然可以通过成为年度订阅用户，每年仅需 {price}，在接下来一年获得 {feesCashback}% 的手续费返现。
![GitHub Logo](/images/logo.png)

[# fee-division]
#### 手续费分配
每次 {account} 支付交易手续费时，该手续费将分配给多个不同账户。网络将收取 {networkFee}%，引荐 {account} 的终身会员将获得 {lifetimeFee}%。

_注册人_是为 {account} 在网络中注册而支付交易手续费的账户。注册人可自行决定剩余的 {referrerTotalFee}% 如何在其自身与其 _合作推荐人_ 计划之间分配。

{account} 的注册人决定与 _合作推荐人_ 分享总手续费的 {referrerFee}%，并为自己保留总手续费的 {registrarFee}%。


#### 待结费用
{account} 支付的手续费每个维护周期 ({maintenanceInterval} 秒) 才会在网络、推荐人和注册人之间分配一次。下一个维护时间是 {nextMaintenanceTime}。

#### 待解冻手续费

大部分手续费可立即使用，但超过 {vestingThreshold} 的手续费 (例如升级会员或注册高级账户名所支付的费用) 需要在总共 {vestingPeriod} 天内分期解冻。
