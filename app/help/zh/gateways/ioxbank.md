# ioxbank 即时网关服务
ioxbank 即时网关服务在 BitShares 与其他区块链之间连接加密货币。区块链交易在区块链上的区块确认后会立即结算。你可以很容易地识别 ioxbank 支持的加密货币，它们带有 **IOB.** 前缀，可以在资产浏览页面找到。

### 网关透明度信息

## XRP
- [XRPL 余额](https://livenet.xrpl.org/accounts/rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y)
- [IOB.XRP 当前供应量](/asset/IOB.XRP)

## XLM
- [XLM 余额](https://stellarchain.io/accounts/GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH)
- [IOB.XLM 当前供应量](/asset/IOB.XLM)

## 网关特性

### IOB.XRP 特性
- 即时网关
- 最低金额：10 XRP
- 无需 KYC
- 无限额
- Maker/Taker 市场手续费 0%
- 提现费用低

### IOB.XLM 特性
- 即时网关
- 最低金额：50 XLM
- 无需 KYC
- 无限额
- Maker/Taker 市场手续费 0%
- 提现费用低

## 网关使用方法

### 使用参考钱包界面充值/提现

- **充值：** 在汉堡菜单中点击*充值*，然后选择 XRP 或 XLM；将显示一个地址和 (Tag 或 Memo)，你需要在外部使用它们进行充值；请确保在向网关转账的来源处填写 Tag 或 Memo。
- **提现：** 在汉堡菜单中点击*提现*，然后选择 XRP 或 XLM；请仔细填写你的目标提现地址和 (Tag 或 Memo)。如果你使用的是交易所地址而不是自己的地址，请务必使用交易所提供给你的信息。

### 如果你已知道自己的 BitShares **用户 ID (user-id)**，充值 XRP
- **XRP 网关目标地址：** rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y
- **XRP 网关目标 (Tag 或 Memo)：** BitShares 用户 ID (不含 1.2.)

### 如果你已知道自己的 BitShares **用户 ID (user-id)**，充值 XLM
- **XLM 网关目标地址：** GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH
- **XLM 网关目标 (Tag 或 Memo)：** BitShares 用户 ID (不含 1.2.)

### 通过**发送**资产手动提现

### 从你的 BitShares 钱包提现 XRP 到你的 XRP 钱包
将你的 **IOB.XRP** 资产发送到 BitShares 区块链账户 [ioxbank-gateway](/account/ioxbank-gateway)，并按下面的示例在 BitShares 备注 (Memo) 中填写你的 XRP 目标地址和目标 (Tag 或 Memo)：将 *xrp-address* 替换为你的 XRP 目标地址，将 **tag-or-memo-number** 替换为你的目标 (Tag 或 Memo) 编号。如果你不需要 (Tag 或 Memo) 编号，例如目标地址的密钥由你自己掌握，则可以直接将 **IOB.XRP** 资产发送到 [ioxbank-gateway](/account/ioxbank-gateway)，只填写你的 **xrp-destination-address**，不带任何 (Tag 或 Memo) 编号：

BitShares 备注格式
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xrp:**xrp-destination-address**

BitShares 备注格式示例
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**:thanks ioxbank
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**

### 从你的 BitShares 钱包提现 XLM 到你的 XLM 钱包
将你的 **IOB.XLM** 资产发送到 BitShares 区块链账户 [ioxbank-gateway](/account/ioxbank-gateway)，并按下面的示例在 BitShares 备注 (Memo) 中填写你的 XLM 目标地址和目标 (Tag 或 Memo)：将 *xlm-address* 替换为你的 XLM 目标地址，将 **tag-or-memo-number** 替换为你的目标 (Tag 或 Memo) 编号。如果你不需要 (Tag 或 Memo) 编号，例如目标地址的密钥由你自己掌握，则可以直接将 **IOB.XLM** 资产发送到 [ioxbank-gateway](/account/ioxbank-gateway)，只填写你的 **xlm-destination-address**，不带任何 (Tag 或 Memo) 编号：

BitShares 备注格式
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xlm:**xlm-destination-address**

BitShares 备注格式示例
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**:thanks ioxbank
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**

## 技术支持
- [在线支持](https://t.me/ioxbank)
- [提交工单](https://support.ioxbank.com)
