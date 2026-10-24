const fs = require("node:fs");
const path = require("node:path");

const size = 64;
const bytesPerPixel = 4;
const xorSize = size * size * bytesPerPixel;
const maskRowBytes = Math.ceil(size / 32) * 4;
const maskSize = maskRowBytes * size;
const dibSize = 40;
const pixelOffset = 22 + dibSize;
const iconSize = dibSize + xorSize + maskSize;
const icon = Buffer.alloc(pixelOffset + xorSize + maskSize);

// ICO header and one 64x64, 32-bit image entry.
icon.writeUInt16LE(0, 0);
icon.writeUInt16LE(1, 2);
icon.writeUInt16LE(1, 4);
icon.writeUInt8(size, 6);
icon.writeUInt8(size, 7);
icon.writeUInt8(0, 8);
icon.writeUInt8(0, 9);
icon.writeUInt16LE(1, 10);
icon.writeUInt16LE(32, 12);
icon.writeUInt32LE(iconSize, 14);
icon.writeUInt32LE(pixelOffset, 18);

// DIB stores the XOR bitmap bottom-up, followed by the AND mask.
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
    const inside = x >= 7 && x < 57 && y >= 7 && y < 57;
    let r = 11, g = 16, b = 32, a = 255;
    if (inside) { r = 255; g = 77; b = 109; }
    // A simple white angular A mark, drawn without external graphics dependencies.
    const left = Math.abs(y - (size - 10 - x * 1.1)) < 3 && x > 10 && x < 32 && y > 12;
    const right = Math.abs(y - (x * 1.1 - 10)) < 3 && x > 31 && x < 54 && y > 12;
    const crossbar = y >= 36 && y <= 40 && x >= 20 && x <= 44;
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
console.log("Generated Windows icon:", output);
