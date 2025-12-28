require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de entorno
const ENVIRONMENT = process.env.NODE_ENV || 'production';
const TABLE_PREFIX = ENVIRONMENT === 'production' ? 'prod' : ENVIRONMENT;
const TABLE_NAME = `${TABLE_PREFIX}_libros`;

console.log(`🌍 Entorno: ${ENVIRONMENT}`);
console.log(`📊 Usando tabla: ${TABLE_NAME}`);

// Configurar PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
// Verificar conexión a la base de datos
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error al conectar con PostgreSQL:', err.stack);
    } else {
        console.log('✅ Conectado a PostgreSQL exitosamente');
        release();
    }
});

// Configurar Multer para subida de archivos (simulado - en memoria)
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

// API: Obtener todos los libros
app.get('/api/libros', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM ${TABLE_NAME} ORDER BY id ASC`
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
            `SELECT * FROM ${TABLE_NAME} WHERE id = $1`,
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
            `INSERT INTO ${TABLE_NAME} (titulo, autor, año, genero, isbn, disponible) 
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

// API: Actualizar disponibilidad de un libro
app.put('/api/libros/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { disponible } = req.body;
        
        const result = await pool.query(
            `UPDATE ${TABLE_NAME} 
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
            `DELETE FROM ${TABLE_NAME} WHERE id = $1 RETURNING *`,
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

// API: Obtener estadísticas
app.get('/api/estadisticas', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE disponible = true) as disponibles,
                COUNT(*) FILTER (WHERE disponible = false) as prestados
            FROM ${TABLE_NAME}
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
            const result = await pool.query(`SELECT * FROM ${TABLE_NAME} ORDER BY id ASC`);
            return res.json({
                success: true,
                data: result.rows
            });
        }
        
        const result = await pool.query(
            `SELECT * FROM ${TABLE_NAME} 
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

// API: Subir imagen de portada (simulado)
app.post('/api/libros/:id/imagen', upload.single('imagen'), async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se envió ninguna imagen'
            });
        }
        
        const imagenUrl = `https://via.placeholder.com/300x450.png?text=${encodeURIComponent(req.body.titulo || 'Libro')}`;
        
        const result = await pool.query(
            `UPDATE ${TABLE_NAME} 
             SET imagen_url = $1, fecha_actualizacion = CURRENT_TIMESTAMP 
             WHERE id = $2 
             RETURNING *`,
            [imagenUrl, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Libro no encontrado'
            });
        }
        
        res.json({
            success: true,
            message: 'Imagen subida correctamente',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error al subir imagen:', error);
        res.status(500).json({
            success: false,
            error: 'Error al subir imagen'
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

// Determinar entorno y colores
const ENV_COLORS = {
    'development': '🟢 DEV',
    'staging': '🟡 STAGING',
    'production': '🔴 PROD'
};

// Iniciar servidor
app.listen(PORT, () => {
    console.log('========================================');
    console.log(`${ENV_COLORS[ENVIRONMENT] || '⚪'} BIBLIOTECA DIGITAL v2.1`);
    console.log('========================================');
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🌍 Entorno: ${ENVIRONMENT.toUpperCase()}`);
    console.log(`📊 Tabla: ${TABLE_NAME}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`💾 Base de Datos: PostgreSQL (compartida)`);
    console.log(`📚 API Libros: http://localhost:${PORT}/api/libros`);
    console.log(`📊 API Stats: http://localhost:${PORT}/api/estadisticas`);
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
