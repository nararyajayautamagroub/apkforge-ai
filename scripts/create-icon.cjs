const fs = require("node:fs");
const path = require("node:path");

const size = 256;
const scale = size / 64;
const bytesPerPixel = 4;
const xorSize = size * size * bytesPerPixel;
const maskRowBytes = Math.ceil(size / 32) * 4;
const maskSize = maskRowBytes * size;
const dibSize = 40;
const pixelOffset = 22 + dibSize;
const iconSize = dibSize + xorSize + maskSize;
const icon = Buffer.alloc(pixelOffset + xorSize + maskSize);

icon.writeUInt16LE(0, 0);
icon.writeUInt16LE(1, 2);
icon.writeUInt16LE(1, 4);
// ICO width/height bytes of zero encode 256 pixels.
icon.writeUInt8(0, 6);
icon.writeUInt8(0, 7);
icon.writeUInt8(0, 8);
icon.writeUInt8(0, 9);
icon.writeUInt16LE(1, 10);
icon.writeUInt16LE(32, 12);
icon.writeUInt32LE(iconSize, 14);
icon.writeUInt32LE(22, 18);
icon.writeUInt32LE(dibSize, 22);
icon.writeInt32LE(size, 26);
icon.writeInt32LE(size * 2, 30);
icon.writeUInt16LE(1, 34);
icon.writeUInt16LE(32, 36);
icon.writeUInt32LE(0, 38);
icon.writeUInt32LE(xorSize, 42);
icon.writeInt32LE(0, 46);
icon.writeInt32LE(0, 50);
icon.writeUInt32LE(0, 54);
icon.writeUInt32LE(0, 58);

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const inside = x >= 7 * scale && x < 57 * scale && y >= 7 * scale && y < 57 * scale;
    let r = 11, g = 16, b = 32, a = 255;
    if (inside) { r = 255; g = 77; b = 109; }
    const left = Math.abs(y - (size - 10 * scale - x * 1.1)) < 3 * scale && x > 10 * scale && x < 32 * scale && y > 12 * scale;
    const right = Math.abs(y - (x * 1.1 - 10 * scale)) < 3 * scale && x > 31 * scale && x < 54 * scale && y > 12 * scale;
    const crossbar = y >= 36 * scale && y <= 40 * scale && x >= 20 * scale && x <= 44 * scale;
    if (left || right || crossbar) { r = 255; g = 255; b = 255; }
    const row = size - 1 - y;
    const offset = pixelOffset + (row * size + x) * bytesPerPixel;
    icon[offset] = b;
    icon[offset + 1] = g;
    icon[offset + 2] = r;
    icon[offset + 3] = a;
  }
}
const output = path.join(process.cwd(), "build", "icon.ico");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, icon);
console.log("Generated 256x256 Windows icon:", output);
