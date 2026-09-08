const app = require('./app');
const { initDB } = require('./db');

initDB()
  .then(() => {
    app.listen(3002, () => console.log('Orders service running on port 3002'));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
