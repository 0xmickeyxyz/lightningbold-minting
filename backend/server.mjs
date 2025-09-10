import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

/* ===== ENV ===== */
const PORT = Number(process.env.PORT || 3000)
const ORIGIN = process.env.ALLOWED_ORIGIN || '*'
const NETWORK = (process.env.NETWORK || 'MAINNET').toLowerCase()

const FEE_SATS = Number(process.env.MINT_FEE_SATS || 0)
const FEE_ADDRESS = String(process.env.FEE_SPARK_ADDRESS || '')
const EXPLORER_BASE = String(process.env.SPARK_EXPLORER_BASE || 'https://www.sparkscan.io').replace(/\/$/, '')

const TOKEN_ID = String(process.env.TOKEN_ID || '')
const TOKEN_DECIMALS = Number(process.env.TOKEN_DECIMALS || 8)
const MINT_TOKENS = Number(process.env.MINT_TOKENS || 1000)
const MAX_MINTS_PER_WALLET = Number(process.env.MAX_MINTS_PER_WALLET || 10)

if (!FEE_ADDRESS) console.warn('[warn] FEE_SPARK_ADDRESS is empty')
if (!FEE_SATS) console.warn('[warn] MINT_FEE_SATS is 0')

/* ===== APP ===== */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(helmet())
app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN }))
app.use(express.json())

// Serve static (lokal). Di Vercel, static dilayani oleh vercel.json.
app.use(express.static(path.join(__dirname, 'public')))

/* ===== PATH CSV (notepad) ===== */
// Di Vercel: /tmp/paid.csv (non-persistent). Di lokal: backend/data/paid.csv
const isVercel = process.env.VERCEL === '1'
const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, 'data')
const CSV_PATH = path.join(DATA_DIR, 'paid.csv')

function ensureCsvHeader() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(CSV_PATH, 'ts,wallet,qty,amount_sats\n', 'utf8')
  }
}
ensureCsvHeader()

/* ===== CONFIG ===== */
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

/* ===== Notepad: simpan yang sudah bayar ===== */
app.post('/api/i-paid', (req, res) => {
  try {
    const wallet = String(req.body.wallet || '').trim()
    const qty = Number(req.body.qty || req.body.count || 1)
    const amount = Number(req.body.amount_sats || 0)

    if (!wallet) return res.status(400).json({ ok:false, message:'wallet required' })
    if (![1,2,5,10].includes(qty)) return res.status(400).json({ ok:false, message:'invalid qty' })

    ensureCsvHeader()
    const line = `${Date.now()},${wallet},${qty},${amount}\n`
    fs.appendFileSync(CSV_PATH, line, 'utf8')

    res.json({ ok:true, status:'RECORDED' })
  } catch (e) {
    res.status(500).json({ ok:false, message:'failed to save', detail:String(e) })
  }
})

app.get('/api/paid.csv', (_req, res) => {
  try {
    ensureCsvHeader()
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.send(fs.readFileSync(CSV_PATH, 'utf8'))
  } catch (e) {
    res.status(500).send('error')
  }
})

app.get('/api/paid.json', (_req, res) => {
  try {
    ensureCsvHeader()
    const text = fs.readFileSync(CSV_PATH, 'utf8').trim()
    const rows = text.split('\n').slice(1).filter(Boolean).map(line => {
      const [ts,wallet,qty,amount_sats] = line.split(',')
      return { ts:Number(ts), wallet, qty:Number(qty), amount_sats:Number(amount_sats) }
    })
    res.json({ ok:true, rows })
  } catch (e) {
    res.status(500).json({ ok:false, message:'error' })
  }
})

/* ===== Health ===== */
app.get('/health', (_req,res) => res.json({ ok:true, ver:'lightningbold-minimal' }))

/* ===== Start (lokal) ===== */
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`Local :${PORT} • fee=${FEE_ADDRESS} • network=${NETWORK} • csv=${CSV_PATH}`)
  })
}

export default app
