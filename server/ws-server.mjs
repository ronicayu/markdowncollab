import { WebSocketServer } from 'ws'
import http from 'http'
import * as Y from 'yjs'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

const host = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.WS_PORT || '1234')
const persistDir = process.env.YPERSISTENCE || './yjs-data'

if (!existsSync(persistDir)) mkdirSync(persistDir, { recursive: true })

const messageSync = 0
const messageAwareness = 1

// In-memory docs
const docs = new Map()
const conns = new Map() // ws -> { docName, awareness clientID }

function getDoc(docName) {
  if (docs.has(docName)) return docs.get(docName)
  const doc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(doc)

  // Load from disk
  const filePath = join(persistDir, docName + '.bin')
  if (existsSync(filePath)) {
    const data = readFileSync(filePath)
    Y.applyUpdate(doc, new Uint8Array(data))
  }

  // Persist on update (debounced)
  let saveTimeout = null
  doc.on('update', () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      const state = Y.encodeStateAsUpdate(doc)
      writeFileSync(filePath, Buffer.from(state))
    }, 1000)
  })

  const entry = { doc, awareness, conns: new Set() }
  docs.set(docName, entry)
  return entry
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('yjs-ws-server')
})

const wss = new WebSocketServer({ noServer: true })

wss.on('connection', (ws, req) => {
  const docName = (req.url || '/').slice(1) || 'default'
  const { doc, awareness, conns: docConns } = getDoc(docName)
  docConns.add(ws)
  conns.set(ws, { docName })

  // Send sync step 1
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeSyncStep1(encoder, doc)
  ws.send(encoding.toUint8Array(encoder))

  // Send sync step 2 (full state)
  const encoder2 = encoding.createEncoder()
  encoding.writeVarUint(encoder2, messageSync)
  syncProtocol.writeSyncStep2(encoder2, doc)
  ws.send(encoding.toUint8Array(encoder2))

  // Send current awareness
  const awarenessStates = awareness.getStates()
  if (awarenessStates.size > 0) {
    const enc = encoding.createEncoder()
    encoding.writeVarUint(enc, messageAwareness)
    encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())))
    ws.send(encoding.toUint8Array(enc))
  }

  ws.on('message', (data) => {
    const msg = new Uint8Array(data)
    const decoder = decoding.createDecoder(msg)
    const messageType = decoding.readVarUint(decoder)

    if (messageType === messageSync) {
      const enc = encoding.createEncoder()
      encoding.writeVarUint(enc, messageSync)
      syncProtocol.readSyncMessage(decoder, enc, doc, null)
      if (encoding.length(enc) > 1) {
        ws.send(encoding.toUint8Array(enc))
      }
      // Broadcast update to others
      docConns.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(msg)
        }
      })
    } else if (messageType === messageAwareness) {
      const update = decoding.readVarUint8Array(decoder)
      awarenessProtocol.applyAwarenessUpdate(awareness, update, ws)
      // Broadcast awareness to others
      docConns.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(msg)
        }
      })
    }
  })

  ws.on('close', () => {
    docConns.delete(ws)
    conns.delete(ws)
    // Remove awareness state for this client
    awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], null)
  })
})

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

server.listen(port, host, () => {
  console.log(`Yjs WebSocket server running on ws://${host}:${port}`)
})
