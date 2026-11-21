# ioxbankインスタントゲートウェイサービス
ioxbankのインスタントゲートウェイサービスは、BitSharesと他のブロックチェーンの間で暗号資産をつなぎます。ブロックチェーンの取引は、ブロックチェーン上でブロックが承認されると、直ちに決済されます。ioxbankが対応している暗号資産は、**IOB.**という接頭辞が付いているので簡単に見分けられ、アセットの検索ページで見つけられます。

### ゲートウェイの透明性に関する情報

## XRP
- [XRPL残高](https://livenet.xrpl.org/accounts/rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y)
- [IOB.XRPの現在の供給量](/asset/IOB.XRP)

## XLM
- [XLM残高](https://stellarchain.io/accounts/GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH)
- [IOB.XLMの現在の供給量](/asset/IOB.XLM)

## ゲートウェイの機能

### IOB.XRPの機能
- インスタントゲートウェイ
- 最低金額: 10 XRP
- KYCなし
- 上限なし
- メイカー/テイカーの市場手数料0%
- 低い出金手数料

### IOB.XLMの機能
- インスタントゲートウェイ
- 最低金額: 50 XLM
- KYCなし
- 上限なし
- メイカー/テイカーの市場手数料0%
- 低い出金手数料

## ゲートウェイの利用方法

### リファレンスウォレットのUIを使った入金/出金

- **入金:** ハンバーガーメニューから*入金*をクリックし、XRPまたはXLMを選ぶと、アドレスと(タグまたはメモ)が表示されます。これらを使って外部から入金してください。ゲートウェイへの取引の送金元で、必ずタグまたはメモを指定してください。
- **出金:** ハンバーガーメニューから*出金*をクリックし、XRPまたはXLMを選んで、出金先のアドレスと(タグまたはメモ)を慎重に入力してください。自分のアドレスではなく取引所のアドレスを使う場合は、取引所から提供された内容をそのまま使ってください。

### BitSharesの**ユーザーID**をすでに知っている場合のXRP入金
- **XRPゲートウェイの入金先アドレス:** rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y
- **XRPゲートウェイの入金先(タグまたはメモ):** BitSharesのユーザーID(1.2.を除く)

### BitSharesの**ユーザーID**をすでに知っている場合のXLM入金
- **XLMゲートウェイの入金先アドレス:** GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH
- **XLMゲートウェイの入金先(タグまたはメモ):** BitSharesのユーザーID(1.2.を除く)

### アセットの**送信**による手動出金

### BitSharesウォレットからXRPウォレットへのXRP出金
**IOB.XRP**アセットをBitSharesブロックチェーンのアカウント[ioxbank-gateway](/account/ioxbank-gateway)に送り、BitSharesのメモに、次の例のようにXRPの出金先アドレスと出金先(タグまたはメモ)を入れてください。*xrp-address*をXRPの出金先アドレスに、**tag-or-memo-number**を出金先の(タグまたはメモ)番号に置き換えます。出金先アドレスのキーを自分で所有しているなどの理由で(タグまたはメモ)番号が必要ない場合は、**IOB.XRP**アセットを[ioxbank-gateway](/account/ioxbank-gateway)に送り、(タグまたはメモ)番号を入れずに**xrp-destination-address**だけを入れてください。

BitSharesメモの形式
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xrp:**xrp-destination-address**

BitSharesメモの例
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**:thanks ioxbank
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**

### BitSharesウォレットからXLMウォレットへのXLM出金
**IOB.XLM**アセットをBitSharesブロックチェーンのアカウント[ioxbank-gateway](/account/ioxbank-gateway)に送り、BitSharesのメモに、次の例のようにXLMの出金先アドレスと出金先(タグまたはメモ)を入れてください。*xlm-address*をXLMの出金先アドレスに、**tag-or-memo-number**を出金先の(タグまたはメモ)番号に置き換えます。出金先アドレスのキーを自分で所有しているなどの理由で(タグまたはメモ)番号が必要ない場合は、**IOB.XLM**アセットを[ioxbank-gateway](/account/ioxbank-gateway)に送り、(タグまたはメモ)番号を入れずに**xlm-destination-address**だけを入れてください。

BitSharesメモの形式
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xlm:**xlm-destination-address**

BitSharesメモの例
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**:thanks ioxbank
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**

## テクニカルサポート
- [ライブサポート](https://t.me/ioxbank)
- [チケットを作成](https://support.ioxbank.com)
