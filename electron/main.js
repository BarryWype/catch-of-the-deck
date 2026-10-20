import { app, BrowserWindow, ipcMain, session, systemPreferences } from 'electron';
import { cpSync, existsSync, writeFileSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The game was called Slay the Fish, and its data folder was named after it. Before the window
 * opens any storage, the old folder is copied into the new one, once (a marker file remembers it, so
 * resetting progression can't bring the old data back): the game files, settings and the page's
 * localStorage (renamed by src/ui/renameStorage.ts).
 */
const oldDataFolder = path.join(app.getPath('appData'), 'Slay the Fish');
const copiedMarker = path.join(app.getPath('userData'), 'copied-from-slay-the-fish');
if (existsSync(oldDataFolder) && !existsSync(copiedMarker)) {
  cpSync(oldDataFolder, app.getPath('userData'), { recursive: true });
  writeFileSync(copiedMarker, '');
}

/**
 * The game's data files, in the app's data folder (e.g. ~/Library/Application Support/Catch of the Deck
 * on macOS): `save` is the run in progress, `profile` what lasts between runs (the home aquarium).
 * Only these names are accepted, so the page can't touch any other file.
 */
const DATA_FILES = new Set(['save', 'profile']);
function dataPath(name) {
  if (!DATA_FILES.has(name)) throw new Error(`Unknown data file "${name}"`);
  return path.join(app.getPath('userData'), `${name}.json`);
}

ipcMain.handle('data:read', async (_event, name) => {
  try {
    return await readFile(dataPath(name), 'utf8');
  } catch {
    return null;
  }
});
// Write to a temporary file, then rename it over the real one: a crash mid-write can't corrupt it.
ipcMain.handle('data:write', async (_event, name, json) => {
  const tmp = `${dataPath(name)}.tmp`;
  await writeFile(tmp, json, 'utf8');
  await rename(tmp, dataPath(name));
});
ipcMain.handle('data:delete', (_event, name) => rm(dataPath(name), { force: true }));
ipcMain.handle('app:quit', () => app.quit());

/**
 * Window options (fullscreen) live in settings.json, written only from here and kept apart
 * from the game's data files, so resetting progression doesn't touch them.
 */
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
async function readSettings() {
  try {
    return JSON.parse(await readFile(settingsPath(), 'utf8'));
  } catch {
    return {};
  }
}
const writeSettings = (settings) => writeFile(settingsPath(), JSON.stringify(settings), 'utf8');

ipcMain.handle('window:isFullScreen', (event) => BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false);
ipcMain.handle('window:setFullScreen', (event, on) => BrowserWindow.fromWebContents(event.sender)?.setFullScreen(!!on));

async function createWindow() {
  const settings = await readSettings();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    // Only ever pass `true`: on macOS, `fullscreen: false` disables fullscreen for the window.
    ...(settings.fullscreen ? { fullscreen: true } : {}),
    autoHideMenuBar: true,
    title: 'Catch of the Deck',
    webPreferences: { preload: path.join(dirname, 'preload.cjs') },
  });
  // Remembered however fullscreen was toggled: the options, the OS button or a shortcut.
  const remember = (fullscreen) => writeSettings({ ...settings, fullscreen }).catch(() => {});
  win.on('enter-full-screen', () => remember(true));
  win.on('leave-full-screen', () => remember(false));
  // `npm run electron:dev` points this at the Vite dev server; otherwise load the build.
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(dirname, '../dist/index.html'));
}

/**
 * The page may only use the camera (to scan a transfer QR) and write to the clipboard (to copy a
 * transfer code): every other permission, and the microphone, is refused. On macOS the system
 * asks the player for the camera once (NSCameraUsageDescription).
 */
function allowCameraOnly() {
  const isCamera = (permission, details) => permission === 'media' && !(details?.mediaTypes ?? []).includes('audio');
  session.defaultSession.setPermissionRequestHandler(async (_contents, permission, callback, details) => {
    if (permission === 'clipboard-sanitized-write') return callback(true);
    if (!isCamera(permission, details)) return callback(false);
    callback(process.platform !== 'darwin' || (await systemPreferences.askForMediaAccess('camera')));
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission, _origin, details) => permission === 'media' && details?.mediaType !== 'audio');
}

app.whenReady().then(() => {
  allowCameraOnly();
  return createWindow();
});
app.on('window-all-closed', () => app.quit());
