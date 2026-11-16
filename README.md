# Countdown Auto-Click

Extensión para navegadores que pulsa un botón cuando su cuenta regresiva llega a
cero y el botón pasa de bloqueado a disponible. Muestra en pantalla qué contador y
qué botón detectó, y luego el mensaje de respuesta de la página.

No envía datos, no pide cuentas y no hace peticiones de red: todo ocurre en la
pestaña. No adelanta la apertura; el sitio decide cuándo habilita el botón.

## Descargar sin compilar

En [Releases](https://github.com/fer-prieto/countdown-autoclick/releases) están los
paquetes listos:

- **Chromium**: `countdown-autoclick-chromium-<versión>.zip` → descomprimir y cargar
  la carpeta como extensión descomprimida.
- **Firefox**: `countdown-autoclick-firefox-<versión>.zip` → complemento **temporal**
  (se borra al cerrar). Para instalación permanente hay que firmarlo en
  addons.mozilla.org (canal *unlisted*) y usar el `.xpi` firmado.

## Compilar

Sin dependencias, solo Node 18 o superior:

```bash
node scripts/build.mjs          # Chromium + Firefox + userscript
node scripts/build.mjs chromium
node scripts/build.mjs firefox
node --test tests/              # pruebas del lector de cuentas regresivas
```

Resultado:

```
dist/chromium/    extensión sin empaquetar
dist/firefox/     extensión sin empaquetar
dist/userscript/  countdown-autoclick.user.js
dist/zips/        countdown-autoclick-<navegador>-<versión>.zip
```

## Chromium (Chrome, Edge, Brave, Opera, Vivaldi)

1. Abre `chrome://extensions` y activa **Modo de desarrollador**.
2. **Cargar descomprimida** → elige `dist/chromium`.
3. Entra a una página con cuenta regresiva y botón bloqueado.

## Firefox

1. Abre `about:debugging#/runtime/this-firefox`.
2. **Cargar complemento temporal** → elige `dist/firefox/manifest.json`.
3. Para instalación permanente, firma el zip en addons.mozilla.org (canal *unlisted*).

Los complementos temporales de Firefox desaparecen al cerrar el navegador.
También puedes usar el userscript con Tampermonkey o Greasemonkey.

## Cómo detecta

- **Cuenta regresiva**: `role="timer"`, etiquetas accesibles, o textos como
  `días/horas/minutos/segundos`, `days/hours/minutes/seconds` y `00:01:23:59`.
- **Botón**: el botón visible con verbo de acción (registrar, reservar, confirmar,
  enviar, comprar…) más cercano al contador. Se muestra su texto exacto en la tarjeta.
- **Seguridad**: solo pulsa si vio el botón bloqueado o el contador en cero, nunca en
  una página cualquiera con un botón suelto.
- **Respuesta**: lee el diálogo, la alerta o el texto nuevo que aparezca después del clic.

La tarjeta se contrae al pulsar el encabezado. Para detenerla:
`__autoClick.stop()` en la consola.

## Licencia

GPL-3.0-only. Ver [LICENSE](LICENSE).
