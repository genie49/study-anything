# `.soul/{trackName}` 출력 스키마 (권위 문서)

이 스키마는 DB 콘텐츠 컬렉션(`tracks/decks/concepts/cards`)과 1:1이며 **유저 진도(cardStates)는 포함하지 않는다**. 런타임(import·학습)은 LLM을 쓰지 않으므로, **런타임이 필요로 하는 모든 것을 여기서 누락 없이 베이크**해야 한다. `scripts/validate_soul.py`가 이 규칙을 강제한다.

## 디렉토리 구조
```
.soul/{trackSlug}/
  manifest.json
  decks/
    {deckSlug}.json      # deck마다 1파일, concepts+cards 임베드
```

## manifest.json
```jsonc
{
  "soulVersion": 1,
  "trackSlug": "실용영문법",      // 디렉토리명과 일치
  "title": "실용 영문법",
  "subjectType": "language",     // optional 힌트
  "decks": [
    { "slug": "1주차_시제", "title": "1주차 · 시제", "order": 1, "sourceRef": ".raw/실용영문법/1주차_시제.md" }
  ]
}
```
- `examDate`는 **여기 두지 않는다** — 유저가 트랙 생성 시 입력.

## decks/{deckSlug}.json
```jsonc
{
  "deckSlug": "1주차_시제",        // 파일명·manifest slug와 일치
  "concepts": [ { /* concept */ } ]
}
```

## concept (개념 — 「개념」모드 콘텐츠)
```jsonc
{
  "conceptKey": "present-perfect-vs-past", // 트랙 내 고유·안정키(idempotent import). 영문 kebab-case 권장
  "title": "현재완료 vs 과거시제",
  "bodyMd": "## 핵심\n...",               // 개념 본문(마크다운). 강의 구어체를 요약·정제
  "elaboration": "왜? 과거 한 시점 vs 현재 영향…", // 자기설명 모범(선택이지만 권장)
  "order": 3,
  "confusableWith": ["past-perfect-vs-past"], // 혼동되는 다른 concept의 conceptKey(교차·변별 출제)
  "cards": [ { /* card */ } ]               // 비어 있으면 안 됨
}
```

## card (다지기 — 인출 아이템). 개념당 여러 개, 난이도 사다리(cloze→qa→mcq→application) 권장
```jsonc
{
  "cardKey": "pp-since-2010",     // 트랙 내 고유·안정키
  "type": "cloze",                // cloze | qa | mcq | application
  "prompt": "He ___ (live) here since 2010.",
  "answer": "has lived",
  "distractors": ["lived", "is living", "lives"], // mcq일 때만 필수, 그 외 []
  "hint": "since + 완료",          // 선택
  "explanation": "since+기간 → 현재완료. 과거형은 현재와 단절.", // 필수(채점 후 표시, 런타임 LLM 없이)
  "difficultyPrior": 0.3,         // 0~1 초기 난이도(쉬움 0 → 어려움 1)
  "grading": { "mode": "exact", "acceptedAnswers": ["has lived"], "normalize": ["lowercase","trim","collapse-space"] }
}
```

### grading.mode — 런타임 LLM-free 채점의 핵심
| mode | 언제 | 필수 필드 | 채점 방식(런타임) |
|---|---|---|---|
| `exact` | 정답이 짧고 명확(cloze/단답) | `acceptedAnswers[]` (+ `normalize[]`) | 정규화 후 문자열 일치 |
| `mcq` | 객관식 | (card.`distractors[]`) | 보기 선택 비교 |
| `keyword` | 서술인데 핵심어로 판정 가능 | `keywords[]` | 키워드 포함 검사 |
| `self` | 개방형이라 자동 불가(주로 application) | `rubric[]` | 정답·rubric 공개 후 유저 자가채점 |

규칙(검증 강제):
- **`self`는 최후수단.** 기계로 채점 가능하면 `exact`/`keyword`/`mcq`를 써라. 자가채점은 관대편향으로 학습 신호를 흐린다([data-pipeline.md §2](../../../docs/data-pipeline.md) 참조).
- `acceptedAnswers`에는 **허용 변형들**을 모두 넣어라(예: "has lived", "has lived here").
- `normalize`는 비교 전 적용할 정규화 단계: `lowercase | trim | collapse-space | strip-punct` 중.
- 모든 card는 `explanation` 필수.

## 작성 원칙 (콘텐츠 품질)
- **요약 금지, 인출 단위로 분해.** 한 카드 = 한 사실/관계(atomic). 강의록의 잡담·인사말은 버리고 개념만 추출.
- **개념당 카드 다중 + 난이도 사다리:** 최소 cloze 1 + qa/application 1.
- **혼동쌍 적극 태깅:** 헷갈리는 개념끼리 `confusableWith`로 연결(교차 출제 → 변별 학습).
- **키는 영문 kebab-case, 안정적으로.** 재가공해도 같은 개념은 같은 키를 유지해야 진도가 보존된다.
