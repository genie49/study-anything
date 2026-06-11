// .soul 번들 → DB 결정적 upsert. userId는 호출자(JWT)가 주입. auth.md / data-pipeline §3.
import { createHash } from 'node:crypto'
import { ObjectId, type AnyBulkWriteOperation, type Collection } from 'mongodb'
import { getDb } from '../db/mongo.js'

const CARD_TYPES = new Set(['cloze', 'qa', 'mcq', 'application'])

export type SoulCard = {
  cardKey: string; type: string; prompt: string; answer: string
  distractors?: string[]; hint?: string; explanation: string
  difficultyPrior: number; grading?: Record<string, unknown>
}
export type SoulConcept = {
  conceptKey: string; title: string; bodyMd: string; elaboration?: string
  order: number; confusableWith?: string[]; cards: SoulCard[]
}
export type SoulDeckPayload = { deckSlug: string; concepts: SoulConcept[] }
export type SoulManifestDeck = { slug: string; title: string; order: number; sourceRef?: string }
export type SoulBundle = {
  manifest: { soulVersion?: number; trackSlug: string; title: string; subjectType?: string; decks: SoulManifestDeck[] }
  decks: SoulDeckPayload[]
  examDate?: string
}
export type ImportSummary = { trackId: string; trackSlug: string; title: string; decks: number; concepts: number; cards: number; archived: number }

const sha1 = (s: string) => 'sha1:' + createHash('sha1').update(s).digest('hex')

function logImportPhase(trackSlug: string, phase: string, start: number, extra = '') {
  console.log(`[import] ${trackSlug} ${phase} ${Date.now() - start}ms${extra ? ` ${extra}` : ''}`)
}

async function bulkWriteUnordered(collection: Collection, operations: AnyBulkWriteOperation[], chunkSize = 500) {
  for (let i = 0; i < operations.length; i += chunkSize) {
    await collection.bulkWrite(operations.slice(i, i + chunkSize), { ordered: false })
  }
}

// validate_soul.py의 핵심 규칙을 런타임에 재확인. 통과해야 import.
export function validateBundle(b: unknown): string[] {
  const e: string[] = []
  const bundle = b as SoulBundle
  if (!bundle || typeof bundle !== 'object') return ['body must be an object']
  const m = bundle.manifest
  if (!m || typeof m !== 'object') e.push('manifest missing')
  else {
    if (m.soulVersion !== undefined && m.soulVersion !== 1) e.push('manifest.soulVersion must be 1')
    if (!m.trackSlug) e.push('manifest.trackSlug missing')
    if (!m.title) e.push('manifest.title missing')
    if (!Array.isArray(m.decks) || m.decks.length === 0) e.push('manifest.decks[] missing/empty')
  }
  if (!Array.isArray(bundle.decks) || bundle.decks.length === 0) { e.push('decks[] missing/empty'); return e }

  const manifestSlugs = new Set((m?.decks ?? []).map((d) => d.slug))
  const conceptKeys = new Set<string>()
  const cardKeys = new Set<string>()
  for (const d of bundle.decks) {
    if (!d.deckSlug) { e.push('deck.deckSlug missing'); continue }
    if (manifestSlugs.size && !manifestSlugs.has(d.deckSlug)) e.push(`deck '${d.deckSlug}' not in manifest.decks`)
    if (!Array.isArray(d.concepts) || d.concepts.length === 0) { e.push(`deck '${d.deckSlug}' concepts[] empty`); continue }
    for (const c of d.concepts) {
      const where = `${d.deckSlug}:${c.conceptKey ?? '?'}`
      if (!c.conceptKey) e.push(`${where} conceptKey missing`)
      else { if (conceptKeys.has(c.conceptKey)) e.push(`duplicate conceptKey '${c.conceptKey}'`); conceptKeys.add(c.conceptKey) }
      if (!c.title) e.push(`${where} title missing`)
      if (!c.bodyMd) e.push(`${where} bodyMd missing`)
      if (c.order == null) e.push(`${where} order missing`)
      if (!Array.isArray(c.cards) || c.cards.length === 0) { e.push(`${where} cards[] empty`); continue }
      for (const card of c.cards) {
        const cw = `${where}#${card.cardKey ?? '?'}`
        if (!card.cardKey) e.push(`${cw} cardKey missing`)
        else { if (cardKeys.has(card.cardKey)) e.push(`duplicate cardKey '${card.cardKey}'`); cardKeys.add(card.cardKey) }
        if (!CARD_TYPES.has(card.type)) e.push(`${cw} type invalid (${card.type})`)
        if (!card.prompt) e.push(`${cw} prompt missing`)
        if (!card.answer) e.push(`${cw} answer missing`)
        if (!card.explanation) e.push(`${cw} explanation missing`)
        if (typeof card.difficultyPrior !== 'number' || card.difficultyPrior < 0 || card.difficultyPrior > 1)
          e.push(`${cw} difficultyPrior must be in [0,1]`)
        if (card.type === 'mcq' && (!Array.isArray(card.distractors) || card.distractors.length === 0))
          e.push(`${cw} type=mcq requires distractors[]`)
      }
    }
  }
  // confusableWith 참조 무결성
  for (const d of bundle.decks) for (const c of d.concepts ?? []) for (const ref of c.confusableWith ?? [])
    if (!conceptKeys.has(ref)) e.push(`${c.conceptKey} confusableWith unknown '${ref}'`)
  return e
}

// 결정적 upsert. 진도(cardStates)는 보존, orphan은 soft-delete.
export async function importBundle(userId: string, bundle: SoulBundle): Promise<ImportSummary> {
  const db = getDb()
  const now = new Date()
  const { manifest } = bundle
  const startedAt = Date.now()

  // 1) track
  const track = await db.collection('tracks').findOneAndUpdate(
    { userId, trackSlug: manifest.trackSlug },
    {
      $set: { title: manifest.title, subjectType: manifest.subjectType ?? null, status: 'active', updatedAt: now, ...(bundle.examDate ? { examDate: new Date(bundle.examDate) } : {}) },
      $setOnInsert: { userId, trackSlug: manifest.trackSlug, createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  )
  const trackId = track!._id as ObjectId
  logImportPhase(manifest.trackSlug, 'track', startedAt)

  // 2) decks (manifest 기준 order/title)
  const deckSlugs = manifest.decks.map((d) => d.slug)
  await bulkWriteUnordered(
    db.collection('decks'),
    manifest.decks.map((d) => ({
      updateOne: {
        filter: { userId, trackId, deckSlug: d.slug },
        update: {
          $set: { title: d.title, order: d.order, sourceRef: d.sourceRef ?? null },
          $setOnInsert: { userId, trackId, deckSlug: d.slug, createdAt: now },
        },
        upsert: true,
      },
    })),
  )
  const deckDocs = await db.collection('decks')
    .find({ userId, trackId, deckSlug: { $in: deckSlugs } })
    .project({ _id: 1, deckSlug: 1 })
    .toArray()
  const deckIdBySlug = new Map<string, ObjectId>()
  for (const d of deckDocs) {
    deckIdBySlug.set(d.deckSlug as string, d._id as ObjectId)
  }
  logImportPhase(manifest.trackSlug, 'decks', startedAt, `count=${deckIdBySlug.size}`)

  // 3) concepts + cards
  const conceptRows: Array<{ deckId: ObjectId | null; concept: SoulConcept }> = []
  for (const dp of bundle.decks) {
    const deckId = deckIdBySlug.get(dp.deckSlug) ?? null
    for (const c of dp.concepts) {
      conceptRows.push({ deckId, concept: c })
    }
  }

  await bulkWriteUnordered(
    db.collection('concepts'),
    conceptRows.map(({ deckId, concept: c }) => ({
      updateOne: {
        filter: { userId, trackId, conceptKey: c.conceptKey },
        update: {
          $set: { deckId, title: c.title, bodyMd: c.bodyMd, elaboration: c.elaboration ?? null, order: c.order, confusableWith: [] },
          $setOnInsert: { userId, trackId, conceptKey: c.conceptKey, createdAt: now },
        },
        upsert: true,
      },
    })),
  )
  const conceptKeys = conceptRows.map(({ concept }) => concept.conceptKey)
  const conceptDocs = await db.collection('concepts')
    .find({ userId, trackId, conceptKey: { $in: conceptKeys } })
    .project({ _id: 1, conceptKey: 1 })
    .toArray()
  const conceptIdByKey = new Map<string, ObjectId>()
  for (const c of conceptDocs) {
    conceptIdByKey.set(c.conceptKey as string, c._id as ObjectId)
  }

  const confusableOps = conceptRows
    .filter(({ concept }) => concept.confusableWith?.length)
    .map(({ concept }) => ({
      updateOne: {
        filter: { _id: conceptIdByKey.get(concept.conceptKey) },
        update: { $set: { confusableWith: (concept.confusableWith ?? []).map((k) => conceptIdByKey.get(k)).filter((x): x is ObjectId => !!x) } },
      },
    }))
  if (confusableOps.length) {
    await bulkWriteUnordered(db.collection('concepts'), confusableOps)
  }
  logImportPhase(manifest.trackSlug, 'concepts', startedAt, `count=${conceptRows.length}`)

  const cardRows: Array<{ deckId: ObjectId | null; conceptId: ObjectId; card: SoulCard }> = []
  for (const dp of bundle.decks) {
    const deckId = deckIdBySlug.get(dp.deckSlug) ?? null
    for (const c of dp.concepts) {
      const conceptId = conceptIdByKey.get(c.conceptKey)
      if (!conceptId) throw new Error(`concept id not found for '${c.conceptKey}'`)
      for (const card of c.cards) cardRows.push({ deckId, conceptId, card })
    }
  }
  const seenSoulKeys = cardRows.map(({ card }) => card.cardKey)

  await bulkWriteUnordered(
    db.collection('cards'),
    cardRows.map(({ deckId, conceptId, card }) => {
      const soulHash = sha1(JSON.stringify({ p: card.prompt, a: card.answer, d: card.distractors, e: card.explanation, t: card.type }))
      return {
        updateOne: {
          filter: { userId, trackId, soulKey: card.cardKey },
          update: {
            $set: { conceptId, deckId, type: card.type, prompt: card.prompt, answer: card.answer, distractors: card.distractors ?? [], hint: card.hint ?? null, explanation: card.explanation, difficultyPrior: card.difficultyPrior, grading: card.grading ?? null, soulHash, status: 'active', updatedAt: now },
            $setOnInsert: { userId, trackId, soulKey: card.cardKey, createdAt: now },
          },
          upsert: true,
        },
      }
    }),
  )
  const cardDocs = await db.collection('cards')
    .find({ userId, trackId, soulKey: { $in: seenSoulKeys } })
    .project({ _id: 1, soulKey: 1 })
    .toArray()
  const cardIdBySoulKey = new Map<string, ObjectId>()
  for (const c of cardDocs) {
    cardIdBySoulKey.set(c.soulKey as string, c._id as ObjectId)
  }
  logImportPhase(manifest.trackSlug, 'cards', startedAt, `count=${cardRows.length}`)

  await bulkWriteUnordered(
    db.collection('cardStates'),
    cardRows.map(({ card }) => {
      const cardId = cardIdBySoulKey.get(card.cardKey)
      if (!cardId) throw new Error(`card id not found for '${card.cardKey}'`)
      return {
        updateOne: {
          filter: { userId, cardId },
          update: {
            $setOnInsert: { userId, trackId, cardId, stage: 'new', S: 0, D: card.difficultyPrior, dueAt: now, reps: 0, lapses: 0, createdAt: now },
            $set: { archived: false },
          },
          upsert: true,
        },
      }
    }),
  )
  logImportPhase(manifest.trackSlug, 'cardStates', startedAt, `count=${cardRows.length}`)

  // 4) orphan soft-delete — 새 번들에 없는 기존 카드 + 그 진도 비활성
  const orphans = await db.collection('cards').find({ userId, trackId, status: 'active', soulKey: { $nin: seenSoulKeys } }).project({ _id: 1 }).toArray()
  let archived = 0
  if (orphans.length) {
    const ids = orphans.map((o) => o._id as ObjectId)
    await db.collection('cards').updateMany({ _id: { $in: ids } }, { $set: { status: 'archived', updatedAt: now } })
    await db.collection('cardStates').updateMany({ userId, cardId: { $in: ids } }, { $set: { archived: true } })
    archived = ids.length
  }
  logImportPhase(manifest.trackSlug, 'orphans', startedAt, `archived=${archived}`)

  return { trackId: String(trackId), trackSlug: manifest.trackSlug, title: manifest.title, decks: deckIdBySlug.size, concepts: conceptRows.length, cards: cardRows.length, archived }
}
