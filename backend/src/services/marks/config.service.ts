import { pool } from '../../database/database';
import { GradingScale, SchoolSetting, HolisticMetric } from '../../types/marks.types';

export class ConfigService {
  async createGradingScale(scale: Omit<GradingScale, 'scale_id'>): Promise<GradingScale> {
    const query = `
      INSERT INTO config_grading_scales (school_id, grade_letter, descriptor, min_score_percent)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [scale.school_id, scale.grade_letter, scale.descriptor || null, scale.min_score_percent];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getGradingScalesBySchool(school_id: number): Promise<GradingScale[]> {
    const query = 'SELECT * FROM config_grading_scales WHERE school_id = $1 ORDER BY min_score_percent DESC';
    const result = await pool.query(query, [school_id]);
    return result.rows;
  }

  async deleteGradingScale(scale_id: number): Promise<void> {
    await pool.query('DELETE FROM config_grading_scales WHERE scale_id = $1', [scale_id]);
  }

  async createOrUpdateSchoolSetting(setting: Omit<SchoolSetting, 'setting_id' | 'created_at'>): Promise<SchoolSetting> {
    const query = `
      INSERT INTO config_school_settings (school_id, curriculum_type, grading_scale_ref)
      VALUES ($1, $2, $3)
      ON CONFLICT (school_id)
      DO UPDATE SET curriculum_type = $2, grading_scale_ref = $3
      RETURNING *
    `;
    
    const values = [setting.school_id, setting.curriculum_type, setting.grading_scale_ref || null];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getSchoolSetting(school_id: number): Promise<SchoolSetting | null> {
    const result = await pool.query('SELECT * FROM config_school_settings WHERE school_id = $1', [school_id]);
    return result.rows[0] || null;
  }

  async createHolisticMetric(metric: Omit<HolisticMetric, 'metric_id'>): Promise<HolisticMetric> {
    const query = `
      INSERT INTO config_holistic_metrics (school_id, metric_type, metric_name)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [metric.school_id, metric.metric_type, metric.metric_name];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getHolisticMetricsBySchool(school_id: number): Promise<HolisticMetric[]> {
    const query = 'SELECT * FROM config_holistic_metrics WHERE school_id = $1 ORDER BY metric_type, metric_name';
    const result = await pool.query(query, [school_id]);
    return result.rows;
  }

  async deleteHolisticMetric(metric_id: number): Promise<void> {
    await pool.query('DELETE FROM config_holistic_metrics WHERE metric_id = $1', [metric_id]);
  }

  async bulkCreateGradingScales(school_id: number, scales: Omit<GradingScale, 'scale_id' | 'school_id'>[]): Promise<GradingScale[]> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const results: GradingScale[] = [];

      for (const scale of scales) {
        const query = `
          INSERT INTO config_grading_scales (school_id, grade_letter, descriptor, min_score_percent)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        
        const result = await client.query(query, [school_id, scale.grade_letter, scale.descriptor || null, scale.min_score_percent]);
        results.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export default new ConfigService();
