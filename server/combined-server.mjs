/**
 * Combined server: Next.js + Yjs WebSocket on a single port.
 * The WS server handles upgrade requests to /ws/* paths.
 * Everything else goes to Next.js.
 */
import { createServer } from "http";
import next from "next";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const wsDbClient = new PrismaClient();

async function checkWsAccess(documentId, userId, userEmail, shareToken) {
  const doc = await wsDbClient.document.findUnique({ where: { id: documentId } });
  if (!doc) return { hasAccess: false, role: null };
  if (!doc.ownerId) return { hasAccess: true, role: "editor" };
  if (userId && doc.ownerId === userId) return { hasAccess: true, role: "owner" };

  if (userId) {
    const byUser = await wsDbClient.documentShare.findFirst({ where: { documentId, userId } });
    if (byUser) return { hasAccess: true, role: byUser.role };
  }
  if (userEmail) {
    const byEmail = await wsDbClient.documentShare.findFirst({ where: { documentId, email: userEmail.toLowerCase() } });
    if (byEmail) return { hasAccess: true, role: byEmail.role };
  }
  if (shareToken) {
    const byToken = await wsDbClient.documentShare.findFirst({ where: { documentId, shareToken } });
    if (byToken) return { hasAccess: true, role: byToken.role };
  }
  if (doc.visibility === "anyone_with_link") return { hasAccess: true, role: "viewer" };
  return { hasAccess: false, role: null };
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000");
const persistDir = process.env.YPERSISTENCE || "./yjs-data";

if (!existsSync(persistDir)) mkdirSync(persistDir, { recursive: true });

// --- Yjs WebSocket Server ---
const messageSync = 0;
const messageAwareness = 1;

const markdownDir = process.env.MARKDOWN_DIR || "./documents";
if (!existsSync(markdownDir)) mkdirSync(markdownDir, { recursive: true });

const docs = new Map();

/**
 * Convert a Yjs XmlFragment (ProseMirror doc) to markdown.
 * Walks the tree and produces clean markdown text.
 */
function xmlFragmentToMarkdown(fragment) {
  let md = "";

  for (let i = 0; i < fragment.length; i++) {
    const child = fragment.get(i);

    if (child instanceof Y.XmlText) {
      md += xmlTextToMarkdown(child);
    } else if (child instanceof Y.XmlElement) {
      const tag = child.nodeName;

      if (tag === "heading") {
        const level = child.getAttribute("level") || 1;
        const prefix = "#".repeat(Number(level));
        md += `${prefix} ${getElementText(child)}\n\n`;
      } else if (tag === "paragraph") {
        const text = getElementText(child);
        if (text.length > 0) {
          md += `${text}\n\n`;
        } else {
          md += "\n";
        }
      } else if (tag === "bulletList") {
        md += listToMarkdown(child, "- ", 0);
        md += "\n";
      } else if (tag === "orderedList") {
        md += listToMarkdown(child, "1. ", 0);
        md += "\n";
      } else if (tag === "blockquote") {
        const inner = xmlFragmentToMarkdown(child);
        md += inner
          .split("\n")
          .map((line) => (line.trim() ? `> ${line}` : ">"))
          .join("\n");
        md += "\n\n";
      } else if (tag === "codeBlock") {
        const language = child.getAttribute("language") || "";
        md += `\`\`\`${language}\n${getElementText(child)}\n\`\`\`\n\n`;
      } else if (tag === "horizontalRule") {
        md += "---\n\n";
      } else {
        // Unknown block — just extract text
        const text = getElementText(child);
        if (text) md += `${text}\n\n`;
      }
    }
  }

  return md.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * Extract text from an XmlElement, handling inline marks.
 */
function getElementText(element) {
  let text = "";
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      text += xmlTextToMarkdown(child);
    } else if (child instanceof Y.XmlElement) {
      // Nested element (e.g. listItem containing paragraph)
      text += getElementText(child);
    }
  }
  return text;
}

/**
 * Convert XmlText with formatting deltas to inline markdown.
 */
function xmlTextToMarkdown(xmlText) {
  const delta = xmlText.toDelta();
  let text = "";
  for (const op of delta) {
    if (typeof op.insert !== "string") continue;
    let segment = op.insert;
    const attrs = op.attributes || {};

    // Skip suggestion-delete marks (text being removed)
    if (attrs.suggestionMark && attrs.suggestionMark.type === "delete") continue;

    if (attrs.code) segment = `\`${segment}\``;
    if (attrs.bold) segment = `**${segment}**`;
    if (attrs.italic) segment = `*${segment}*`;
    if (attrs.strike) segment = `~~${segment}~~`;
    if (attrs.link) segment = `[${segment}](${attrs.link.href})`;

    text += segment;
  }
  return text;
}

/**
 * Convert list elements to markdown with proper indentation.
 */
function listToMarkdown(listElement, prefix, indent) {
  let md = "";
  const spaces = "  ".repeat(indent);
  let itemNum = 1;

  for (let i = 0; i < listElement.length; i++) {
    const child = listElement.get(i);
    if (child instanceof Y.XmlElement && child.nodeName === "listItem") {
      for (let j = 0; j < child.length; j++) {
        const inner = child.get(j);
        if (inner instanceof Y.XmlElement) {
          if (inner.nodeName === "paragraph") {
            const bullet = prefix === "1. " ? `${itemNum}. ` : prefix;
            md += `${spaces}${bullet}${getElementText(inner)}\n`;
            itemNum++;
          } else if (inner.nodeName === "bulletList") {
            md += listToMarkdown(inner, "- ", indent + 1);
          } else if (inner.nodeName === "orderedList") {
            md += listToMarkdown(inner, "1. ", indent + 1);
          }
        }
      }
    }
  }
  return md;
}

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
      // Save Yjs binary state
      const state = Y.encodeStateAsUpdate(doc);
      writeFileSync(filePath, Buffer.from(state));

      // Save markdown file alongside
      try {
        const yxml = doc.getXmlFragment("default");
        if (yxml.length > 0) {
          const markdown = xmlFragmentToMarkdown(yxml);
          const mdPath = join(markdownDir, docName + ".md");
          writeFileSync(mdPath, markdown, "utf-8");
        }
      } catch (err) {
        console.error(`Error saving markdown for ${docName}:`, err.message);
      }
    }, 1000);
  });

  const entry = { doc, awareness, conns: new Set() };
  docs.set(docName, entry);
  return entry;
}

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, req) => {
  // Room name from URL: /ws/room-name (strip query params)
  const urlPath = req.url || "/ws/default";
  const docName = urlPath.replace(/^\/ws\//, "").split("?")[0] || "default";
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
      await handle(req, res);
    } catch (err) {
      console.error("Error handling request", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Route WebSocket upgrades: /ws/* -> Yjs, everything else -> Next.js
  server.on("upgrade", async (req, socket, head) => {
    if (req.url?.startsWith("/ws/")) {
      // Extract document ID from URL
      const docName = req.url.replace(/^\/ws\//, "").split("?")[0] || "default";

      // Parse token from query string
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const shareToken = urlObj.searchParams.get("token");
      const jwtToken = urlObj.searchParams.get("jwt");

      let userId = null;
      let userEmail = null;

      // Verify JWT if provided
      if (jwtToken) {
        try {
          const secret = process.env.NEXTAUTH_SECRET;
          if (secret) {
            const decoded = jwt.verify(jwtToken, secret);
            userId = decoded.id || decoded.sub || null;
            userEmail = decoded.email || null;
          }
        } catch {
          // Invalid JWT — continue without user context
        }
      }

      // Check access
      const access = await checkWsAccess(docName, userId, userEmail, shareToken);
      if (!access.hasAccess) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        // Attach role to the ws object so we can use it for awareness
        ws._userRole = access.role;
        ws._userId = userId;
        wss.emit("connection", ws, req);
      });
    }
    // Let Next.js handle its own WebSocket upgrades (HMR)
  });

  // Prevent ECONNRESET from crashing the server
  server.on("clientError", (err, socket) => {
    if (err.code === "ECONNRESET") {
      socket.destroy();
      return;
    }
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  server.listen(port, hostname, () => {
    console.log(`MarkdownCollab running on http://${hostname}:${port}`);
    console.log(`WebSocket server at ws://${hostname}:${port}/ws/`);
  });
});

// Catch unhandled connection resets globally so they don't crash the process
process.on("uncaughtException", (err) => {
  if (err.code === "ECONNRESET" || err.code === "EPIPE") return;
  console.error("Uncaught exception:", err);
  process.exit(1);
});
