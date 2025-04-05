const fs = require('fs');
const path = require('path');

const [,, name] = process.argv;

if (!name) {
  console.error('Mohon sertakan nama controller, contoh: node create-controller.js User');
  process.exit(1);
}

const controllerFileName = `${name}Controller.js`;
const routeFileName = `${name.toLowerCase()}.js`;

const controllersDir = path.join(__dirname, 'src', 'controllers');
const routesDir = path.join(__dirname, 'src', 'routes');

// Konten template untuk controller dengan implementasi contoh
const controllerContent = `const prisma = require('../config/database');

const ${name} = async (req, res) => {
  try {
    // Contoh implementasi: mengembalikan pesan sukses
    res.status(200).json({ message: '${name} controller berfungsi dengan baik' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { ${name} };
`;

// Konten template untuk routes
const routeContent = `const router = require('express').Router();
const { ${name} } = require('../controllers/${name}Controller');

// Contoh route, misalnya GET /${name.toLowerCase()}
router.get('/', ${name});

module.exports = router;
`;

// Pastikan direktori controllers dan routes ada
if (!fs.existsSync(controllersDir)) {
  fs.mkdirSync(controllersDir, { recursive: true });
}
if (!fs.existsSync(routesDir)) {
  fs.mkdirSync(routesDir, { recursive: true });
}

// Buat file controller dan route
fs.writeFileSync(path.join(controllersDir, controllerFileName), controllerContent, 'utf8');
fs.writeFileSync(path.join(routesDir, routeFileName), routeContent, 'utf8');

console.log(`Controller dan route untuk ${name} berhasil dibuat.`);
console.log(`Silakan implementasikan controller ${name} sesuai kebutuhan Anda 🚀.`);