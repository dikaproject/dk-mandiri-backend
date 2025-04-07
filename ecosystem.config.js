module.exports = {
    apps: [{
      name: 'dkmandiri-backend',
      script: 'index.js', // Sesuaikan dengan entry point Express app Anda
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      max_memory_restart: '300M'
    }]
  }