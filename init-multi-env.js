require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const entornos = ['dev', 'staging', 'prod'];

async function initMultipleEnvironments() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Iniciando configuración multi-entorno...\n');
        
        for (const env of entornos) {
            const tableName = `libros_${env}`;
            
            console.log(`📋 Configurando entorno: ${env.toUpperCase()}`);
            console.log(`   Tabla: ${tableName}`);
            
            // Crear tabla
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${tableName} (
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
            
            console.log(`   ✅ Tabla creada/verificada`);
            
            // Verificar datos
            const result = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
            const count = parseInt(result.rows[0].count);
            
            if (count === 0) {
                console.log(`   📚 Insertando datos de ejemplo...`);
                
                await client.query(`
                    INSERT INTO ${tableName} (titulo, autor, año, genero, isbn, disponible) VALUES
                    ('Cien años de soledad', 'Gabriel García Márquez', 1967, 'Ficción', '978-0307474728', true),
                    ('Don Quijote de la Mancha', 'Miguel de Cervantes', 1605, 'Clásico', '978-8424936464', true),
                    ('1984', 'George Orwell', 1949, 'Ciencia Ficción', '978-0451524935', ${env === 'prod'}),
                    ('El Principito', 'Antoine de Saint-Exupéry', 1943, 'Infantil', '978-0156012195', true)
                `);
                
                console.log(`   ✅ ${4} libros insertados\n`);
            } else {
                console.log(`   ℹ️  Ya contiene ${count} libro(s)\n`);
            }
        }
        
        // Mostrar resumen
        console.log('═══════════════════════════════════════');
        console.log('📊 RESUMEN DE ENTORNOS');
        console.log('═══════════════════════════════════════\n');
        
        for (const env of entornos) {
            const tableName = `libros_${env}`;
            const result = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
            const count = result.rows[0].count;
            
            console.log(`${env.toUpperCase().padEnd(10)} → ${count} libros en tabla "${tableName}"`);
        }
        
        console.log('\n═══════════════════════════════════════');
        console.log('✅ Configuración multi-entorno completada');
        console.log('═══════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

initMultipleEnvironments()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('💥 Error fatal:', error);
        process.exit(1);
    });
