# Annotation 수동 검수 양식 (전체 set 표준)

## 목적
PDF 정합 annotation 데이터를 사용자가 PDF 만 보고 입력 가능한 단일 양식.
350 set 전체에 대해 전체 수동 검수 진행 시 사용.

## 양식 (entry 1건당 3줄)

```
N. {type} {라벨 (marker 인 경우)} "{표시된 text}"
   본문: "{PDF 에서 드래그 복사한 한 문장}"
```

## 필드 정의

| 필드 | 의미 | 예 |
|---|---|---|
| type | annotation 종류 | underline / marker / box |
| 라벨 | marker 의 원문자 (있는 경우만) | ㉠ ㉡ ㉢ ⓐ ⓑ |
| text | 실제 underline / marker 된 글자 | "그달" |
| 본문 | PDF 에서 그대로 드래그 복사한 한 문장 (5~30자) | "옥영은 ㉢그달에 바로 잉태해..." |

## 입력 예시

```
1. marker ㉠ "매월 초하루"
   본문: "최척 부부는 후사를 염려하여 ㉠ 매월 초하루가 되면 몸과"

2. marker ㉡ "정월 초하루"
   본문: "다음 해 갑오년 ㉡정월 초하루에도 만복사에 올라 기도를 했는데"

3. underline "오주연문장전산고"
   본문: "19세기의 이규경도 『오주연문장전산고』를 편찬하면서"

4. box "단순 관점"
   본문: "단순 관점에 따르면 추론하기는 언어 이해에 해당한다."
```

## AI 자동 매핑 path

사용자 paste 받은 후 AI 가:
1. 사용자 paste 의 "본문" 문장을 set 의 모든 sent.t 에서 substring search
2. 단일 매칭 sent 의 id 를 annotation entry 의 sentId 로 자동 등록
3. 매칭 X 인 경우 = 본문 추출 결함 = 사용자에게 즉시 보고
4. 매칭 다중인 경우 = 추가 본문 문맥 요청

## 본문 추출 결함 진단

사용자 paste 의 marker 라벨 (㉠ 등) 과 본문 sent.t 의 marker 라벨이 다른 경우:
- 예: 사용자 PDF ㉠ vs 본문 sent.t ⑦
- 본문 추출 시 marker 누락 또는 offset 결함
- 해당 sent.t 의 marker 라벨을 PDF 정합으로 정정 (all_data 정정)

## 진입 규칙

1. set 단위 (1 set 의 모든 annotation 한 번에 paste)
2. paste 받은 즉시 AI 가 매핑 + 본문 검증 + audit
3. 결함 식별 시 사용자에게 보고 + 정정 협의
4. 정정 종결 후 commit
5. 다음 set 진입

## 유지 의무

- 솔로 창업자 시간 ROI 우선
- 한 set 당 5~20 entry 예상
- 시간 = 한 set 당 5~15분 (사용자 paste) + 1~2분 (AI 매핑 + audit)
- 350 set 전체 = 30~80 시간 (1~2개월 분산 작업)

## 참고 commit

l2023a 첫 적용 = 2026-05-26 (본 양식 첫 검증).
