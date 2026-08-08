import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI)
  const db = mongoose.connection.db
  const indexes = await db.collection('properties').indexes()
  const slugIndex = indexes.find(i => i.name === 'slug_1')
  if (slugIndex) {
    await db.collection('properties').dropIndex('slug_1')
    console.log('Dropped slug_1 index from properties collection')
  } else {
    console.log('slug_1 index not found')
  }
  await mongoose.disconnect()
}

main().catch(console.error)
