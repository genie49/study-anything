---
name: soul-structuring
description: Convert a track's raw study sources into a structured, learning-ready .soul bundle. Use when turning .raw/{trackName}/*.md (lecture transcripts, notes, textbook dumps) into .soul/{trackName}/ JSON (concepts + retrieval cards with baked reference answers + explanations) for the study-anything pipeline. Trigger on requests like "structure this track", "build the soul for {track}", "가공해줘", "raw를 soul로", or when preparing content for DB import. This is the content-generation LLM step in the raw→soul→db→learning pipeline; runtime grading is unified on a light LLM judge (mcq is the only carve-out, graded by option equality), so every card must bake a reference answer and explanation.
---

# soul-structuring

Raw 학습 소스를 **암기·시험 최적화된 인출 단위**로 구조화해 `.soul/{trackName}/`로 출력한다. 이 결과는 그대로 DB에 import되어 [ASR 알고리즘](../../../docs/learning-algorithm-overview.md)으로 학습된다.

**대원칙:** 콘텐츠 생성(LLM)은 이 단계에서 끝난다. 런타임이 필요로 하는 모든 것(문항·**참조정답**·오답선택지·**해설**·혼동쌍)을 **여기서 누락 없이 베이크**해야 한다. 런타임 채점은 `card.type`이 결정한다 — `mcq`는 선택지 동등비교, 그 외(cloze·qa·application)는 경량 LLM이 참조정답·해설을 기준으로 채점. 출력은 반드시 `scripts/validate_soul.py`를 통과해야 한다.

출력 스키마(필드·규칙·grading.mode)는 **[references/soul-schema.md](references/soul-schema.md)** 가 권위 문서다. 작성 전 반드시 읽을 것.

## 워크플로

### 1. 입력 파악
- `.raw/{trackName}/` 의 모든 파일을 읽는다(확장자 없는 파일 포함). 각 파일 = 하나의 deck 후보.
- 강의 전사·구어체면 **인사말·잡담·운영 안내(수강신청, 출석 등)는 버리고** 개념만 추린다.

### 2. 개념(concept) 추출
- 파일을 의미 단위로 쪼개 **개념**을 뽑는다. 한 개념 = 가르칠 수 있는 하나의 규칙/구분/사실.
- 각 개념에 `bodyMd`(정제된 본문)와 `elaboration`("왜 그런가" 한두 문장)을 쓴다. **요약이 아니라 이해 가능한 핵심.**
- **혼동쌍**을 찾으면 `confusableWith`로 서로 연결한다(예: 현재완료 vs 과거, vs 과거완료).
- `conceptKey`는 영문 kebab-case 안정키.

### 3. 카드(card) 생성 — 학습의 본체
개념마다 **인출 가능한 카드를 여러 개**, 난이도 사다리로:
- `cloze`(빈칸) → `qa`(단답/서술) → `mcq`(객관식, 그럴듯한 distractor) → `application`(적용/전이).
- **한 카드 = 한 가지(atomic).** 한 카드에 여러 개념을 넣지 말 것.
- mcq의 distractor는 **혼동 개념에서** 끌어와 변별을 훈련시킨다.
- 모든 카드에 `explanation`(채점 후 보여줄 해설)과 `grading`을 채운다.

### 4. 정답·해설 베이크 (런타임 채점의 관건)
런타임 채점은 모드 분기 없이 **`card.type`이 결정**한다. soul이 할 일은 채점기가 쓸 기준을 빠짐없이 채우는 것:
- **모든 카드:** `answer`(참조정답)와 `explanation`(채점 후 노출 + LLM 판정 근거)을 반드시 채운다.
- **`mcq`:** `distractors[]`(혼동 개념에서 끌어온 그럴듯한 오답)를 채운다 → 런타임은 선택지 동등비교로 즉시 채점.
- **그 외(cloze·qa·application):** 런타임에 경량 LLM이 `answer`·`explanation` 기준으로 `{score, reason}` 채점. 모호하면 `grading.rubric[]`(선택)으로 판정 기준을 거들 수 있다.
- (선택·폴백) `grading.acceptedAnswers`/`keywords`를 남기면 **LLM 장애 시 결정적 채점**으로 강등된다. 필수 아님.
- 자세한 규칙은 [references/soul-schema.md](references/soul-schema.md)·[런타임 채점](../../../docs/runtime-grading.md) 참조.

### 5. 파일 쓰기
- `.soul/{trackSlug}/manifest.json` + `.soul/{trackSlug}/decks/{deckSlug}.json`.
- `trackSlug`/`deckSlug`는 원본 디렉토리·파일명을 그대로(한글 가능).
- `examDate`는 넣지 않는다(유저 입력).

### 6. 검증 (필수, 통과할 때까지 반복)
```bash
python3 .claude/skills/soul-structuring/scripts/validate_soul.py .soul/{trackSlug}
```
- 에러가 나오면 **모두 고치고 재실행.** 통과(✅) 전에는 끝난 게 아니다.
- 검증기는 누락 필드·중복 키·grading 미완·혼동쌍 깨진 참조를 잡는다 = "완제품" 보장.

## 주의
- **큰 입력 처리:** 전사 파일이 수십 KB일 수 있다. deck 단위로 나눠 처리하되, 개념을 과도하게 합치지 말 것(atomic 유지).
- **키 안정성:** 재가공 시 같은 개념/카드는 같은 `conceptKey`/`cardKey`를 유지해야 DB 진도가 보존된다. 의미 기반으로 키를 짓고 순번 의존 금지.
- **DB 진도(cardStates)는 만들지 않는다.** 그건 import 스크립트가 초기화한다.
