const fs = require('fs');
const path = require('path');

const [,, name] = process.argv;

if (!name) {
  console.error('Mohon sertakan nama route, contoh: node create-routes.js User');
  process.exit(1);
}

const fileName = `${name.toLowerCase()}.js`;
const routesDir = path.join(__dirname, 'src', 'routes');

// Template routes dengan contoh implementasi menggunakan controller
const routeContent = `const router = require('express').Router();
const { ${name} } = require('../controllers/${name}Controller');

// Contoh route, misalnya GET /${name.toLowerCase()}
router.get('/', ${name});

module.exports = router;
`;

// Pastikan direktori routes ada
if (!fs.existsSync(routesDir)) {
  fs.mkdirSync(routesDir, { recursive: true });
}

// Buat file route
fs.writeFileSync(path.join(routesDir, fileName), routeContent, 'utf8');

console.log(`Route untuk ${name} berhasil dibuat.`);
console.log(`Silakan implementasikan route ${name} sesuai kebutuhan Anda 🚀.`);