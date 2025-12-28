require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const ENVIRONMENT = process.env.NODE_ENV || 'production';
const TABLE_PREFIX = ENVIRONMENT === 'production' ? 'prod' : ENVIRONMENT;
const TABLE_NAME = `${TABLE_PREFIX}_libros`;

async function initDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('========================================');
        console.log(`🔄 Inicializando base de datos`);
        console.log(`🌍 Entorno: ${ENVIRONMENT.toUpperCase()}`);
        console.log(`📊 Tabla: ${TABLE_NAME}`);
        console.log('========================================');
        
        // Crear tabla específica del entorno
        await client.query(`
            CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                autor VARCHAR(255) NOT NULL,
                año INTEGER NOT NULL,
                genero VARCHAR(100) NOT NULL,
                isbn VARCHAR(20),
                imagen_url TEXT,
                disponible BOOLEAN DEFAULT true,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log(`✅ Tabla "${TABLE_NAME}" creada correctamente`);
        
        // Verificar si ya hay datos
        const result = await client.query(`SELECT COUNT(*) FROM ${TABLE_NAME}`);
        const count = parseInt(result.rows[0].count);
        
        if (count === 0) {
            console.log('📚 Insertando libros de ejemplo...');
            
            // Insertar libros de ejemplo
            await client.query(`
                INSERT INTO ${TABLE_NAME} (titulo, autor, año, genero, isbn, disponible) VALUES
                ('Cien años de soledad', 'Gabriel García Márquez', 1967, 'Ficción', '978-0307474728', true),
                ('Don Quijote de la Mancha', 'Miguel de Cervantes', 1605, 'Clásico', '978-8424936464', true),
                ('1984', 'George Orwell', 1949, 'Ciencia Ficción', '978-0451524935', false),
                ('El Principito', 'Antoine de Saint-Exupéry', 1943, 'Infantil', '978-0156012195', true)
            `);
            
            console.log('✅ Libros de ejemplo insertados');
        } else {
            console.log(`ℹ️  La tabla ya contiene ${count} libro(s)`);
        }
        
        // Mostrar libros actuales
        const libros = await client.query(`SELECT * FROM ${TABLE_NAME} ORDER BY id`);
        console.log(`\n📖 Libros en ${TABLE_NAME}:`);
        console.table(libros.rows);
        
        // Mostrar resumen de todas las tablas
        console.log('\n📊 Resumen de todas las tablas:');
        const allTables = await client.query(`
            SELECT 
                tablename,
                (SELECT COUNT(*) FROM information_schema.columns 
                 WHERE table_name = tablename) as columns
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename LIKE '%_libros'
            ORDER BY tablename
        `);
        
        if (allTables.rows.length > 0) {
            console.table(allTables.rows);
        } else {
            console.log('No se encontraron otras tablas de libros');
        }
        
        console.log('\n✅ Base de datos inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error al inicializar la base de datos:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

initDatabase()
    .then(() => {
        console.log('🎉 Proceso completado exitosamente');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Error fatal:', error);
        process.exit(1);
    });
