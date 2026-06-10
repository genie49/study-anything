# 학습 과학 리서치: 단기 고효율 암기 & 시험 고득점 전략

> study-anything 서비스(raw md → 구조화 → DB → 개념/다지기 학습) 설계를 위한 근거 기반 정리.
> 결론부터: **"읽기"가 아니라 "인출(retrieval) + 분산(spacing)"이 시험 점수를 만든다.** 제품의 "다지기"가 핵심 엔진이 되어야 한다.

---

## TL;DR — 제품에 바로 박아야 할 5가지

1. **다지기(테스트)가 학습의 본체다.** 개념 읽기는 인코딩 준비 단계일 뿐, 점수를 올리는 건 "스스로 떠올리기". → 모든 개념은 반드시 인출 가능한 카드(Q/A, 빈칸, 객관식)로 자동 생성.
2. **분산 반복(spaced repetition)으로 같은 카드를 시험까지 여러 세션에 걸쳐 다시 풀게 한다.** 한 번 맞혔다고 끝내지 말 것.
3. **"성공적 재학습(successive relearning)"** = 한 세션 안에서 정답 1회까지 인출 + 여러 세션에 분산. 실제 강의 시험에서 **1등급(한 letter grade) 이상** 상승이 입증된 가장 강력한 프로토콜. → 제품의 기본 학습 루프로 채택.
4. **개념을 보기 전에 먼저 풀게 한다(pretesting).** 틀려도 좋다. 틀린 추측이 이후 정답 인코딩을 강화한다. → "다지기 먼저 → 개념 공개" 순서를 옵션으로.
5. **간격은 "시험까지 남은 기간"에 맞춰 동적으로.** 최적 간격 ≈ 기억 보유 목표 기간의 10~20%. 단기 시험(D-7)과 장기 기억은 스케줄이 다르다.

---

## 1. 근거: 무엇이 실제로 효과 있나 (메타분석 랭킹)

Dunlosky 등(2013)이 10가지 학습 기법을 효용성으로 등급화했고, 후속 메타분석(2021)이 **242개 연구 / 1,619개 효과 / 169,179명, 평균 효과크기 d ≈ 0.56**으로 이를 정량 확인.

| 등급 | 기법 | 제품 매핑 |
|------|------|-----------|
| **최상 (High utility)** | **Practice testing (인출 연습)** | "다지기" 코어 |
| **최상** | **Distributed practice (분산 학습)** | 복습 스케줄러 |
| 중간 | Interleaved practice (교차) | 다지기 출제 순서 |
| 중간 | Elaborative interrogation (왜?-질문) | 개념 보강 카드 |
| 중간 | Self-explanation (자기설명) | 개념 모드 프롬프트 |
| **낮음** | **재읽기(rereading), 밑줄, 요약(summarization)** | ⚠️ 학습자가 가장 많이 쓰지만 효과 최하 — 이것만 하게 두면 안 됨 |

> 핵심 함의: 사용자가 본능적으로 하는 "개념 다시 읽기 + 밑줄"은 **착각적 유창함(illusion of fluency)**만 준다. 제품이 의도적으로 "인출"로 밀어붙여야 한다.

---

## 2. 핵심 원리 6가지 (메커니즘 + 적용)

### ① Retrieval Practice / 테스트 효과
머릿속에서 **다시 꺼내는 행위 자체**가 기억 흔적을 강화. 단순 재학습보다 시험 점수를 크게 올림. 의대 면허시험에서도 학생 주도 인출 연습량이 성적을 예측.
- 적용: 모든 개념을 **free recall(자유 회상) → cued recall(단서 회상) → recognition(객관식)** 난이도 사다리로 출제. 자유 회상이 가장 강력하지만 채점이 어려우니 빈칸(cloze)·단답으로 근사.

### ② Spaced Repetition / 분산 학습 + 최적 간격
Cepeda 등(2006) 메타분석(317개 실험, 14,000+ 관측): 같은 학습량이면 **몰아서(massed)보다 나눠서(spaced)**가 항상 유리.
- **최적 간격 공식(경험칙):** 최적 학습간격(ISI) ≈ **목표 보유기간의 10~20%**.
  - 시험이 7일 뒤 → 약 1일 간격 복습.
  - 시험이 30일 뒤 → 약 3~6일 간격.
  - 1년 보유 목표 → 수 주~월 간격.
- 적용: 카드마다 "다음 복습일"을 계산해 큐에 넣고, 시험일(deadline)을 받아 간격을 압축/확장.

### ③ Successive Relearning (성공적 재학습) — **가장 실전적**
Rawson & Dunlosky: 인출 연습 + 분산을 결합해 **"각 세션에서 정답 1회 이상까지 인출 → 며칠 간격으로 세션 반복"**.
- 실제 심리학·생물심리학 강의 시험에서 자가학습 대비 **1 letter grade 이상** 향상, 장기 보유도 우수.
- 흥미로운 디테일: 첫 세션에서 3회 연속 정답까지 시키면 1주 후엔 유리하지만, **3세션 분산 재학습을 거치면 그 초기 차이는 사라짐** → "한 번에 과하게"보다 "여러 날에 걸쳐 가볍게"가 효율적.
- 적용: 제품의 **기본 학습 루프 = successive relearning**. "오늘 이 개념 정답 1회 → 며칠 뒤 다시 → 또 며칠 뒤" 를 시험일까지 반복.

### ④ Pretesting / 사전테스트 (errorful generation)
개념을 **배우기 전에 먼저 추측해서 틀리는 것**이, 그냥 정답을 보고 외우는 것보다 최종 기억을 향상. 틀린 추측이 의미적 다리(semantic mediator) 역할을 하고, 이후 피드백 처리를 강화(prediction error).
- 성인 전 연령에서 견고(robust). 피드백 유무와 무관하게 사전테스트가 우세.
- 적용: "다지기 먼저 → 개념 공개" 모드. 첫 노출 시 **"감으로 찍어보기 → 정답·해설 공개"** UX. 사용자는 "어렵다"고 느끼지만(메타인지 착각) 실제론 더 잘 외움.

### ⑤ Interleaving (교차 연습)
유사하지만 다른 유형을 섞어 풀면, 한 유형씩 몰아 푸는(blocked) 것보다 **유형 변별력·전이**가 향상. 3D 부피공식 실험: 교차 63% vs 블록 20%(1주 후 지연 시험).
- 적용: 다지기 출제 시 한 챕터 안에서 **개념 유형을 섞어** 내고, 비슷한 개념(헷갈리는 쌍)을 의도적으로 인접 출제해 변별 훈련.

### ⑥ Desirable Difficulties (바람직한 어려움) — 상위 프레임
Bjork: 위 전략들(분산·교차·인출)은 **학습 중엔 더 어렵고 비효율처럼 느껴지지만** 장기 성과는 훨씬 좋다. **"학습 중 수행(performance) ≠ 실제 학습(learning)"** — 오히려 반비례하기도.
- 제품 설계 함의: **사용자 체감 난이도와 실제 효과가 어긋난다.** UI가 "쉽고 매끄러운 재읽기"로 유혹하면 안 되고, 약간의 노력감을 유지하되 **진척·정복감(streak, 안정도 상승 시각화)**으로 동기를 보상해야 한다.

보강 요소(인코딩 품질): **Elaborative interrogation("왜 이게 맞지?")**, **Self-explanation(자기 말로 설명)**, **Dual coding(글+도식)**은 개념 모드에서 깊이를 더한다.

---

## 3. 간격 스케줄링 알고리즘 선택

### 옵션 비교
| 알고리즘 | 특징 | 추천 상황 |
|----------|------|-----------|
| **Leitner 박스** | 5박스, 맞으면 다음 박스(긴 간격), 틀리면 1박스로. 구현 1일. | MVP, 간단·투명 |
| **SM-2** (SuperMemo/구 Anki) | 카드별 ease factor + 회상 등급(0~5)으로 간격. 1987년. | 표준, 자료 풍부. 단점: 연속 실패 시 "저간격 지옥" |
| **FSRS** (현 Anki 기본, 2023.10~) | 기억을 **안정도(stability)·난이도(difficulty)·인출확률(retrievability)** 3요소로 모델링, 멱법칙 망각곡선. 목표 보유율(desired retention)을 정하면 그 확률 도달 시점에 정확히 복습 배치. | 같은 보유율에 **복습 20~30% 절감**. 데이터 쌓이면 최적 |

### 단기 시험용 보정 (중요)
표준 SRS는 "장기 보유"가 목표라 간격이 길어진다. **시험 D-day가 가까우면 간격을 deadline에 맞춰 압축**해야 한다.
- 권장: 각 카드에 `due` 계산 후, **시험일까지 남은 일수로 cap**을 건다. (예: D-3이면 다음 복습을 시험 전에 최소 1~2회 강제 삽입)
- "목표 보유율(retention)"을 시험일에 최대가 되도록 설정 → FSRS의 `desired retention`을 시험 모드에서 0.9~0.95로 상향.
- 마지막 날은 **약점 카드(저 stability/오답 이력) 위주 집중 재인출** (몰아치기라도 "재읽기"가 아니라 "인출"로).

---

## 4. 제품 구조 매핑 (raw md → 구조화 → 개념/다지기)

### 4.1 Claude 스킬 구조화 단계에서 "추출해야 할 것"
단순 요약 금지(요약은 저효용). 대신 **인출 가능 단위**로 분해:
- **Atomic concept(원자적 개념):** 한 카드 = 한 사실/관계. (Anki 원칙 "minimum information")
- **개념 본문:** 정의 + 왜 그런지(elaboration) + 예시 + (가능하면) 도식 설명(dual coding).
- **인출 아이템 자동 생성(개념당 다중):**
  - `cloze`(빈칸): 핵심어 가리기
  - `qa`(단답/서술): "X란 무엇인가?" / "왜 Y인가?"
  - `mcq`(객관식): 그럴듯한 오답(distractor) 포함 — 헷갈리는 인접 개념을 오답으로 → interleaving·변별
  - `application`(적용/문제): 전이 측정
- **개념 간 관계 태그:** 헷갈리는 쌍(confusable pairs) 표시 → 교차 출제용.

### 4.2 권장 DB 스키마 (핵심 테이블)
```
deck(id, title, source_md, exam_date NULLABLE)        -- exam_date로 단기 모드 트리거
concept(id, deck_id, title, body_md, elaboration, order)
card(id, concept_id, type[cloze|qa|mcq|application],
     prompt, answer, distractors JSON)
review_log(id, card_id, user_id, ts, grade,           -- grade: again/hard/good/easy or 0~5
           elapsed_ms, was_pretest BOOL)
card_state(card_id, user_id,
           stability FLOAT, difficulty FLOAT,          -- FSRS용
           ease FLOAT, interval_days,                  -- SM-2/Leitner용
           reps, lapses, due_at, last_review,
           session_correct_streak INT)                 -- successive relearning: 세션 내 정답 연속
```
- `review_log`를 풍부히 남겨야 FSRS 최적화/약점 분석 가능.
- `card_state.due_at`을 deadline로 cap 하는 로직이 단기 시험의 점수를 좌우.

### 4.3 두 모드의 역할 (학습과학적 정의)
- **개념 모드 = 인코딩(encoding).**
  - (옵션) **사전테스트 먼저** → 추측 → 개념 공개(pretesting effect).
  - 개념 + **"왜?" 자기설명 프롬프트**(elaborative interrogation). 단순 읽기로 끝내지 말 것.
- **다지기 모드 = 인출(retrieval) — 점수 엔진.**
  - **successive relearning 루프:** 한 세션에서 **정답 1회까지** 인출 → 분산 스케줄로 재등장.
  - 난이도 사다리: cloze → 단답 → mcq → 적용.
  - **즉시 피드백 + 정답 해설**(틀린 직후 교정이 prediction error를 활용).
  - **interleaving:** 챕터 내 유형/개념 섞기, 헷갈리는 쌍 인접 배치.
  - 채점 후 `grade`를 SRS에 전달 → 다음 `due_at` 갱신.

---

## 5. 단기 시험 D-7 실전 프로토콜 (제품이 자동 생성할 플랜)

전제: 분산 > 몰아치기. 7일이면 **매일 짧게, 같은 카드를 여러 날 재인출**.

- **D-7 (인코딩 + 1차 인출):** 사전테스트(찍기) → 개념 학습 → 그날 cloze/단답 정답 1회씩(successive relearning 세션1). 전 범위 1회 훑되 **읽기 아니라 풀기로**.
- **D-6 ~ D-2 (분산 재인출):** 매일 SRS 큐 소화. 맞은 카드는 간격 늘려 가볍게, 틀린 카드는 짧은 간격으로 재등장. **교차 출제**로 변별 훈련. 매 세션 "정답 1회까지".
- **D-1 (약점 집중 + 적용):** 오답·저안정도 카드만 모아 재인출. application/mcq 위주로 전이 점검. 새 내용 욕심 금지.
- **D-day 직전:** 가장 약한 10~20장만 빠르게 재인출(가벼운 워밍업). 벼락치기여도 "다시 읽기"가 아니라 "다시 떠올리기".

> 동기 유지: 체감은 어렵다(desirable difficulty). **안정도/정복률 그래프, streak, "이 카드 기억확률 92%"** 같은 시각화로 보상.

---

## 6. 흔한 함정 (안티패턴)

1. **요약·재읽기·밑줄을 메인으로** — 체감은 좋지만 효용 최하. 보조로만.
2. **한 번 맞히면 졸업 처리** — 분산 재인출 없이는 곧 잊음. 시험일까지 재등장 필수.
3. **장기 SRS 간격을 단기 시험에 그대로** — deadline cap 없으면 시험 전에 복습이 안 잡힘.
4. **체감 난이도로 효과 판단** — 사용자/알고리즘 모두 "쉬운 게 좋다"고 착각(metacognitive illusion). 데이터(인출 성공률·보유율)로 판단.
5. **카드가 너무 큼** — 한 카드 다개념이면 인출 실패·진단 불가. atomic하게 쪼갤 것.
6. **피드백 지연** — 틀린 직후 교정이 가장 효과적. 채점·해설을 즉시.

---

## 출처

- Dunlosky et al. (2013), *Improving Students' Learning With Effective Learning Techniques* — [SAGE](https://journals.sagepub.com/doi/abs/10.1177/1529100612453266), [요약(AFT)](https://www.aft.org/ae/fall2013/dunlosky)
- *A Meta-Analysis of Ten Learning Techniques* (2021) — [Frontiers](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2021.581216/full)
- Cepeda et al. (2006), 분산학습 메타분석 / 최적 간격 — [PDF](https://augmentingcognition.com/assets/Cepeda2006.pdf), [Spacing Effects ridgeline](https://www.researchgate.net/publication/23657355_Spacing_Effects_in_Learning_A_Temporal_Ridgeline_of_Optimal_Retention)
- 분산학습 교실 적용 메타분석(2025) — [MDPI](https://www.mdpi.com/2076-328X/15/6/771) / [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12189222/)
- Rawson & Dunlosky, Successive Relearning — [개관(2022)](https://journals.sagepub.com/doi/full/10.1177/09637214221100484), [강의시험 적용(2020)](https://onlinelibrary.wiley.com/doi/abs/10.1002/acp.3699)
- Pretesting / errorful generation — [Memory & Cognition(2025)](https://link.springer.com/article/10.3758/s13421-025-01813-x), [Journal of Cognition](https://journalofcognition.org/articles/10.5334/joc.455), [해설](https://www.structural-learning.com/post/pretesting-effect-testing-before-teaching)
- Bjork, Desirable Difficulties — [Bjork & Bjork PDF](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-introducing-desirable-difficulties-into-practice-and-instruction-bjork-and-bjork.pdf), [가이드](https://www.structural-learning.com/post/robert-bjork-teachers-guide-desirable)
- 인출연습과 의대시험 성적 — [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4673073/)
- SRS 알고리즘 (SM-2 vs FSRS) — [FSRS vs SM-2](https://deckstudy.com/blog/fsrs-vs-sm2-modern-spaced-repetition), [Anki FAQ](https://faqs.ankiweb.net/what-spaced-repetition-algorithm), [FSRS 비교](https://deepwiki.com/open-spaced-repetition/fsrs-optimizer/7.3-comparison-with-sm-2)
