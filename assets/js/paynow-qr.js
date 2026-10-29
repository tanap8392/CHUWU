/* CHUWU (初·五) — builds a PayNow QR code for one order, with the amount and the order number
   (as the payment reference) already filled in, so the customer only has to scan and confirm.

   The QR content follows the SGQR / EMVCo merchant-presented format that Singapore banking apps
   read: a list of ID–length–value fields ending in a CRC-16 checksum. Drawing the QR image itself
   is done by the bundled qrcode-generator library (assets/js/vendor/qrcode.js, MIT licence). */
(function (root) {
  // One ID–length–value field, e.g. tlv('53', '702') -> '5303702'.
  function tlv(id, value) {
    return id + String(value.length).padStart(2, '0') + value;
  }

  // CRC-16/CCITT-FALSE (poly 0x1021, initial 0xFFFF), as SGQR requires.
  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // A Singapore mobile number (8 digits starting 8 or 9, optionally with +65) is a mobile proxy;
  // anything else is treated as a UEN. Returns null if nothing usable was entered.
  function proxyFor(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    const local = digits.length === 10 && digits.startsWith('65') ? digits.slice(2) : digits;
    if (/^[89]\d{7}$/.test(local)) return { type: '0', value: '+65' + local };
    return { type: '2', value: raw.replace(/\s/g, '').toUpperCase() };
  }

  // Only letters, digits and a few symbols are safe in the merchant name field.
  function cleanName(name) {
    return (String(name || '').replace(/[^A-Za-z0-9 .&-]/g, '').trim() || 'NA').slice(0, 25);
  }

  function payload({ proxy, amount, reference, name }) {
    const p = proxyFor(proxy);
    if (!p) return null;
    const merchant = tlv('00', 'SG.PAYNOW') + tlv('01', p.type) + tlv('02', p.value) + tlv('03', '0'); // 03=0: amount can't be edited
    const body =
      tlv('00', '01') +
      tlv('01', '12') +                       // 12 = dynamic (single-use) QR
      tlv('26', merchant) +
      tlv('52', '0000') +
      tlv('53', '702') +                      // SGD
      tlv('54', Number(amount).toFixed(2)) +
      tlv('58', 'SG') +
      tlv('59', cleanName(name)) +
      tlv('60', 'Singapore') +
      tlv('62', tlv('01', String(reference).slice(0, 25))) +
      '6304';
    return body + crc16(body);
  }

  // Draws the QR onto a canvas and returns a PNG data URL (PNG so it can be saved to the phone's
  // photos and opened from a banking app's "scan from gallery" option).
  function toPngDataUrl(text, size) {
    const qr = root.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const modules = qr.getModuleCount();
    const quiet = 4;
    const scale = Math.max(4, Math.floor((size || 320) / (modules + quiet * 2)));
    const px = (modules + quiet * 2) * scale;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#000';
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
    return canvas.toDataURL('image/png');
  }

  root.ChuwuPayNow = { payload, toPngDataUrl, proxyFor, crc16 };
})(typeof window !== 'undefined' ? window : globalThis);
