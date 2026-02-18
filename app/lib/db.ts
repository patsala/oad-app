import { neon } from '@neondatabase/serverless';

export async function query(text: string, params?: any[]) {
  const sql = neon(process.env.DATABASE_URL!);
  return await sql(text, params);
}