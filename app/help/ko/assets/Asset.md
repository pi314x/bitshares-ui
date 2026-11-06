[# summary]

### 자산 {symbol}

{description}

발행자: {issuer}

[# annual]

평생 회원 등급이 부담스럽다면, 연간 {price}만 내고 연간 구독자가 되어 다음 1년 동안 {feesCashback}% 캐시백을 받을 수 있습니다.
![GitHub Logo](/images/logo.png)

[# fee-division]
#### 수수료 분배
{account}이(가) 트랜잭션 수수료를 낼 때마다 그 수수료는 여러 계정에 나뉘어 분배됩니다. 네트워크가
{networkFee}%를 가져가고, {account}을(를) 추천한 평생회원이 {lifetimeFee}%를 받습니다.

_등록자(registrar)_는 {account}을(를) 네트워크에 등록하기 위해 트랜잭션 수수료를 낸 계정입니다. 등록자는 나머지 {referrerTotalFee}%를
자신과 자신의 _제휴 추천인_ 프로그램 사이에 어떻게 나눌지 결정합니다.

{account}의 등록자는 전체 수수료의 {referrerFee}%를 _제휴 추천인_과 공유하고 전체 수수료의 {registrarFee}%를 자신이 갖기로 했습니다.


#### 대기 중인 수수료
{account}이(가) 낸 수수료는 유지보수 주기({maintenanceInterval}초)마다 한 번씩만 네트워크, 추천인, 등록자에게 분배됩니다.
다음 유지보수 시각은 {nextMaintenanceTime}입니다.

#### 베스팅 수수료

대부분의 수수료는 즉시 사용할 수 있지만, {vestingThreshold}을(를) 넘는 수수료
(회원 등급 업그레이드나 프리미엄 계정 이름 등록에 내는 수수료 등)는 총 {vestingPeriod}일 동안 베스팅되어야 합니다.
