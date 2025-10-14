
import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool(config.database);

// A small helper to create a short preview of the SQL for logs
const sqlPreview = (text: string, max = 120) => (text.length > max ? `${text.slice(0, max)}...` : text);

export const query = async (text: string, params?: any[]) => {
	const preview = sqlPreview(text);
	try {
		console.debug('[db] executing query:', preview, params ? `params(${params.length})` : 'no-params');
		const res = await pool.query(text, params);
		console.debug('[db] query success:', preview, `rows=${res.rowCount}`);
		return res;
	} catch (err: any) {
		// Avoid logging raw parameter values to reduce risk of leaking sensitive info
		console.error('[db] query error:', preview, `params(${params?.length ?? 0})`, err?.message || err);
		// Re-throw so callers can handle the error as before
		throw err;
	}
};

// Export pool for cases where a raw Pool is needed elsewhere
export { pool };
