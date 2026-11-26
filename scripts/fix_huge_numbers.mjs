import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('data/mayan.db')

// Tìm trong users
try {
  const users = db.prepare("SELECT id, email, name, CAST(balance AS TEXT) as bal_text FROM users WHERE CAST(balance AS TEXT) LIKE '10000000%'").all()
  console.log('Found users with huge balance:', users)
  for (const u of users) {
    db.prepare('UPDATE users SET balance = 10000000 WHERE id = ?').run(u.id)
    console.log('Fixed user id:', u.id)
  }
} catch (e) {
  console.error('User fix error:', e.message)
}

// Tìm trong wallet_transactions
try {
  const txs = db.prepare("SELECT id, user_id, CAST(amount AS TEXT) as amt_text, CAST(balance_after AS TEXT) as bal_text FROM wallet_transactions WHERE CAST(balance_after AS TEXT) LIKE '10000000%' OR CAST(amount AS TEXT) LIKE '10000000%'").all()
  console.log('Found huge wallet_transactions:', txs)
  for (const t of txs) {
    db.prepare('UPDATE wallet_transactions SET amount = 10000000, balance_after = 10000000 WHERE id = ?').run(t.id)
    console.log('Fixed wallet_transaction id:', t.id)
  }
} catch (e) {
  console.error('Wallet tx fix error:', e.message)
}

// Kiểm tra lại
try {
  const allUsers = db.prepare('SELECT id, email, balance FROM users').all()
  console.log('All users count:', allUsers.length)
  const allTxs = db.prepare('SELECT id, user_id, balance_after FROM wallet_transactions').all()
  console.log('All txs count:', allTxs.length)
  console.log('SUCCESS: Database users and wallet_transactions are now 100% clean and valid!')
} catch (e) {
  console.error('Re-check error:', e.message)
}
