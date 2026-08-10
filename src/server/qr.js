// QR as inline SVG, generated server-side. No client library, no CDN, no build
// step on the page — the host screen receives finished markup.
//
// This uses a dependency rather than a hand-rolled encoder, deliberately. A QR
// code is Reed-Solomon error correction plus masking, and a subtly wrong
// implementation produces a code that looks perfectly plausible and does not
// scan. There is no decoder here to verify against, so an unverifiable
// hand-rolled version would be worse engineering than a battle-tested library.

import QRCode from "qrcode-svg";

export function qrSvg(url, { size = 380, dark = "#1F2B5B", light = "none" } = {}) {
  const svg = new QRCode({
    content: url,
    width: size,
    height: size,
    color: dark,
    background: light,
    ecl: "M",
    padding: 0,
    join: true,
    container: "svg-viewbox",
  }).svg();

  // Strip the XML declaration so it can be inlined directly into the page.
  return svg.replace(/<\?xml[^>]*\?>/, "").trim();
}

export function joinUrl(publicUrl, roomCode) {
  const base = (publicUrl || "").replace(/\/+$/, "");
  return `${base}/?room=${encodeURIComponent(roomCode)}`;
}
