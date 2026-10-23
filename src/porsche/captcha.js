// -----------------------------------------------------------------------------
// The captcha of the Porsche sign-in, as a picture the dashboard can show.
//
// Auth0 gives an SVG (a data URI); a widget image must be PNG, JPEG or WebP.
// resvg (WebAssembly, no native binary: the same image on amd64 and arm64)
// draws it twice as large, on white, as the Home Assistant integration shows
// it. The module is loaded on the first captcha only.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const WIDTH = 300;
let ready = null;

/**
 * @description The SVG source of a data URI (base64 or URL-encoded).
 * @param {string} dataUri - The data URI.
 * @returns {string|null} The SVG, or null when it is not one.
 * @example
 * svgOf('data:image/svg+xml;base64,PHN2Zy8+'); // -> '<svg/>'
 */
function svgOf(dataUri) {
  const match = /^data:image\/svg\+xml(;[^,]*)?,(.*)$/s.exec(String(dataUri ?? ''));
  if (!match) {
    return null;
  }
  const isBase64 = /;base64/i.test(match[1] ?? '');
  try {
    return isBase64
      ? Buffer.from(match[2], 'base64').toString('utf8')
      : decodeURIComponent(match[2]);
  } catch {
    return null;
  }
}

/**
 * @description The image key of a captcha: it changes with the picture (the
 * dashboard caches an image an hour by key).
 * @param {string} dataUri - The captcha.
 * @returns {string} The key.
 */
function captchaKey(dataUri) {
  return `captcha-${createHash('sha256').update(String(dataUri)).digest('hex').slice(0, 16)}`;
}

/**
 * @description Load resvg once.
 * @returns {Promise<Function>} The Resvg class.
 */
async function loadResvg() {
  if (!ready) {
    ready = (async () => {
      const { initWasm, Resvg } = await import('@resvg/resvg-wasm');
      const require = createRequire(import.meta.url);
      await initWasm(await readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
      return Resvg;
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

/**
 * @description The captcha as a PNG, base64 (no data URI prefix), for
 * `onWidgetGetImage`. A PNG or JPEG data URI is passed through.
 * @param {string} dataUri - The captcha.
 * @returns {Promise<string>} The base64 PNG.
 * @throws {Error} When the picture cannot be read.
 */
async function captchaPng(dataUri) {
  const raster = /^data:image\/(png|jpeg|webp);base64,(.+)$/s.exec(String(dataUri ?? ''));
  if (raster) {
    return raster[2];
  }
  const svg = svgOf(dataUri);
  if (!svg) {
    throw new Error('Unknown captcha format');
  }
  const Resvg = await loadResvg();
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    background: 'white',
  })
    .render()
    .asPng();
  return Buffer.from(png).toString('base64');
}

export { svgOf, captchaKey, captchaPng };
