/* tools/qr.mjs: THE QR ENCODER, RE-EXPORTED. The encoder itself moved to engine/qr.mjs at v564,
 * because the desk needs it at runtime to put a QR on the board sheet and two copies of an encoder
 * drift exactly as two pricing engines do. engine/qr.mjs is inlined into the master by
 * tools/engine.mjs --sync and CI holds the two together.
 *
 * THIS FILE STAYS because tools/make_statements.mjs and tools/stmt-send.mjs import from it, and
 * because the import path is the one thing a reader looking for "the QR" will try first. It adds
 * nothing and decides nothing.
 *
 *   import { qrSvg } from './qr.mjs';
 *   qrSvg('https://example.invalid/?u=cx0-aa', { size: 132 })   ->  '<svg ...>...</svg>'
 */
import QR_ENGINE from "../engine/qr.mjs";

export const qrMatrix = QR_ENGINE.qrMatrix;
export const qrSvg = QR_ENGINE.qrSvg;
export const QR_VERSIONS = QR_ENGINE.QR_VERSIONS;
export default QR_ENGINE;
