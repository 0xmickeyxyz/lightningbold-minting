import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3000)
const ORIGIN = process.env.ALLOWED_ORIGIN || '*'
const NETWORK = (process.env.NETWORK || 'mainnet').toLowerCase()

const FEE_SATS = Number(process.env.MINT_FEE_SATS || 0)
const FEE_ADDRESS = String(process.env.FEE_SPARK_ADDRESS || '')
const EXPLORER_BASE = String(process.env.SPARK_EXPLORER_BASE || 'https://www.sparkscan.io').replace(/\/$/, '')

const TOKEN_ID = String(process.env.TOKEN_ID || '')
const TOKEN_DECIMALS = Number(process.env.TOKEN_DECIMALS || 0)
const MINT_TOKENS = Number(process.env.MINT_TOKENS || 0)
const MAX_MINTS_PER_WALLET = Number(process.env.MAX_MINTS_PER_WALLET || 10)

if (!FEE_ADDRESS) throw new Error('Missing FEE_SPARK_ADDRESS')
if (!(FEE_SATS > 0)) throw new Error('MINT_FEE_SATS must be > 0')

const IS_VERCEL = process.env.VERCEL === '1'
const LOG_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, 'data')
const LOG_FILE = path.join(LOG_DIR, 'paid.csv')
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, 'ts,wallet,qty,amount_sats\n', 'utf8')

const app = express()
app.use(helmet())
app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/api/config', (_req, res) => {
  res.json({
    network: NETWORK,
    feeAddress: FEE_ADDRESS,
    feeSats: FEE_SATS,
    tokenId: TOKEN_ID,
    tokenDecimals: TOKEN_DECIMALS,
    tokensPerMint: MINT_TOKENS,
    maxMintsPerWallet: MAX_MINTS_PER_WALLET,
    explorerBase: EXPLORER_BASE
  })
})

// “Notepad” pencatat yang sudah bayar
app.post('/api/paid', (req, res) => {
  const wallet = String(req.body.wallet || '').trim()
  const qty = Number(req.body.qty || 1)
  const amount = Number(req.body.amount_sats || FEE_SATS * qty)

  if (!wallet) return res.status(400).json({ ok: false, error: 'Missing wallet' })
  const ts = Date.now()
  const line = `${ts},${wallet},${qty},${amount}\n`
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf8')
    res.json({ ok: true, message: 'Saved', path: IS_VERCEL ? '/tmp/paid.csv' : 'backend/data/paid.csv' })
  } catch {
    res.status(500).json({ ok: false, error: 'write_failed' })
  }
})

// lihat catatan
app.get('/api/paid.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.send(fs.readFileSync(LOG_FILE, 'utf8'))
})
app.get('/api/paid.json', (_req, res) => {
  const rows = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').slice(1)
  const json = rows.map(r => {
    const [ts, wallet, qty, amount_sats] = r.split(',')
    return { ts: Number(ts), wallet, qty: Number(qty), amount_sats: Number(amount_sats) }
  })
  res.json({ ok: true, rows: json })
})

app.get('/health', (_req, res) => res.json({ ok: true }))

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Local :${PORT} • fee=${FEE_ADDRESS} • network=${NETWORK}`)
    console.log(`Notepad: ${LOG_FILE}`)
  })
}

export default app
