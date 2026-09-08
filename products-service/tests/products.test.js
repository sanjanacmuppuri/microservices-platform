const request = require('supertest');
const app = require('../app');

describe('Products Service', () => {
  it('should return ok on health check', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('should reject product creation with missing fields', async () => {
    const res = await request(app).post('/products').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Name and price are required');
  });
});
