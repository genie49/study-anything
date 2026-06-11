# 런타임 LLM — 채점 & 이해도 게이트

> 관련: [데이터 모델](./data-model.md) · [파이프라인](./data-pipeline.md) · [알고리즘 개요](./learning-algorithm-overview.md)

런타임 LLM(Gemini Flash-Lite)은 **두 용도**로 쓴다. 둘 다 ②(soul)가 베이크한 정답·해설·`elaboration`을 *적용*만 하며 콘텐츠를 생성하지 않는다.
1. **다지기 채점** — 인출 답안을 `{score, reason}`으로 채점(아래 본문). S 갱신에 영향.
2. **개념 이해도 게이트** — 자가설명을 보고 이해 충분 여부를 판정 + 형성 피드백([§ 개념 이해도 게이트](#개념-이해도-게이트-자가설명-확인)). **S 무관**, 저장 안 함.

## 결정: 채점은 **일괄적으로 경량 LLM에 위임**

문자열 매칭 기반 채점(exact/keyword)은 오타·동의어·패러프레이즈에서 false-reject가 잦고, 모드별 분기(exact/mcq/keyword/llm)는 soul 작성·검증·런타임을 모두 복잡하게 만든다. 초경량 LLM 비용이 사실상 0(1000건 ~수 센트)이므로 **타이핑 답변은 전부 LLM이 채점**하고 **`{score, reason}`을 반환**한다. `reason`은 그대로 학습자에게 보여주고, `score`로 SRS 등급을 매긴다.

- **유일한 예외 — 객관식(mcq):** 클릭 선택이라 오타가 없다 → **선택지 동등비교로 즉시·무료·완전 일관**하게 처리(LLM 호출 안 함). 나머지(cloze·qa·application)는 **전부 LLM**.
- **`grading.mode`는 더 이상 런타임을 라우팅하지 않는다.** `card.type`이 결정한다(`mcq`면 동등비교, 그 외 LLM).

> 2단계(soul)는 여전히 **참조정답(`card.answer`)과 해설(`explanation`)을 베이크**한다. 런타임 LLM은 그 기준을 *적용*만 할 뿐 새 콘텐츠를 만들지 않는다.

### 받아들이는 트레이드오프 — 결정적 백스톱 상실

하이브리드에서는 LLM이 죽어도 cloze/keyword/mcq를 결정적으로 채점할 수 있었다. **통합-LLM에서는 LLM이 죽으면 mcq를 제외한 모든 채점이 불가능**하고, 남는 건 "정답 공개 후 자가채점"뿐이다. 이게 단순함의 대가다(가용성 회귀).

완화책: soul의 `acceptedAnswers`/`keywords`를 **삭제하지 않고 선택적 폴백 필드로 남긴다**. 평소엔 무시되지만 LLM 장애 시 결정적 채점으로 우아하게 강등할 수 있고, 기존 번들도 그대로 유효하다(재가공 불필요).

## 모델

| 항목 | 값 |
|---|---|
| 모델 | **`gemini-3.1-flash-lite`** (Google Gemini API, Stable) |
| 환경변수 | `GEMINI_API_KEY`(`.env`, gitignore), `GRADER_MODEL=gemini-3.1-flash-lite`(교체 가능) |
| 엔드포인트 | `POST https://generativelanguage.googleapis.com/v1beta/models/${GRADER_MODEL}:generateContent` |
| 설정 | `temperature: 0`(일관성), `responseMimeType: "application/json"` + `responseSchema`(구조화 강제) |
| 비용 | 입력~300T/출력~80T → 1건 ≈ $0.0001 미만, 1000건 ≈ 수 센트 (정확 단가는 Google 가격표 확인) |

> ⚠️ 노출된 키 2개(OpenRouter·Gemini)는 **폐기 후 재발급**. 키는 절대 코드/문서/채팅에 두지 말고 `.env`에만.

## 채점기 계약 (grader contract)

**입력(서버가 구성):**
```jsonc
{
  "question": "<card.prompt>",
  "referenceAnswer": "<card.answer>",
  "explanation": "<card.explanation>",   // 판정 근거(reason)를 grounding
  "rubric": ["<grading.rubric[]> (있으면)"],
  "learnerAnswer": "<유저 입력>",
  "lang": "ko"   // reason 언어
}
```

**시스템 지시(요지):**
> 너는 학습앱의 엄격하지만 공정한 채점관이다. 질문·참조정답·해설·(선택)채점기준·학습자답변을 보고 **0~1 점수**를 매겨라. **철자·띄어쓰기·동의어·패러프레이즈는 관대하게**(사소한 오타로 감점하지 말 것), 핵심 개념의 정오는 **엄격하게**. 한국어로 1~2문장 `reason`(무엇이 맞고/틀렸는지 + 핵심 포인트)을 준다. 반드시 아래 JSON 스키마로만 답한다.

**출력(responseSchema 강제):**
```jsonc
{
  "score": 0.0,        // 0~1, 채점의 단일 기준
  "reason": "한국어 1~2문장: 무엇이 맞고/틀렸는지 + 핵심 포인트 (학습자에게 그대로 노출)"
}
```

> `verdict` 같은 별도 라벨은 두지 않는다 — `score`가 등급을 결정하므로 중복이다.

## score → SRS 등급 매핑

`score`를 [§2 등급](./learning-algorithm-detail.md)으로 변환해 S를 갱신:

| score | SRS grade |
|---|---|
| ≥ 0.85 | **Good** |
| 0.5 ≤ score < 0.85 | **Hard** |
| < 0.5 | **Again** |

(`Easy`는 LLM이 주지 않음 — 학습자가 "즉시 확신"을 자가보고할 때만 클라이언트가 부여. mcq 정답도 Good.)

## 객관식(mcq) — 동등비교로 즉시 처리

`type==mcq`는 LLM을 호출하지 않는다. 학습자가 고른 선택지 == 정답 선택지인지 **동등비교**만 한다.
- 맞으면 `score:1.0`, 틀리면 `score:0.0`으로 위 매핑에 태운다(정답=Good, 오답=Again).
- `reason`은 카드 `explanation`을 그대로 보여준다(LLM 불필요). 더 빠르고 무료이며 100% 일관.

## 사전테스트(pretest) 처리 — 채점하지 않는다

[데이터 모델](./data-model.md)상 `wasPretest:true` 인출은 **S를 갱신하지 않는다**(틀린 추측이 인코딩을 시드하는 단계라 S를 깎으면 안 됨).
- **그러므로 사전테스트에서는 LLM을 호출하지 않는다.** 결과가 S에 반영되지 않으니 호출은 비용 낭비. → 추측 입력 후 **정답·`explanation` 공개만** 한다.
- 채점기→S 경로도 **`wasPretest`를 존중**: 어떤 경로로든 pretest면 S 갱신을 건너뛰고 `reviewLogs`에 기록만.

## 응답 지연 UX — 선접수-후채점 (필수)

이제 **mcq를 뺀 모든 카드가 LLM 지연을 짊어진다**(개방형만이 아님). 따라서 동기 대기는 다지기 흐름을 망가뜨린다 → **선접수-후채점(accept-then-grade)을 기본 구현으로 채택**한다:
- 답변을 즉시 접수해 **다음 카드로 넘기고**, 채점 결과(`score`/`reason`)가 도착하면 **비동기로 해당 카드의 S·dueAt를 패치**하고 `reason`을 노출한다.
- 스키마 변경 없음, 체감 지연 0. mcq는 동등비교라 애초에 즉시 결과.
- (단순 폴백) 굳이 동기로 가야 하면 **타임아웃 ~2s + "채점 중…" 표시** 후 결과. 권장하지 않음.

## 신뢰성 · 폴백 (런타임은 절대 멈추면 안 됨)

LLM 호출은 실패/지연할 수 있으므로 결정적 폴백을 둔다:

```
grade(card, answer, wasPretest):
  if card.type == "mcq":            # 동등비교, LLM 없음
     return equalsCorrectOption(answer)
  if wasPretest:                    # 채점 안 함(정답 공개만)
     return REVEAL_ONLY
  if GEMINI 사용가능:
     try: r = gemini(grader_contract, timeout=4s); return mapScore(r.score)  # {score, reason}
     catch (timeout/error): fallthrough
  # 폴백(LLM 없이) — 선택적 레거시 필드가 있으면 결정적으로 강등
  if card.grading?.keywords:    return keywordMatch(answer, keywords)
  if card.grading?.acceptedAnswers: return exactMatch(answer, acceptedAnswers)
  return REVEAL_AND_SELF_GRADE        # 정답·해설 공개 후 유저 자가채점
  로그: graderMode 기록
```
- **타임아웃 4s** + 1회 재시도(짧게). 그래도 실패면 폴백.
- 채점 경로는 `reviewLogs`에 `graderMode: "llm" | "mcq" | "keyword" | "exact" | "self"`로 기록 → 품질·가용성 모니터링.

## 일관성 · 비용 관리

- `temperature: 0` + 명확한 참조정답·해설로 **동일 답변 = 동일 점수**에 근접.
- mcq는 절대 LLM에 보내지 않는다(서버 즉시 동등비교) → 호출 수 절감.
- 같은 (cardId, normalizedAnswer) 판정은 **단기 캐시** 가능(동일 오답 반복 시 재호출 절감). 선택 최적화.
- 서버리스(Hono)에서 호출당 1 외부요청 → 트랙 독립 스케줄러 쿼리(1~2)에 LLM 1건이 더해질 뿐.

## 개념 이해도 게이트 (자가설명 확인)

개념(인코딩) 모드에서 학습자가 **"왜 그런지" 자가설명**을 쓰면, 경량 LLM이 이해 충분 여부를 판정하고 형성 피드백을 준다. **충분하면 그 개념의 다지기로 통과**, 부족하면 피드백 + 재설명.

- **저장 안 함:** 자가설명 텍스트도 게이트 결과도 영속화하지 않는다(휘발성, DB write 0).
- **S 무관:** 인코딩 단계라 SRS(S·dueAt)를 건드리지 않는다(다지기 인출만 S 갱신). 게이트는 *세션 내 진행*만 통제.
- **다지기 채점과 구분:** 점수/등급을 주지 않는다. 출력은 `{understood, feedback}`.

**입력(서버 구성):**
```jsonc
{
  "concept": "<concept.title>",
  "referenceExplanation": "<concept.elaboration (+ 필요시 bodyMd 요지)>",
  "learnerExplanation": "<유저 자가설명>",
  "lang": "ko"
}
```

**시스템 지시(요지):**
> 너는 학습 코치다. 개념의 핵심 근거(referenceExplanation)와 학습자의 자가설명을 비교해, **핵심 "왜"를 짚었으면 충분으로 관대하게** 판정하라(완벽 요구 금지). 부족하면 무엇이 빠졌는지 한국어 1~2문장으로 짚어준다. 점수는 매기지 않는다.

**출력(responseSchema 강제):**
```jsonc
{
  "understood": true,             // 충분(통과) | 부족(재설명)
  "feedback": "한국어 1~2문장: 잘 짚은 점 또는 빠진 핵심"
}
```

**통과/재시도 로직 (안티-프러스트레이션):**
```
gate(concept, explanation):
  if LLM 사용가능:
     try: r = gemini(gate_contract, timeout=4s)
          return r.understood ? PASS(r.feedback) : RETRY(r.feedback)
     catch: fallthrough
  # 폴백(LLM 없이) — 절대 막지 않음
  return REVEAL_AND_CONTINUE   # elaboration 공개 + "이해했어요, 넘어가기"
```
- **2회 "부족" 시** 모범 `elaboration`을 공개하고 **"이해했어요, 넘어가기"** 버튼 노출 → 하드 트랩 금지.
- **동기 게이트**라 지연이 흐름을 끊는다 → "확인 중…" 표시 + Flash-Lite + 타임아웃. 실패하면 위 폴백으로 즉시 통과 가능.
- **적용 범위:** 첫 노출에만 게이트. **lapse 후 relearning은 게이트 생략**(이미 인코딩됨 → 인출 회전 우선), 막판 크램도 스킵.

## 보안

- `GEMINI_API_KEY`는 **서버(Hono)에서만** 사용 — 절대 프론트엔드로 노출 금지(키가 클라이언트에 가면 탈취됨).
- 학습자 답변을 그대로 프롬프트에 넣으므로 **프롬프트 인젝션**에 대비: 채점 결과는 JSON 스키마로만 받고, `reason`은 텍스트로만 렌더(실행/링크 신뢰 금지).

## 스키마 영향 (요약)

- 런타임 채점은 **`card.type`이 결정**(mcq=동등비교, 그 외=LLM). `grading.mode`는 라우팅에서 제외(있어도 무시, 후방호환용).
- 전 타입 **`card.answer`(참조정답)·`explanation` 필수**. `mcq`는 추가로 `distractors[]` 필수(선택지 렌더용).
- `grading.acceptedAnswers`/`keywords`/`rubric`은 **선택적 폴백 필드**로 유지(LLM 장애 시 결정적 강등).
- 자세한 필드는 [soul 스키마](../.claude/skills/soul-structuring/references/soul-schema.md)·[data-model](./data-model.md) 참조.
