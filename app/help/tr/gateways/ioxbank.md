# ioxbank Anlık Gateway Hizmeti
ioxbank anlık gateway hizmeti, BitShares ile diğer blokzincirleri arasında kripto paraları birbirine bağlar. Blokzinciri işlemleri, bloklar ilgili blokzincirinde onaylanır onaylanmaz hemen sonuçlandırılır. ioxbank'ın desteklediği kripto paraları kolayca tanıyabilirsiniz: **IOB.** önekini taşırlar ve varlık keşif sayfasında bulunabilirler.

### Gateway Şeffaflık Bilgileri

## XRP
- [XRPL Bakiyesi](https://livenet.xrpl.org/accounts/rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y)
- [IOB.XRP Güncel arzı](/asset/IOB.XRP)

## XLM
- [XLM Bakiyesi](https://stellarchain.io/accounts/GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH)
- [IOB.XLM Güncel arzı](/asset/IOB.XLM)

## Gateway Özellikleri

### IOB.XRP Özellikleri
- Anlık Gateway
- Min. tutar: 10 XRP
- KYC yok
- Limit yok
- Maker/taker için %0 piyasa ücreti
- Düşük çekim ücreti

### IOB.XLM özellikleri
- Anlık Gateway
- Min. tutar: 50 XLM
- KYC yok
- Limit yok
- Maker/taker için %0 piyasa ücreti
- Düşük çekim ücreti

## Gateway Yöntemleri

### Referans Cüzdan Arayüzüyle Yatırma/Çekme

- **Yatırma:** Hamburger menüsünden *Yatır*'a tıklayın, ardından XRP veya XLM seçin; size bir Adres ve (Etiket veya Memo) gösterilir, yatırım için bunları harici olarak kullanmalısınız; Gateway'e yaptığınız işlemin kaynağında Etiketi veya Memo'yu belirttiğinizden emin olun.
- **Çekme:** Hamburger menüsünden *Çek*'e tıklayın, ardından XRP veya XLM seçin; hedef çekim Adresinizi ve (Etiket veya Memo) bilgisini dikkatle yazın. Kendi adresiniz yerine bir borsa adresi kullanıyorsanız, borsanın size verdiği bilgileri aynen kullanın.

### BitShares **kullanıcı kimliğinizi (user-id)** zaten biliyorsanız XRP Yatırma
- **XRP Gateway Hedef Adresi:** rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y
- **XRP Gateway Hedefi (Etiket veya Memo):** BitShares kullanıcı kimliği (1.2. olmadan)

### BitShares **kullanıcı kimliğinizi (user-id)** zaten biliyorsanız XLM Yatırma
- **XLM Gateway Hedef Adresi:** GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH
- **XLM Gateway Hedefi (Etiket veya Memo):** BitShares kullanıcı kimliği (1.2. olmadan)

### Varlıkları **göndererek** Elle Çekme

### BitShares cüzdanınızdan XRP cüzdanınıza XRP Çekme
**IOB.XRP** varlıklarınızı BitShares Blokzinciri hesabı [ioxbank-gateway](/account/ioxbank-gateway)'e gönderin ve aşağıdaki örneklerdeki gibi BitShares Memo'suna XRP hedef adresinizi ve hedef (Etiket veya Memo) bilgisini ekleyin; *xrp-address* yerine XRP hedef adresinizi, **tag-or-memo-number** yerine hedef (Etiket veya Memo) numaranızı yazmalısınız. Hedef adresin anahtarlarına sahip olduğunuz için (Etiket veya Memo) numarasına İHTİYACINIZ YOKSA, **IOB.XRP** varlığınızı [ioxbank-gateway](/account/ioxbank-gateway)'e gönderip yalnızca **xrp-destination-address** bilgisini, herhangi bir (Etiket veya Memo) numarası olmadan ekleyebilirsiniz:

BitShares Memo Biçimi
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xrp:**xrp-destination-address**

BitShares Memo Biçimi Örnekleri
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**:thanks ioxbank
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**

### BitShares cüzdanınızdan XLM cüzdanınıza XLM Çekme
**IOB.XLM** varlıklarınızı BitShares Blokzinciri hesabı [ioxbank-gateway](/account/ioxbank-gateway)'e gönderin ve aşağıdaki örneklerdeki gibi BitShares Memo'suna XLM hedef adresinizi ve hedef (Etiket veya Memo) bilgisini ekleyin; *xlm-address* yerine XLM hedef adresinizi, **tag-or-memo-number** yerine hedef (Etiket veya Memo) numaranızı yazmalısınız. Hedef adresin anahtarlarına sahip olduğunuz için (Etiket veya Memo) numarasına İHTİYACINIZ YOKSA, **IOB.XLM** varlığınızı [ioxbank-gateway](/account/ioxbank-gateway)'e gönderip yalnızca **xlm-destination-address** bilgisini, herhangi bir (Etiket veya Memo) numarası olmadan ekleyebilirsiniz:

BitShares Memo Biçimi
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xlm:**xlm-destination-address**

BitShares Memo Biçimi Örnekleri
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**:thanks ioxbank
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**

## Teknik Destek
- [Canlı Destek](https://t.me/ioxbank)
- [Destek Talebi Aç](https://support.ioxbank.com)
