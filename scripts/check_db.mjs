import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('data/mayan.db')
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
console.log('Tables:', tables.map(t => t.name))

for (const t of tables) {
  try {
    const rows = db.prepare('SELECT * FROM ' + t.name).all()
    for (const r of rows) {
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === 'bigint' || String(v).includes('100000000010100000')) {
          console.log(`Found in ${t.name}.${k}:`, v)
        }
      }
    }
  } catch (err) {
    console.log(`Error in table ${t.name}:`, err.message)
  }
}
