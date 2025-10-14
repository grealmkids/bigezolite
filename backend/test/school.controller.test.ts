import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

// We'll mount the real routes but mock database and auth middleware
import schoolRoutes from '../src/api/v1/school.routes';

// Simple mock auth middleware that sets req.user
jest.mock('../src/middleware/auth.middleware', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { userId: 1 };
    next();
  }
}));

// Mock the DB queries used by the service layer
jest.mock('../src/database/database', () => ({
  query: jest.fn((sql: string, params?: any[]) => {
    if (sql.includes('SELECT * FROM schools WHERE user_id')) {
      return Promise.resolve({ rows: [{ school_id: 10, user_id: 1, school_name: 'Test School', admin_phone: '256771234567', location_district: 'Kampala', student_count_range: '100-200', school_type: 'Primary' }] });
    }
    if (sql.includes('INSERT INTO schools')) {
      return Promise.resolve({ rows: [{ school_id: 11, user_id: params![0], ...params![1] || {} }] });
    }
    if (sql.includes('SELECT * FROM schools WHERE school_id')) {
      return Promise.resolve({ rows: [{ school_id: params![0], user_id: 1, school_name: 'Found', admin_phone: '256771234567', location_district: 'Kampala', student_count_range: '100-200', school_type: 'Primary' }] });
    }
    if (sql.includes('UPDATE schools')) {
      return Promise.resolve({ rows: [{ school_id: params![params!.length - 1], user_id: 1, ...params } ] });
    }
    if (sql.includes('DELETE FROM schools')) {
      return Promise.resolve({ rows: [{ school_id: params![0], user_id: 1 }] });
    }
    return Promise.resolve({ rows: [] });
  })
}));

const app = express();
app.use(bodyParser.json());
app.use('/api/v1/schools', schoolRoutes);

describe('School routes', () => {
  test('GET /api/v1/schools should return list', async () => {
    const res = await request(app).get('/api/v1/schools');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/v1/schools/my-school should return a school', async () => {
    const res = await request(app).get('/api/v1/schools/my-school');
    expect(res.status).toBe(200);
    expect(res.body.school_name).toBe('Test School');
  });

  test('GET /api/v1/schools/:id should return a school when owned', async () => {
    const res = await request(app).get('/api/v1/schools/10');
    expect(res.status).toBe(200);
    expect(res.body.school_id).toBe(10);
  });

  test('PUT /api/v1/schools/:id should update school when owned', async () => {
    const res = await request(app).put('/api/v1/schools/10').send({ school_name: 'Updated' });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/v1/schools/:id should delete school when owned', async () => {
    const res = await request(app).delete('/api/v1/schools/10');
    expect(res.status).toBe(200);
  });
});
