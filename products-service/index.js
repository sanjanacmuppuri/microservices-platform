const app = require('./app');
const { initDB } = require('./db');

initDB()
  .then(() => {
    app.listen(3001, () => console.log('Products service running on port 3001'));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

