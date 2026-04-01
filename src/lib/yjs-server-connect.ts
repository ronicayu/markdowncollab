import * as Y from "yjs";
import WebSocket from "ws";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

interface AgentUser {
  name: string;
  color: string;
}

interface YjsServerConnection {
  ydoc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  cleanup: () => void;
}

/**
 * Connect to a y-websocket server from Node.js (server-side).
 * Returns after initial sync completes or after timeout.
 */
export function connectYjsServer(
  wsUrl: string,
  roomName: string,
  agentUser?: AgentUser
): Promise<YjsServerConnection> {
  return new Promise((resolve, reject) => {
    const ydoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(ydoc);

    const url = `${wsUrl}/${roomName}`;
    const ws = new WebSocket(url);

    let synced = false;

    const timeout = setTimeout(() => {
      if (!synced) {
        cleanup();
        reject(new Error("Yjs sync timeout after 30 seconds"));
      }
    }, 30_000);

    function cleanup() {
      clearTimeout(timeout);
      awarenessProtocol.removeAwarenessStates(
        awareness,
        [ydoc.clientID],
        "cleanup"
      );
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      ydoc.destroy();
    }

    ws.binaryType = "arraybuffer";

    ws.on("open", () => {
      // Send sync step 1
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeSyncStep1(encoder, ydoc);
      ws.send(encoding.toUint8Array(encoder));

      // Set awareness state for agent cursor
      if (agentUser) {
        awareness.setLocalStateField("user", agentUser);

        const awarenessEncoder = encoding.createEncoder();
        encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(
          awarenessEncoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, [ydoc.clientID])
        );
        ws.send(encoding.toUint8Array(awarenessEncoder));
      }
    });

    ws.on("message", (data: ArrayBuffer | Buffer) => {
      const buf = new Uint8Array(
        data instanceof ArrayBuffer ? data : data.buffer
      );
      const decoder = decoding.createDecoder(buf);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === MSG_SYNC) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        const syncMessageType = syncProtocol.readSyncMessage(
          decoder,
          encoder,
          ydoc,
          null
        );

        // If encoder has content beyond the message type header, send it
        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder));
        }

        // Sync step 2 means we received the server's state — we are synced
        if (syncMessageType === 1 && !synced) {
          synced = true;
          resolve({ ydoc, awareness, cleanup });
        }
      } else if (messageType === MSG_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(
          awareness,
          decoding.readVarUint8Array(decoder),
          null
        );
      }
    });

    // Forward local doc updates to server
    ydoc.on("update", (update: Uint8Array) => {
      if (ws.readyState === WebSocket.OPEN) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        syncProtocol.writeUpdate(encoder, update);
        ws.send(encoding.toUint8Array(encoder));
      }
    });

    ws.on("error", (err) => {
      if (!synced) {
        clearTimeout(timeout);
        reject(err);
      }
    });

    ws.on("close", () => {
      if (!synced) {
        clearTimeout(timeout);
        reject(new Error("WebSocket closed before sync completed"));
      }
    });
  });
}
