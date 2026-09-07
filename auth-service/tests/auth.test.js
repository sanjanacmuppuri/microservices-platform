const request = require('supertest');
const app = require('../app');

describe('Auth Service', () => {
  it('should return ok on health check', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('should reject registration with missing fields', async () => {
    const res = await request(app).post('/register').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Email and password required');
  });

  it('should reject login with missing fields', async () => {
    const res = await request(app).post('/login').send({});
    expect(res.statusCode).toBe(500);
  });
});
