const net = require('net');

const RETRY_MS = 15000;
const MAX_PIPES = 10;
const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

function pipePath(index) {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${index}`;
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  return `${base}/discord-ipc-${index}`;
}

// Minimal Discord IPC client: connects when Discord runs, silently retries when it does not.
module.exports = function createPresence(clientId) {
  let socket = null;
  let ready = false;
  let latest = null;
  let nonce = 0;

  function send(sock, op, data) {
    const body = Buffer.from(JSON.stringify(data));
    const header = Buffer.alloc(8);
    header.writeInt32LE(op, 0);
    header.writeInt32LE(body.length, 4);
    sock.write(Buffer.concat([header, body]));
  }

  function sendActivity() {
    if (!ready) return;
    send(socket, OP.FRAME, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity: latest || undefined },
      nonce: String(++nonce)
    });
  }

  function retryLater() {
    setTimeout(() => connect(0), RETRY_MS).unref();
  }

  function connect(index) {
    if (index >= MAX_PIPES) return retryLater();
    const sock = net.createConnection(pipePath(index));
    let connected = false;
    let buffer = Buffer.alloc(0);

    sock.on('connect', () => {
      connected = true;
      socket = sock;
      send(sock, OP.HANDSHAKE, { v: 1, client_id: clientId });
    });
    sock.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      // A frame may arrive split across chunks or several may arrive together.
      while (buffer.length >= 8) {
        const op = buffer.readInt32LE(0);
        const length = buffer.readInt32LE(4);
        if (length < 0 || length > 1 << 20) return sock.destroy();
        if (buffer.length < 8 + length) return;
        const text = buffer.toString('utf8', 8, 8 + length);
        buffer = buffer.subarray(8 + length);
        let message = null;
        try { message = JSON.parse(text); } catch { /* malformed frame: ignore */ }
        if (op === OP.PING) send(sock, OP.PONG, message);
        else if (op === OP.CLOSE) return sock.destroy();
        else if (op === OP.FRAME && message && message.evt === 'READY') {
          ready = true;
          sendActivity();
        }
      }
    });
    // 'close' always follows 'error', so errors need no handling beyond not being thrown.
    sock.on('error', () => {});
    sock.on('close', () => {
      if (socket === sock) {
        socket = null;
        ready = false;
      }
      if (connected) retryLater();
      else connect(index + 1);
    });
  }

  connect(0);

  return {
    setActivity(activity) {
      latest = activity || null;
      try { sendActivity(); } catch { /* socket went away: the reconnect re-sends */ }
    }
  };
};
