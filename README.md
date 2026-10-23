# Panel Proyección 2026 — App de escritorio (Windows)

Tu panel HTML empaquetado como aplicación instalable de Windows con **Electron**.
No necesita internet: Chart.js, XLSX y la fuente Inter van incluidos dentro de la app.

## Instalar

1. Entra en la carpeta `dist\`.
2. Ejecuta **`Panel-Proyeccion-2026-Setup-0.1.0.exe`**.
3. Elige la carpeta de instalación (o deja la predeterminada).
4. Al terminar tendrás:
   - Acceso directo en el **Escritorio** y en el **menú Inicio**.
   - La app se abre en su propia ventana (sin barra de navegador).
   - Aparece en **Configuración → Aplicaciones** para desinstalarla normalmente.

> El instalador **no está firmado digitalmente** (eso requiere un certificado de pago),
> así que Windows SmartScreen puede mostrar "Windows protegió tu PC".
> Pulsa **Más información → Ejecutar de todas formas**. Solo ocurre la primera vez.

## Tus datos

Los datos que ya guardabas en `localStorage` se guardan ahora en:

```
%APPDATA%\Panel Proyección 2026\
```

Se conservan al actualizar y **también al desinstalar** (no se borran). Para respaldarlos
o pasarlos a otro equipo, copia esa carpeta completa.

## Cómo actualizar la app cuando cambies el HTML

Edita tu archivo original `Panel proyecion  2026 V 0.01.html` y luego, en esta carpeta:

```powershell
npm run sync    # copia el HTML a app\index.html y cambia los CDN por las librerías locales
npm run dist    # regenera el instalador en dist\
```

También puedes probar los cambios sin instalar:

```powershell
npm run start
```

## Versión portable (sin instalar)

Genera un único `.exe` que se ejecuta directamente (ideal para USB):

```powershell
npm run dist:portable
```

## Estructura

```
PanelProyeccionApp\
├─ main.js                  Proceso principal de Electron (ventana, menús, descargas)
├─ package.json             Configuración del proyecto y del instalador (NSIS)
├─ app\
│  ├─ index.html            TU panel (copia con librerías locales)
│  └─ vendor\               Chart.js, XLSX, plugins y fuente Inter
├─ build\icon.ico           Icono de la app (generado con scripts\make-icon.mjs)
├─ scripts\
│  ├─ sync-html.mjs         Sincroniza tu HTML original hacia app\
│  ├─ fetch-vendors.mjs     Vuelve a descargar las librerías
│  └─ make-icon.mjs         Regenera el icono
└─ dist\                    Instalador generado
```

## Detalles incluidos

- Ventana 1440×900 redimensionable, mínimo 960×600, tema oscuro (sin destello blanco).
- Menú oculto (se muestra con `Alt`) con Imprimir/PDF, zoom, recarga y pantalla completa.
- `Ctrl+P` → imprimir o guardar como PDF.
- Las exportaciones (Excel/JSON) abren un diálogo para elegir dónde guardar
  y ofrecen "Abrir carpeta" al terminar.
- Los enlaces externos se abren en tu navegador, no dentro de la app.
- Instancia única: al abrirla de nuevo se enfoca la ventana existente.
- Content-Security-Policy activa y `sandbox`/`contextIsolation` para aislar la página.
