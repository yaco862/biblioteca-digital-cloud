//versión 2.1 - Entornos múltiples configurados
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const multer = require('multer');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

console.log(`🌍 Entorno detectado: ${ENVIRONMENT}`);
console.log(`📋 Tabla que se usará: ${config.tableName}`);

// Configurar PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? {
        rejectUnauthorized: false
    } : false
});

// Verificar conexión e inicializar base de datos automáticamente
async function initializeDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Conectando a PostgreSQL...');
        console.log(`📋 Tabla del entorno: ${config.tableName}`);
        
        // Crear tabla específica del entorno
        await client.query(`
            CREATE TABLE IF NOT EXISTS ${config.tableName} (
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
        
        console.log(`✅ Tabla "${config.tableName}" verificada/creada`);
        
        // Verificar si hay datos
        const result = await client.query(`SELECT COUNT(*) FROM ${config.tableName}`);
        const count = parseInt(result.rows[0].count);
        
        if (count === 0) {
            console.log('📚 Base de datos vacía, insertando libros de ejemplo...');
            
            await client.query(`
                INSERT INTO ${config.tableName} (titulo, autor, año, genero, isbn, disponible) VALUES
                ('Cien años de soledad', 'Gabriel García Márquez', 1967, 'Ficción', '978-0307474728', true),
                ('Don Quijote de la Mancha', 'Miguel de Cervantes', 1605, 'Clásico', '978-8424936464', true),
                ('1984', 'George Orwell', 1949, 'Ciencia Ficción', '978-0451524935', false),
                ('El Principito', 'Antoine de Saint-Exupéry', 1943, 'Infantil', '978-0156012195', true)
            `);
            
            console.log('✅ Libros de ejemplo insertados correctamente');
        } else {
            console.log(`ℹ️  Base de datos contiene ${count} libro(s)`);
        }
        
        console.log('✅ Base de datos inicializada exitosamente');
        
    } catch (error) {
        console.error('❌ Error al inicializar base de datos:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Ejecutar inicialización al arrancar
initializeDatabase().catch(err => {
    console.error('💥 Error fatal en inicialización:', err);
    process.exit(1);
});

// Configurar Multer
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: Información del entorno
app.get('/api/environment', (req, res) => {
    res.json({
        success: true,
        data: {
            environment: config.environment,
            name: config.name,
            badge_color: config.badge_color,
            badge_text: config.badge_text,
            features: config.features,
            table: config.tableName,
            version: '2.0',
            timestamp: new Date().toISOString()
        }
    });
});

// API: Obtener todos los libros
app.get('/api/libros', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM ${config.tableName} ORDER BY id ASC`
        );
        
        const disponibles = result.rows.filter(l => l.disponible).length;
        
        res.json({
            success: true,
            total: result.rows.length,
            disponibles: disponibles,
            data: result.rows
        });
    } catch (error) {
        console.error('Error al obtener libros:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener libros'
        });
    }
});

// API: Obtener un libro por ID
app.get('/api/libros/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM ${config.tableName} WHERE id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Libro no encontrado'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error al obtener libro:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener libro'
        });
    }
});

// API: Agregar un nuevo libro
app.post('/api/libros', async (req, res) => {
    try {
        const { titulo, autor, año, genero, isbn } = req.body;
        
        if (!titulo || !autor || !año || !genero) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos'
            });
        }
        
        const result = await pool.query(
            `INSERT INTO ${config.tableName} (titulo, autor, año, genero, isbn, disponible) 
             VALUES ($1, $2, $3, $4, $5, true) 
             RETURNING *`,
            [titulo, autor, parseInt(año), genero, isbn || null]
        );
        
        res.status(201).json({
            success: true,
            message: 'Libro agregado exitosamente',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error al agregar libro:', error);
        res.status(500).json({
            success: false,
            error: 'Error al agregar libro'
        });
    }
});

// API: Actualizar disponibilidad
app.put('/api/libros/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { disponible } = req.body;
        
        const result = await pool.query(
            `UPDATE ${config.tableName} 
             SET disponible = $1, fecha_actualizacion = CURRENT_TIMESTAMP 
             WHERE id = $2 
             RETURNING *`,
            [disponible, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Libro no encontrado'
            });
        }
        
        res.json({
            success: true,
            message: 'Estado actualizado correctamente',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error al actualizar libro:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar libro'
        });
    }
});

// API: Eliminar un libro
app.delete('/api/libros/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `DELETE FROM ${config.tableName} WHERE id = $1 RETURNING *`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Libro no encontrado'
            });
        }
        
        res.json({
            success: true,
            message: 'Libro eliminado correctamente',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error al eliminar libro:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar libro'
        });
    }
});

// API: Estadísticas
app.get('/api/estadisticas', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE disponible = true) as disponibles,
                COUNT(*) FILTER (WHERE disponible = false) as prestados
            FROM ${config.tableName}
        `);
        
        const stats = result.rows[0];
        const total = parseInt(stats.total);
        const disponibles = parseInt(stats.disponibles);
        const prestados = parseInt(stats.prestados);
        
        res.json({
            success: true,
            data: {
                total: total,
                disponibles: disponibles,
                prestados: prestados,
                porcentajeDisponible: total > 0 
                    ? ((disponibles / total) * 100).toFixed(1) 
                    : 0
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas'
        });
    }
});

// API: Buscar libros
app.get('/api/buscar', async (req, res) => {
    try {
        const termino = req.query.q || '';
        
        if (!termino) {
            const result = await pool.query(`SELECT * FROM ${config.tableName} ORDER BY id ASC`);
            return res.json({
                success: true,
                data: result.rows
            });
        }
        
        const result = await pool.query(
            `SELECT * FROM ${config.tableName} 
             WHERE LOWER(titulo) LIKE LOWER($1) 
                OR LOWER(autor) LIKE LOWER($1) 
                OR LOWER(genero) LIKE LOWER($1)
             ORDER BY id ASC`,
            [`%${termino}%`]
        );
        
        res.json({
            success: true,
            total: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Error al buscar libros:', error);
        res.status(500).json({
            success: false,
            error: 'Error al buscar libros'
        });
    }
});

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
    });
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Error interno del servidor'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🚀 SERVIDOR DE BIBLIOTECA DIGITAL v2.0`);
    console.log('========================================');
    console.log(`🌍 Entorno: ${config.name.toUpperCase()}`);
    console.log(`🏷️  Badge: ${config.badge_text}`);
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`💾 Base de Datos: PostgreSQL (${ENVIRONMENT})`);
    console.log(`📋 Tabla: ${config.tableName}`);
    console.log('========================================');
    console.log('✨ FEATURES HABILITADAS:');
    console.log(`   - Debug: ${config.features.debug ? '✅' : '❌'}`);
    console.log(`   - Analytics: ${config.features.analytics ? '✅' : '❌'}`);
    console.log(`   - Notificaciones: ${config.features.email_notifications ? '✅' : '❌'}`);
    console.log(`   - Auto-backup: ${config.features.auto_backup ? '✅' : '❌'}`);
    console.log('========================================');
});

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
    console.log('⚠️  SIGTERM recibido, cerrando servidor...');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\n⚠️  SIGINT recibido, cerrando servidor...');
    await pool.end();
    process.exit(0);
});
