import { MongoClient } from 'mongodb'
import { computeSearchFields, createSearchIndexes } from '@quaesitor-textus/mongo'
import { demoConfig } from './shared/config'
import { generateBooks, SEED_COUNT } from './shared/generator'

const URL = process.env.MONGO_URL ?? 'mongodb://localhost:27018/?replicaSet=rs0'

async function main() {
  const client = await MongoClient.connect(URL)
  const col = client.db('demo').collection('books')
  await col.deleteMany({})
  // Seed only the first SEED_COUNT books, WITH derived fields (batch).
  const seedDocs = generateBooks().slice(0, SEED_COUNT)
    .map(b => ({ ...b, ...computeSearchFields(b, demoConfig) }))
  await col.insertMany(seedDocs as never[]) // string _id is valid in Mongo; relax driver's ObjectId default
  await createSearchIndexes(col, demoConfig)
  console.log(`Seeded ${seedDocs.length} books; indexes created.`)
  await client.close()
}

main().catch(err => { console.error(err); process.exit(1) })
