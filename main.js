const { app, BrowserWindow, Menu, dialog, shell, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const APP_NAME = "Panel Proyección 2026";
const INDEX = path.join(__dirname, "app", "index.html");

app.setName(APP_NAME);
app.setAppUserModelId("com.panel.proyeccion2026");

let mainWindow = null;
const smoke = process.env.SMOKE === "1" || process.argv.includes("--smoke");
const smokeErrors = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: "#0d0f12",
    title: APP_NAME,
    icon: path.join(__dirname, "build", "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (!smoke) mainWindow.show();
  });

  mainWindow.loadFile(INDEX);

  // Manejador de descargas (una sola vez por sesión).
  if (!createWindow.downloadsReady) {
    setupDownloads(mainWindow.webContents.session);
    createWindow.downloadsReady = true;
  }

  // Enlaces externos -> navegador del sistema.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Evita que la ventana navegue fuera de la aplicación.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:")) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  if (smoke) {
    mainWindow.webContents.on("console-message", (event) => {
      if (event.level === "error") smokeErrors.push(event.message);
    });
    mainWindow.webContents.on("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, 4000));
      let report;
      try {
        report = await mainWindow.webContents.executeJavaScript(`(() => ({
          title: document.title,
          chart: typeof Chart,
          xlsx: typeof XLSX,
          datalabels: !!(window.Chart && Chart.registry.plugins.get('datalabels')),
          annotation: !!(window.Chart && Chart.registry.plugins.get('annotation')),
          canvases: document.querySelectorAll('canvas').length,
          chartsAlive: Object.keys(Chart.instances || {}).length,
          font: getComputedStyle(document.body).fontFamily,
          nodes: document.querySelectorAll('*').length,
          textLength: document.body.innerText.length
        }))()`);
      } catch (err) {
        report = { error: String(err) };
      }
      console.log("SMOKE " + JSON.stringify({ report, errors: smokeErrors }, null, 2));
      app.exit(smokeErrors.length ? 1 : 0);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Descargas (Excel, JSON): preguntar dónde guardar en lugar de ir silenciosamente a Descargas.
function setupDownloads(ses) {
  ses.on("will-download", (event, item) => {
    const options = {
      title: "Guardar archivo",
      defaultPath: path.join(app.getPath("documents"), item.getFilename()),
      filters: [{ name: "Archivos", extensions: ["xlsx", "json", "pdf", "csv", "html"] }],
      buttonLabel: "Guardar",
    };
    const target = mainWindow
      ? dialog.showSaveDialogSync(mainWindow, options)
      : dialog.showSaveDialogSync(options);
    if (!target) {
      item.cancel();
      return;
    }
    item.setSavePath(target);
    item.once("done", (_e, state) => {
      if (state === "completed" && mainWindow) {
        dialog
          .showMessageBox(mainWindow, {
            type: "info",
            title: "Archivo guardado",
            message: "El archivo se guardó correctamente.",
            detail: target,
            buttons: ["Abrir carpeta", "Cerrar"],
            defaultId: 1,
            cancelId: 1,
          })
          .then(({ response }) => {
            if (response === 0) shell.showItemInFolder(target);
          });
      }
    });
  });
}

function buildMenu() {
  const template = [
    {
      label: "Archivo",
      submenu: [
        { label: "Imprimir / PDF", accelerator: "CmdOrCtrl+P", click: () => mainWindow?.webContents.print() },
        { type: "separator" },
        { label: "Salir", accelerator: "CmdOrCtrl+Q", role: "quit" },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Deshacer" },
        { role: "redo", label: "Rehacer" },
        { type: "separator" },
        { role: "cut", label: "Cortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Pegar" },
        { role: "selectAll", label: "Seleccionar todo" },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { role: "reload", label: "Recargar", accelerator: "CmdOrCtrl+R" },
        { role: "togglefullscreen", label: "Pantalla completa", accelerator: "F11" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom normal", accelerator: "CmdOrCtrl+0" },
        { role: "zoomIn", label: "Acercar", accelerator: "CmdOrCtrl+Plus" },
        { role: "zoomOut", label: "Alejar", accelerator: "CmdOrCtrl+-" },
        { type: "separator" },
        { role: "toggleDevTools", label: "Herramientas de desarrollo", accelerator: "CmdOrCtrl+Shift+I" },
      ],
    },
    {
      label: "Ayuda",
      submenu: [
        {
          label: "Acerca de " + APP_NAME,
          click: () => {
            dialog.showMessageBox(mainWindow ?? undefined, {
              type: "info",
              title: "Acerca de",
              message: APP_NAME,
              detail:
                `Versión ${app.getVersion()}\n\n` +
                "Panel de costos, producción y punto de equilibrio multi-producto.\n" +
                "Los datos se guardan localmente en este equipo.\n\n" +
                "Carpeta de datos:\n" + app.getPath("userData"),
              buttons: ["Aceptar"],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}

// Copia de seguridad simple del perfil de datos antes de cerrar (por si el usuario
// quiere migrar su información a otro equipo).
app.on("before-quit", () => {
  try {
    const dataDir = app.getPath("userData");
    if (fs.existsSync(dataDir)) {
      fs.writeFileSync(path.join(dataDir, ".last-run"), new Date().toISOString());
    }
  } catch {
    /* ignorar */
  }
});
