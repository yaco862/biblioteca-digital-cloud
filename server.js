require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar PostgreSQL (SSL activado siempre)
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

// Configurar Multer para subida de archivos (en memoria)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
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
        const result = await pool.query('SELECT * FROM libros ORDER BY id ASC');
        const disponibles = result.rows.filter(l => l.disponible).length;
        res.json({
            success: true,
            total: result.rows.length,
            disponibles,
            data: result.rows
        });
    } catch (error) {
        console.error('Error al obtener libros:', error);
        res.status(500).json({ success: false, error: 'Error al obtener libros' });
    }
});

// API: Obtener un libro por ID
app.get('/api/libros/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM libros WHERE id = $1', [req.params.id]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Libro no encontrado' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error al obtener libro:', error);
        res.status(500).json({ success: false, error: 'Error al obtener libro' });
    }
});

// API: Agregar un nuevo libro
app.post('/api/libros', async (req, res) => {
    try {
        const { titulo, autor, año, genero, isbn } = req.body;
        if (!titulo || !autor || !año || !genero) {
            return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
        }
        const result = await pool.query(
            `INSERT INTO libros (titulo, autor, año, genero, isbn, disponible) 
             VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
            [titulo, autor, parseInt(año), genero, isbn || null]
        );
        res.status(201).json({ success: true, message: 'Libro agregado exitosamente', data: result.rows[0] });
    } catch (error) {
        console.error('Error al agregar libro:', error);
        res.status(500).json({ success: false, error: 'Error al agregar libro' });
    }
});

// API: Actualizar disponibilidad
app.put('/api/libros/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE libros SET disponible = $1, fecha_actualizacion = NOW() 
             WHERE id = $2 RETURNING *`,
            [req.body.disponible, req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Libro no encontrado' });
        }
        res.json({ success: true, message: 'Estado actualizado correctamente', data: result.rows[0] });
    } catch (error) {
        console.error('Error al actualizar libro:', error);
        res.status(500).json({ success: false, error: 'Error al actualizar libro' });
    }
});

// API: Eliminar libro
app.delete('/api/libros/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM libros WHERE id = $1 RETURNING *', [req.params.id]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Libro no encontrado' });
        }
        res.json({ success: true, message: 'Libro eliminado correctamente', data: result.rows[0] });
    } catch (error) {
        console.error('Error al eliminar libro:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar libro' });
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
            FROM libros
        `);
        const { total, disponibles, prestados } = result.rows[0];
        res.json({
            success: true,
            data: {
                total: +total,
                disponibles: +disponibles,
                prestados: +prestados,
                porcentajeDisponible: total > 0 ? ((disponibles / total) * 100).toFixed(1) : 0
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
    }
});

// API: Buscar libros
app.get('/api/buscar', async (req, res) => {
    try {
        const termino = req.query.q || '';
        const result = termino
            ? await pool.query(
                `SELECT * FROM libros WHERE LOWER(titulo) LIKE LOWER($1) 
                 OR LOWER(autor) LIKE LOWER($1) OR LOWER(genero) LIKE LOWER($1)`,
                [`%${termino}%`]
              )
            : await pool.query('SELECT * FROM libros ORDER BY id ASC');
        res.json({ success: true, total: result.rows.length, data: result.rows });
    } catch (error) {
        console.error('Error al buscar libros:', error);
        res.status(500).json({ success: false, error: 'Error al buscar libros' });
    }
});

// API: Subir imagen de portada (simulado)
app.post('/api/libros/:id/imagen', upload.single('imagen'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No se envió ninguna imagen' });
        const imagenUrl = `https://via.placeholder.com/300x450.png?text=${encodeURIComponent(req.body.titulo || 'Libro')}`;
        const result = await pool.query(
            `UPDATE libros SET imagen_url = $1, fecha_actualizacion = NOW() WHERE id = $2 RETURNING *`,
            [imagenUrl, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, error: 'Libro no encontrado' });
        res.json({ success: true, message: 'Imagen subida correctamente', data: result.rows[0] });
    } catch (error) {
        console.error('Error al subir imagen:', error);
        res.status(500).json({ success: false, error: 'Error al subir imagen' });
    }
});

// 404 Handler
app.use((req, res) => res.status(404).json({ success: false, error: 'Ruta no encontrada' }));

// Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 SERVIDOR DE BIBLIOTECA DIGITAL v2.0');
    console.log('========================================');
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log('========================================');
});

// Cierre graceful
process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
process.on('SIGINT', async () => { await pool.end(); process.exit(0); });

