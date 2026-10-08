// Minimal Chrome DevTools Protocol client over Node's global fetch/WebSocket (dev tooling only).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Waits (retrying) for the page target whose URL starts with urlPrefix, then opens its websocket.
export async function connect(port, { urlPrefix = 'https://krunker.io/', timeout = 30000 } = {}) {
  const deadline = Date.now() + timeout;
  let page;
  while (!page) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      page = targets.find((t) => t.type === 'page' && t.url.startsWith(urlPrefix));
    } catch { /* debugger port not up yet */ }
    if (!page) {
      if (Date.now() > deadline) throw new Error(`no page matching ${urlPrefix} on port ${port}`);
      await sleep(500);
    }
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('websocket error')), { once: true });
  });
  let id = 0;
  const pending = new Map();
  const handlers = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const h of handlers) h(msg.method, msg.params, msg.sessionId);
    }
  });
  // send(method, params, sessionId?) resolves with the result, rejects on a protocol error.
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  // on(handler(method, params, sessionId)) receives every protocol event.
  const on = (handler) => { handlers.push(handler); };
  // Returns the value; on a page exception returns its description string (never throws for those).
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, userGesture: true, returnByValue: true });
    if (r.exceptionDetails) return `EXCEPTION: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`;
    return r.result.value;
  };
  const close = () => ws.close();
  return { send, evaluate, on, close, url: page.url };
}

// Waits until the Krunker menu scripts have run (getGameActivity exists) so DOM tools see a settled page.
export async function waitReady(client, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await client.evaluate(`typeof getGameActivity === 'function' && !!document.getElementById('menuItemContainer')`) === true) return true;
    await sleep(500);
  }
  return false;
}

// Flattened auto-attach: also instruments out-of-process iframes and workers.
// onAttach(sessionId, targetInfo) is called for each; extra methods are sent to it, then it is resumed.
export function autoAttach(client, onAttach, extra = []) {
  client.on((method, params) => {
    if (method !== 'Target.attachedToTarget') return;
    const s = params.sessionId;
    onAttach(s, params.targetInfo);
    client.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, s).catch(() => {});
    for (const m of extra) client.send(m, {}, s).catch(() => {});
    client.send('Runtime.runIfWaitingForDebugger', {}, s).catch(() => {});
  });
  return client.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
}
