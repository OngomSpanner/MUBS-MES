import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function query({ query, values = [] }: { query: string; values?: any[] }) {
  try {
    // Map undefined values to null to avoid mysql2 error
    const processedValues = values.map(v => v === undefined ? null : v);
    const [results] = await pool.execute(query, processedValues);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export default pool;