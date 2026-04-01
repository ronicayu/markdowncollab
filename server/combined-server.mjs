/**
 * Combined server: Next.js + Yjs WebSocket on a single port.
 * The WS server handles upgrade requests to /ws/* paths.
 * Everything else goes to Next.js.
 */
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000");
const persistDir = process.env.YPERSISTENCE || "./yjs-data";

if (!existsSync(persistDir)) mkdirSync(persistDir, { recursive: true });

// --- Yjs WebSocket Server ---
const messageSync = 0;
const messageAwareness = 1;

const docs = new Map();

function getDoc(docName) {
  if (docs.has(docName)) return docs.get(docName);
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);

  const filePath = join(persistDir, docName + ".bin");
  if (existsSync(filePath)) {
    const data = readFileSync(filePath);
    Y.applyUpdate(doc, new Uint8Array(data));
  }

  let saveTimeout = null;
  doc.on("update", () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const state = Y.encodeStateAsUpdate(doc);
      writeFileSync(filePath, Buffer.from(state));
    }, 1000);
  });

  const entry = { doc, awareness, conns: new Set() };
  docs.set(docName, entry);
  return entry;
}

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, req) => {
  // Room name from URL: /ws/room-name
  const urlPath = req.url || "/ws/default";
  const docName = urlPath.replace(/^\/ws\//, "") || "default";
  const { doc, awareness, conns: docConns } = getDoc(docName);
  docConns.add(ws);

  // Send sync step 1
  const enc1 = encoding.createEncoder();
  encoding.writeVarUint(enc1, messageSync);
  syncProtocol.writeSyncStep1(enc1, doc);
  ws.send(encoding.toUint8Array(enc1));

  // Send sync step 2
  const enc2 = encoding.createEncoder();
  encoding.writeVarUint(enc2, messageSync);
  syncProtocol.writeSyncStep2(enc2, doc);
  ws.send(encoding.toUint8Array(enc2));

  // Send current awareness
  const states = awareness.getStates();
  if (states.size > 0) {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, messageAwareness);
    encoding.writeVarUint8Array(
      enc,
      awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        Array.from(states.keys())
      )
    );
    ws.send(encoding.toUint8Array(enc));
  }

  ws.on("message", (data) => {
    const msg = new Uint8Array(data);
    const decoder = decoding.createDecoder(msg);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === messageSync) {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, messageSync);
      syncProtocol.readSyncMessage(decoder, enc, doc, null);
      if (encoding.length(enc) > 1) {
        ws.send(encoding.toUint8Array(enc));
      }
      docConns.forEach((client) => {
        if (client !== ws && client.readyState === 1) client.send(msg);
      });
    } else if (messageType === messageAwareness) {
      const update = decoding.readVarUint8Array(decoder);
      awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
      docConns.forEach((client) => {
        if (client !== ws && client.readyState === 1) client.send(msg);
      });
    }
  });

  ws.on("close", () => {
    docConns.delete(ws);
    awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], null);
  });
});

// --- Next.js ---
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Route WebSocket upgrades: /ws/* -> Yjs, everything else -> Next.js
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/ws/")) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
    // Let Next.js handle its own WebSocket upgrades (HMR)
  });

  server.listen(port, hostname, () => {
    console.log(`MarkdownCollab running on http://${hostname}:${port}`);
    console.log(`WebSocket server at ws://${hostname}:${port}/ws/`);
  });
});
