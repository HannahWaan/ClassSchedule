const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..');
const dest = path.join(__dirname, 'app');

// Clean old app folder
if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
fs.mkdirSync(dest, { recursive: true });

// Copy files
const filesToCopy = ['index.html', 'style.css', 'favicon.svg'];
const dirsToCopy = ['css', 'js'];

filesToCopy.forEach(f => {
  const s = path.join(src, f);
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(dest, f));
});

dirsToCopy.forEach(d => {
  const s = path.join(src, d);
  if (fs.existsSync(s)) copyDir(s, path.join(dest, d));
});

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(item => {
    const sf = path.join(from, item);
    const tf = path.join(to, item);
    if (fs.statSync(sf).isDirectory()) copyDir(sf, tf);
    else fs.copyFileSync(sf, tf);
  });
}

console.log('Copied app files to electron/app/');
