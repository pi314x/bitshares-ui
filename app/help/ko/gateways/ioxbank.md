# ioxbank 즉시 게이트웨이 서비스
ioxbank 즉시 게이트웨이 서비스는 BitShares와 다른 블록체인 사이의 암호화폐를 연결합니다. 블록체인 트랜잭션은 해당 블록체인에서 블록이 확인되는 즉시 정산됩니다. ioxbank가 지원하는 암호화폐는 **IOB.** 접두어가 붙어 있어 쉽게 알아볼 수 있으며, 자산 탐색 페이지에서 찾을 수 있습니다.

### 게이트웨이 투명성 정보

## XRP
- [XRPL 잔액](https://livenet.xrpl.org/accounts/rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y)
- [IOB.XRP 현재 공급량](/asset/IOB.XRP)

## XLM
- [XLM 잔액](https://stellarchain.io/accounts/GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH)
- [IOB.XLM 현재 공급량](/asset/IOB.XLM)

## 게이트웨이 기능

### IOB.XRP 기능
- 즉시 게이트웨이
- 최소 금액: 10 XRP
- KYC 없음
- 한도 없음
- 메이커/테이커 마켓 수수료 0%
- 낮은 출금 수수료

### IOB.XLM 기능
- 즉시 게이트웨이
- 최소 금액: 50 XLM
- KYC 없음
- 한도 없음
- 메이커/테이커 마켓 수수료 0%
- 낮은 출금 수수료

## 게이트웨이 이용 방법

### 레퍼런스 지갑 UI로 입금/출금

- **입금:** 햄버거 메뉴에서 *입금*을 클릭한 뒤 XRP 또는 XLM을 선택하면 주소와 (태그 또는 메모)가 표시됩니다. 이를 외부에서 입금에 사용하세요. 게이트웨이로 보내는 트랜잭션에 태그 또는 메모를 반드시 입력해야 합니다.
- **출금:** 햄버거 메뉴에서 *출금*을 클릭한 뒤 XRP 또는 XLM을 선택하고, 출금 받을 주소와 (태그 또는 메모)를 신중하게 입력하세요. 본인 주소가 아닌 거래소 주소를 사용하는 경우에는 거래소에서 제공한 정보를 그대로 사용해야 합니다.

### BitShares **user-id**를 이미 알고 있는 경우의 XRP 입금
- **XRP 게이트웨이 입금 주소:** rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y
- **XRP 게이트웨이 입금 (태그 또는 메모):** BitShares user-id (1.2. 제외)

### BitShares **user-id**를 이미 알고 있는 경우의 XLM 입금
- **XLM 게이트웨이 입금 주소:** GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH
- **XLM 게이트웨이 입금 (태그 또는 메모):** BitShares user-id (1.2. 제외)

### 자산 **보내기**로 수동 출금

### BitShares 지갑에서 XRP 지갑으로 XRP 출금
**IOB.XRP** 자산을 BitShares 블록체인 계정 [ioxbank-gateway](/account/ioxbank-gateway)로 보내고, BitShares 메모에 XRP 출금 주소와 출금 대상 (태그 또는 메모)를 다음 예시와 같이 입력하세요. *xrp-address*는 XRP 출금 주소로, **tag-or-memo-number**는 출금 대상 (태그 또는 메모) 번호로 바꿔야 합니다. 출금 주소의 키를 직접 소유하고 있어서 (태그 또는 메모) 번호가 필요하지 않다면, **IOB.XRP** 자산을 [ioxbank-gateway](/account/ioxbank-gateway)로 보내면서 (태그 또는 메모) 번호 없이 **xrp-destination-address**만 입력하면 됩니다.

BitShares 메모 형식
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xrp:**xrp-destination-address**

BitShares 메모 예시
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**:thanks ioxbank
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**

### BitShares 지갑에서 XLM 지갑으로 XLM 출금
**IOB.XLM** 자산을 BitShares 블록체인 계정 [ioxbank-gateway](/account/ioxbank-gateway)로 보내고, BitShares 메모에 XLM 출금 주소와 출금 대상 (태그 또는 메모)를 다음 예시와 같이 입력하세요. *xlm-address*는 XLM 출금 주소로, **tag-or-memo-number**는 출금 대상 (태그 또는 메모) 번호로 바꿔야 합니다. 출금 주소의 키를 직접 소유하고 있어서 (태그 또는 메모) 번호가 필요하지 않다면, **IOB.XLM** 자산을 [ioxbank-gateway](/account/ioxbank-gateway)로 보내면서 (태그 또는 메모) 번호 없이 **xlm-destination-address**만 입력하면 됩니다.

BitShares 메모 형식
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xlm:**xlm-destination-address**

BitShares 메모 예시
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**:thanks ioxbank
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**

## 기술 지원
- [실시간 지원](https://t.me/ioxbank)
- [티켓 열기](https://support.ioxbank.com)
