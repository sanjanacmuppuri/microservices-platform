const app = require('./app');
const { initDB } = require('./db');

initDB()
  .then(() => {
    app.listen(3000, () => console.log('Auth service running on port 3000'));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
