const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let overlayWindow;
let configWindow;
let tray = null;
let isQuitting = false;
let isResizing = false;

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const SERVER_CONFIG_PATH = path.join(__dirname, '..', 'server', 'config.json');
const OVERLAY_CONFIG_PATH = path.join(__dirname, '..', 'server', 'overlay-config.json');

let appConfig = {
    steamId: "",
    opacity: 100,
    windowX: 100,
    windowY: 100,
    scale: 1.0,
    alwaysOnTop: true,
    serverPort: 3000,
    showMainMapStats: false,
    autoFollowStage: true,
    horizontalLayout: false,
    theme: {
        accentColor: "#7c5cbf",
        textColor: "#4a3f6b",
        bgColor: "#ffffff",
        borderColor: "#d5cee6"
    }
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH);
            appConfig = { ...appConfig, ...JSON.parse(data) };
        }
        
        if (fs.existsSync(SERVER_CONFIG_PATH)) {
            const serverData = JSON.parse(fs.readFileSync(SERVER_CONFIG_PATH));
            if (serverData.port) {
                appConfig.serverPort = serverData.port;
            }
        }
    } catch (e) {
        console.error("Failed to load config", e);
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(appConfig, null, 2));
        
        try {
            let serverConfig = {};
            if (fs.existsSync(SERVER_CONFIG_PATH)) {
                serverConfig = JSON.parse(fs.readFileSync(SERVER_CONFIG_PATH));
            }
            if (serverConfig.port !== appConfig.serverPort) {
                serverConfig.port = appConfig.serverPort;
                fs.writeFileSync(SERVER_CONFIG_PATH, JSON.stringify(serverConfig, null, 2));
            }
        } catch (serverErr) {
            console.error("Failed to update server config", serverErr);
        }

        try {
            const overlayConfig = {
                steamId: appConfig.steamId,
                refreshRate: appConfig.refreshRate || 60,
                showMainMapStats: appConfig.showMainMapStats || false,
                autoFollowStage: appConfig.autoFollowStage !== false,
                horizontalLayout: appConfig.horizontalLayout || false,
                theme: appConfig.theme || {}
            };
            fs.writeFileSync(OVERLAY_CONFIG_PATH, JSON.stringify(overlayConfig, null, 2));
        } catch (overlayErr) {
            console.error("Failed to write overlay config", overlayErr);
        }

        if (overlayWindow) overlayWindow.webContents.send('config-updated', appConfig);
        if (configWindow) configWindow.webContents.send('config-updated', appConfig);
    } catch (e) {
        console.error("Failed to save config", e);
    }
}

function createOverlayWindow() {
    if (overlayWindow) {
        if (overlayWindow.isMinimized()) overlayWindow.restore();
        overlayWindow.focus();
        return;
    }

    overlayWindow = new BrowserWindow({
        width: 400,
        height: 450,
        x: appConfig.windowX,
        y: appConfig.windowY,
        frame: false,
        transparent: true,
        resizable: true, 
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // 'screen-saver' level stays above borderless windowed games
    if (appConfig.alwaysOnTop) {
        overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    overlayWindow.setOpacity((appConfig.opacity || 100) / 100);
    overlayWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

    overlayWindow.on('blur', () => {
        if (appConfig.alwaysOnTop && overlayWindow) {
            overlayWindow.setAlwaysOnTop(true, 'screen-saver');
        }
    });

    overlayWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            overlayWindow.hide();
        }
    });

    overlayWindow.on('closed', () => {
        overlayWindow = null;
    });

    overlayWindow.on('moved', () => {
        if (isResizing) return;
        const [x, y] = overlayWindow.getPosition();
        appConfig.windowX = x;
        appConfig.windowY = y;
        saveConfig();
    });
}

function createConfigWindow() {
    if (configWindow) {
        if (configWindow.isMinimized()) configWindow.restore();
        configWindow.focus();
        return;
    }

    configWindow = new BrowserWindow({
        width: 800,
        height: 740,
        minWidth: 800,
        minHeight: 740,
        maxWidth: 800,
        maxHeight: 740,
        title: "KSF Overlay Configuration",
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    configWindow.loadFile(path.join(__dirname, 'public', 'config.html'));

    configWindow.on('closed', () => {
        configWindow = null;
    });
}

function createTray() {
    tray = new Tray(nativeImage.createEmpty()); 
    tray.setToolTip('KSF Overlay');
    
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open Overlay', click: () => overlayWindow ? overlayWindow.show() : createOverlayWindow() },
        { label: 'Settings', click: () => createConfigWindow() },
        { type: 'separator' },
        { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
    ]);
    
    tray.setContextMenu(contextMenu);
}

ipcMain.on('save-config', (event, newConfig) => {
    appConfig = { ...appConfig, ...newConfig };
    
    if (overlayWindow) {
        overlayWindow.setAlwaysOnTop(appConfig.alwaysOnTop, appConfig.alwaysOnTop ? 'screen-saver' : 'normal');
        overlayWindow.setOpacity((appConfig.opacity || 100) / 100);
    }
    
    saveConfig();
});

ipcMain.on('get-config', (event) => {
    event.reply('config-updated', appConfig);
});

ipcMain.on('set-port', (event, value) => {
    const newPort = parseInt(value);
    if (!isNaN(newPort) && newPort !== appConfig.serverPort) {
        appConfig.serverPort = newPort;
        saveConfig();
    }
});

ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});

ipcMain.on('resize-overlay', (event, { width, height }) => {
    if (overlayWindow) {
        const [currentWidth, currentHeight] = overlayWindow.getSize();
        const newWidth = width ? Math.max(380, Math.min(width, 1200)) : currentWidth;
        const newHeight = Math.max(300, Math.min(height, 900));
        if (Math.abs(currentWidth - newWidth) > 2 || Math.abs(currentHeight - newHeight) > 2) {
            isResizing = true;
            overlayWindow.setSize(newWidth, newHeight);
            setTimeout(() => { isResizing = false; }, 100);
        }
    }
});

app.whenReady().then(() => {
    loadConfig();
    createOverlayWindow();
    createConfigWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createOverlayWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
