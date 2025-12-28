require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function resetDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🗑️  Eliminando tabla libros...');
        await client.query('DROP TABLE IF EXISTS libros');
        console.log('✅ Tabla eliminada');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

resetDatabase();
