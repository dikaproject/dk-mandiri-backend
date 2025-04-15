// Fungsi untuk generate slug dari nama
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '') // Hapus karakter selain huruf, angka, dan spasi
    .replace(/\s+/g, '-')       // Ganti spasi dengan tanda minus
    .replace(/-+/g, '-')        // Hindari multiple tanda minus
    .replace(/^-|-$/g, '');     // Hapus tanda minus di awal dan akhir
};

module.exports = {
  generateSlug
};