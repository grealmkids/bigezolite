
import { query } from '../../database/database';
import bcrypt from 'bcrypt';

export const createUser = async (email: string, password: string, fullName: string, phoneNumber: string) => {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const sql = 'INSERT INTO users (email, password_hash, full_name, phone_number) VALUES ($1, $2, $3, $4) RETURNING *';
  const params = [email, passwordHash, fullName, phoneNumber];

  const result = await query(sql, params);
  return result.rows[0];
};

export const findUserByEmail = async (email: string) => {
  const sql = 'SELECT * FROM users WHERE email = $1';
  const params = [email];

  const result = await query(sql, params);
  return result.rows[0];
};

export const findUserByPhone = async (phoneNumber: string) => {
  const sql = 'SELECT * FROM users WHERE phone_number = $1';
  const params = [phoneNumber];

  const result = await query(sql, params);
  return result.rows[0];
};
