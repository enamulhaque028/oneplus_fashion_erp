/* SHA-256 (hex) in plain JavaScript. crypto.subtle is not used because it is not
   reliably available to pages opened from file:// on older browsers. */
(function (OPF) {
  "use strict";

  const rotr = (v, n) => (v >>> n) | (v << (32 - n));

  // Round constants: fractional parts of square / cube roots of the first primes.
  const H0 = [], K = [];
  for (let c = 2, n = 0; n < 64; c++) {
    let prime = true;
    for (let j = 2; j * j <= c; j++) if (c % j == 0) { prime = false; break; }
    if (!prime) continue;
    if (n < 8) H0[n] = (Math.pow(c, 1 / 2) * 4294967296) | 0;
    K[n++] = (Math.pow(c, 1 / 3) * 4294967296) | 0;
  }

  OPF.sha256 = function sha256(text) {
    let s = unescape(encodeURIComponent(text)); // UTF-8 bytes as a binary string
    const bitLength = s.length * 8;
    const w = [];
    s += "\x80";
    while (s.length % 64 - 56) s += "\x00";
    for (let i = 0; i < s.length; i++) w[i >> 2] |= s.charCodeAt(i) << ((3 - i) % 4) * 8;
    w[w.length] = (bitLength / 4294967296) | 0;
    w[w.length] = bitLength;

    let H = H0.slice();
    for (let j = 0; j < w.length;) {
      const W = w.slice(j, (j += 16));
      const old = H;
      H = H.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = W[i - 15], w2 = W[i - 2], a = H[0], e = H[4];
        if (i >= 16) W[i] = (W[i - 16] + (rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3)) + W[i - 7] + (rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10))) | 0;
        const t1 = H[7] + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & H[5]) ^ (~e & H[6])) + K[i] + W[i];
        const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & H[1]) ^ (a & H[2]) ^ (H[1] & H[2]));
        H = [(t1 + t2) | 0].concat(H);
        H[4] = (H[4] + t1) | 0;
      }
      for (let i = 0; i < 8; i++) H[i] = (H[i] + old[i]) | 0;
    }

    let hex = "";
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j >= 0; j--) hex += ((H[i] >> (j * 8)) & 255).toString(16).padStart(2, "0");
    }
    return hex;
  };
})(window.OPF = window.OPF || {});
