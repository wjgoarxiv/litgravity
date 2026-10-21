// Frame egress (MO-A-02 option 1): a minimal RFC 6455 WebSocket server on 127.0.0.1 with an
// OS-assigned port. The page sends each frame's metadata as a text message and its RGBA bytes as a
// binary message; the server acks every binary frame so the page never runs more than a few frames
// ahead. No dependency: the handshake and framing below are the whole protocol this needs.
import { createHash } from "node:crypto";
import { createServer } from "node:http";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export function startFrameServer({ onText, onBinary, host = "127.0.0.1", listen = null } = {}) {
  return new Promise((resolve, reject) => {
    const server = createServer((_, res) => {
      res.writeHead(426);
      res.end("websocket only");
    });
    let socket = null;
    server.on("upgrade", (req, sock) => {
      const key = req.headers["sec-websocket-key"];
      if (!key || socket) {
        sock.destroy();
        return;
      }
      const accept = createHash("sha1").update(key + GUID).digest("base64");
      sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
      sock.setNoDelay(true);
      socket = sock;
      // Chunks are kept in a list and joined once per frame: re-concatenating on every TCP chunk
      // would copy an 8 MB frame over a hundred times.
      let chunks = [];
      let total = 0;
      let need = 2;
      let fragments = [];
      let fragmentOp = 0;
      const take = () => {
        const joined = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, total);
        chunks = [joined];
        return joined;
      };
      sock.on("data", (chunk) => {
        chunks.push(chunk);
        total += chunk.length;
        while (total >= need) {
          const buffer = take();
          const op = buffer[0] & 0x0f;
          const fin = (buffer[0] & 0x80) !== 0;
          const masked = (buffer[1] & 0x80) !== 0;
          let len = buffer[1] & 0x7f;
          let off = 2;
          if (len === 126) {
            if (buffer.length < 4) { need = 4; return; }
            len = buffer.readUInt16BE(2);
            off = 4;
          } else if (len === 127) {
            if (buffer.length < 10) { need = 10; return; }
            len = Number(buffer.readBigUInt64BE(2));
            off = 10;
          }
          const maskOff = off;
          if (masked) off += 4;
          if (buffer.length < off + len) { need = off + len; return; }
          const payload = Buffer.from(buffer.subarray(off, off + len));
          if (masked) {
            const mask = buffer.subarray(maskOff, maskOff + 4);
            for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
          }
          const rest = buffer.subarray(off + len);
          chunks = rest.length ? [rest] : [];
          total = rest.length;
          need = 2;
          if (op === 0x8) {
            sock.end();
            return;
          }
          if (op === 0x9) {
            sendFrame(sock, 0xa, payload);
            continue;
          }
          if (op === 0x1 || op === 0x2) {
            fragmentOp = op;
            fragments = [payload];
          } else if (op === 0x0) fragments.push(payload);
          else continue;
          if (!fin) continue;
          const message = fragments.length === 1 ? fragments[0] : Buffer.concat(fragments);
          fragments = [];
          if (fragmentOp === 0x1) onText?.(message.toString("utf8"));
          else onBinary?.(message);
        }
      });
      sock.on("error", () => {});
    });
    server.on("error", reject);
    const doListen = listen ?? ((srv, cb) => srv.listen(0, host, cb));
    try {
      doListen(server, () => {
        const { port } = server.address();
        resolve({
          url: `ws://${host}:${port}/`,
          ack(text) {
            if (socket) sendFrame(socket, 0x1, Buffer.from(text));
          },
          close() {
            return new Promise((done) => {
              socket?.destroy();
              server.close(() => done());
            });
          },
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

function sendFrame(sock, op, payload) {
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x80 | op, len]);
  else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | op;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | op;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  sock.write(Buffer.concat([header, payload]));
}
