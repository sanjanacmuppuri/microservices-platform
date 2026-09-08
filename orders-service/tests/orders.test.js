const request = require('supertest');
const app = require('../app');

describe('Orders Service', () => {
  it('should return ok on health check', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('should reject order creation with missing fields', async () => {
    const res = await request(app).post('/orders').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('product_id and quantity are required');
  });

  it('should reject status update with missing status', async () => {
    const res = await request(app).put('/orders/1/status').send({});
    expect(res.statusCode).toBe(400);
  });
});
