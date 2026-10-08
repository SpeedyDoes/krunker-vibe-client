const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, Menu, dialog, session, shell } = require('electron');

const GAME_URL = 'https://krunker.io/';
const ICON = path.join(__dirname, 'assets', 'icon.png');

// Discord application id for Rich Presence; presence is skipped entirely while empty.
const DISCORD_CLIENT_ID = '';
const PRESENCE_INTERVAL_MS = 15000;
const PRESENCE_IMAGE = 'https://raw.githubusercontent.com/SpeedyDoes/krunker-vibe-client/main/src/assets/icon.png';

// Ad network hosts behind Krunker's AdSense banners, interstitials and rewarded videos.
const AD_HOSTS = ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'googletagservices.com', 'adservice.google.com', 'fundingchoicesmessages.google.com',
  'imasdk.googleapis.com', 'amazon-adsystem.com'];

// Menu declutter and the hidden ad boxes (Krunker's dark frames around the now empty ad slots).
const KRUNKER_CSS = fs.readFileSync(path.join(__dirname, 'krunker.css'), 'utf8');

// Chromium's default pointer lock re-centres the OS cursor; fast mouse movement outruns it
// and produces random camera flicks. Raw input (unadjustedMovement) reads the mouse directly.
const RAW_INPUT = `(() => {
  const requestPointerLock = Element.prototype.requestPointerLock;
  Element.prototype.requestPointerLock = function (options) {
    return requestPointerLock.call(this, { ...options, unadjustedMovement: true }).catch((error) => {
      if (error.name !== 'NotSupportedError') throw error;
      return requestPointerLock.call(this, options);
    });
  };
})();`;

// Page-side read of the current match. Never includes the player's name.
const READ_ACTIVITY = `(() => {
  try {
    const game = window.getGameActivity();
    if (!game) return null;
    const hud = document.getElementById('inGameUI');
    const kills = document.getElementById('killsVal');
    const icon = document.getElementById('menuClassIcn');
    return {
      id: game.id,
      time: game.time,
      class: { name: game.class && game.class.name },
      map: game.map,
      mode: game.mode,
      kills: kills ? Number(kills.textContent) || 0 : 0,
      playing: !!hud && getComputedStyle(hud).display !== 'none',
      classIcon: icon && icon.src ? icon.src.split('?')[0] : null
    };
  } catch (error) {
    return null;
  }
})();`;

// Krunker treats any user agent containing "Electron" as its discontinued official client and
// shows a "discontinued client" popup, so drop the app and Electron tokens (plain Chrome UA).
app.userAgentFallback = app.userAgentFallback.replace(/ \S+\/\S+ (Chrome\/\S+) Electron\/\S+/, ' $1');

// Unlimited FPS
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('disable-gpu-vsync');

// The default menu binds Ctrl+W (close window); players hold Ctrl (crouch) + W (forward).
Menu.setApplicationMenu(null);

let mainWindow = null;

const presence = DISCORD_CLIENT_ID && require('./discord')(DISCORD_CLIENT_ID);
let matchId = null;
let matchStart = 0;
let sentKey = null;
let sentEnd = 0;

function publishPresence(info) {
  if (!info || !info.map || !info.mode) {
    if (sentKey !== null) presence.setActivity(null);
    sentKey = null;
    return;
  }
  if (info.id !== matchId) {
    matchId = info.id;
    matchStart = Date.now();
  }
  const kills = info.kills === 1 ? '1 kill' : `${info.kills} kills`;
  const activity = {
    // Discord rejects text over 128 characters (long custom map names).
    details: `${info.mode} on ${info.map}`.slice(0, 128),
    state: info.playing ? kills : 'In menu',
    timestamps: info.time > 0 ? { end: Math.round(Date.now() + info.time * 1000) } : { start: matchStart },
    assets: { large_image: PRESENCE_IMAGE, large_text: 'Krunker Vibe Client' }
  };
  if (info.classIcon && info.class.name) {
    activity.assets.small_image = info.classIcon;
    activity.assets.small_text = info.class.name.slice(0, 128);
  }
  // The end time is recomputed on every poll; only a real drift counts as a change (rate limit).
  const key = JSON.stringify([info.id, activity.details, activity.state, activity.assets]);
  const end = activity.timestamps.end || 0;
  if (key === sentKey && Math.abs(end - sentEnd) <= 5000) return;
  sentKey = key;
  sentEnd = end;
  presence.setActivity(activity);
}

function updatePresence() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const contents = mainWindow.webContents;
  if (!isKrunker(contents.getURL())) return publishPresence(null);
  contents.executeJavaScript(READ_ACTIVITY).then(publishPresence).catch(() => {});
}

function isKrunker(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && (hostname === 'krunker.io' || hostname.endsWith('.krunker.io'));
  } catch {
    return false;
  }
}

function setupWindow(win) {
  const contents = win.webContents;

  contents.setWindowOpenHandler(({ url, disposition }) => {
    // Scripted popups (payment/auth) need their opener, so they are allowed too.
    if (isKrunker(url) || disposition === 'new-window') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { width: 1280, height: 720, backgroundColor: '#000000' }
      };
    }
    try {
      const { protocol } = new URL(url);
      if (protocol === 'http:' || protocol === 'https:') shell.openExternal(url);
    } catch {
      // Invalid URL: nothing to open.
    }
    return { action: 'deny' };
  });

  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    let action;
    switch (input.key) {
      case 'F5': action = () => contents.reload(); break;
      case 'F6':
        // Evaluated at key-press time: the window is created before mainWindow is assigned.
        if (win === mainWindow) action = () => contents.loadURL(GAME_URL);
        break;
      case 'F11': action = () => win.setFullScreen(!win.isFullScreen()); break;
      case 'F12': action = () => contents.toggleDevTools(); break;
    }
    if (!action) return;
    event.preventDefault();
    if (!input.isAutoRepeat) action();
  });

  contents.on('dom-ready', () => {
    if (!isKrunker(contents.getURL())) return;
    contents.executeJavaScript(RAW_INPUT).catch(() => {});
    contents.insertCSS(KRUNKER_CSS).catch(() => {});
  });

  // Electron silently cancels close/reload when beforeunload objects; let the user decide.
  contents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Leave', 'Stay'],
      defaultId: 0,
      cancelId: 1,
      title: 'Leave page?',
      message: 'Changes you made may not be saved.'
    });
    if (choice === 0) event.preventDefault();
  });
}

app.on('browser-window-created', (_event, win) => setupWindow(win));

app.whenReady().then(() => {
  // The filter keeps game traffic away from the main process; only ad requests reach the listener.
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: AD_HOSTS.map((host) => `*://*.${host}/*`) },
    (_details, callback) => callback({ cancel: true })
  );

  const splash = new BrowserWindow({
    width: 480,
    height: 270,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#111118',
    icon: ICON
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    show: false,
    backgroundColor: '#000000',
    icon: ICON,
    webPreferences: { spellcheck: false }
  });

  // Also called on a failed load so an offline start never leaves the user stuck on the splash.
  const showMain = () => {
    if (mainWindow.isVisible()) return;
    mainWindow.show();
    if (!splash.isDestroyed()) splash.destroy();
  };
  mainWindow.once('ready-to-show', showMain);
  // Main frame only: blocked ad iframes also fail and would drop the splash too early.
  mainWindow.webContents.on('did-fail-load', (_event, _code, _description, _url, isMainFrame) => {
    if (isMainFrame) showMain();
  });
  splash.on('closed', () => {
    if (!mainWindow.isVisible()) app.quit();
  });

  mainWindow.loadURL(GAME_URL);

  if (presence) setInterval(updatePresence, PRESENCE_INTERVAL_MS).unref();
});
