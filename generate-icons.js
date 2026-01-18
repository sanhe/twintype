// Run with: node generate-icons.js
// This creates simple placeholder PNG icons for the extension

const fs = require('fs');
const path = require('path');

// Simple PNG generator for solid color icons with a lightning bolt
function createIcon(size) {
  // Create a canvas-like buffer for the icon
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#8a63ff');
  gradient.addColorStop(0.5, '#6366f1');
  gradient.addColorStop(1, '#4f8cff');

  // Rounded rectangle
  const radius = size * 0.2;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Lightning bolt
  ctx.fillStyle = 'white';
  const cx = size / 2;
  const cy = size / 2;
  const s = size * 0.35;

  ctx.beginPath();
  ctx.moveTo(cx + s * 0.1, cy - s);
  ctx.lineTo(cx - s * 0.4, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.05, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.15, cy + s);
  ctx.lineTo(cx + s * 0.4, cy - s * 0.1);
  ctx.lineTo(cx + s * 0.05, cy - s * 0.1);
  ctx.closePath();
  ctx.fill();

  return canvas.toBuffer('image/png');
}

// Check if canvas is available
try {
  require('canvas');

  const iconsDir = path.join(__dirname, 'icons');

  [16, 48, 128].forEach(size => {
    const buffer = createIcon(size);
    fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buffer);
    console.log(`Created icon${size}.png`);
  });

  console.log('Icons generated successfully!');
} catch (e) {
  console.log('Canvas module not installed. Using alternative method...');
  console.log('Please open icons/generate-icons.html in a browser to generate icons.');
}
