import { MongoClient, type Db } from 'mongodb'

let client: MongoClient | null = null
let db: Db | null = null

export async function connectMongo(): Promise<Db> {
  if (db) return db
  const url = process.env.MONGO_URL ?? 'mongodb://localhost:27017/study'
  client = new MongoClient(url)
  await client.connect()
  db = client.db() // URL의 기본 DB(study) 사용
  console.log('[mongo] connected')
  return db
}

export function getDb(): Db {
  if (!db) throw new Error('Mongo not connected — connectMongo()를 먼저 호출하세요')
  return db
}

export async function closeMongo(): Promise<void> {
  await client?.close()
  client = null
  db = null
}
