const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();

// ===================== CONFIGURACIÓN POSTGRESQL =====================
// Logs de debugging para identificar problemas
console.log("🔧 Configuración de base de datos:");
console.log("NODE_ENV:", process.env.NODE_ENV || 'no definido');
console.log("DATABASE_URL definida:", !!process.env.DATABASE_URL);
console.log("PORT:", process.env.PORT || 10000);

// Mostrar DATABASE_URL de forma segura (sin exponer credenciales completas)
if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL;
    const urlSegura = url.substring(0, 20) + "..." + url.substring(url.length - 20);
    console.log("URL base de datos (segura):", urlSegura);
    console.log("Longitud de DATABASE_URL:", url.length);
} else {
    console.error("⚠️ ADVERTENCIA: DATABASE_URL no está definida");
    console.log("Variables de entorno disponibles:", Object.keys(process.env).join(', '));
}

// Configurar PostgreSQL - SSL SIEMPRE ACTIVO para Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ===================== INICIALIZACIÓN DE BASE DE DATOS =====================
async function initializeDatabase() {
    try {
        console.log("🔌 Intentando conectar a PostgreSQL...");
        
        // Verificar si DATABASE_URL existe
        if (!process.env.DATABASE_URL) {
            console.error("❌ ERROR CRÍTICO: DATABASE_URL no está definida");
            console.error("Por favor, configura la variable DATABASE_URL en Render");
            console.error("Ve a: Dashboard → Tu Servicio → Environment → Add Environment Variable");
            console.error("Variables actuales:", process.env);
            process.exit(1);
        }
        
        // Probar conexión
        const client = await pool.connect();
        console.log("✅ Conexión exitosa a PostgreSQL");
        
        // Detectar entorno
        const env = process.env.NODE_ENV || 'development';
        console.log(`🌍 Entorno: ${env}`);
        
        // Seleccionar tabla según entorno
        let tableName;
        switch(env) {
            case 'production':
                tableName = 'prod_libros';
                break;
            case 'staging':
                tableName = 'staging_libros';
                break;
            default:
                tableName = 'dev_libros';
        }
        
        console.log(`📊 Usando tabla: ${tableName}`);
        
        // Crear tabla si no existe
        await client.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(100) NOT NULL,
                autor VARCHAR(100) NOT NULL,
                anio INTEGER,
                genero VARCHAR(50),
                disponible BOOLEAN DEFAULT TRUE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log(`✅ Tabla ${tableName} verificada/creada`);
        
        // Insertar datos iniciales solo si la tabla está vacía
        const result = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
        const count = parseInt(result.rows[0].count);
        
        if (count === 0) {
            const initialBooks = [
                ['Cien años de soledad', 'Gabriel García Márquez', 1967, 'Realismo mágico'],
                ['1984', 'George Orwell', 1949, 'Ciencia ficción'],
                ['El principito', 'Antoine de Saint-Exupéry', 1943, 'Fábula'],
                ['Don Quijote de la Mancha', 'Miguel de Cervantes', 1605, 'Novela']
            ];
            
            for (const book of initialBooks) {
                await client.query(
                    `INSERT INTO ${tableName} (titulo, autor, anio, genero) VALUES ($1, $2, $3, $4)`,
                    book
                );
            }
            console.log(`📚 4 libros iniciales insertados en ${tableName}`);
        } else {
            console.log(`📚 Tabla ${tableName} ya tiene ${count} libros`);
        }
        
        client.release();
        return tableName;
        
    } catch (error) {
        console.error('💥 Error conectando a la base de datos:');
        console.error('Código:', error.code);
        console.error('Mensaje:', error.message);
        
        // Información adicional útil
        if (error.code === 'ECONNREFUSED') {
            console.error('🔍 DIAGNÓSTICO: No se puede conectar al servidor PostgreSQL');
            console.error('Posibles causas:');
            console.error('1. DATABASE_URL incorrecta o no definida');
            console.error('2. Base de datos no está corriendo');
            console.error('3. Problemas de red/firewall');
            console.error('4. Credenciales incorrectas');
            console.error('5. Necesita SSL pero no está configurado');
        } else if (error.code === '28P01') {
            console.error('🔍 DIAGNÓSTICO: Error de autenticación');
            console.error('La contraseña o usuario en DATABASE_URL son incorrectos');
        } else if (error.code === '3D000') {
            console.error('🔍 DIAGNÓSTICO: Base de datos no existe');
            console.error('La base de datos especificada en DATABASE_URL no existe');
        }
        
        console.error('Stack completo:', error.stack);
        process.exit(1);
    }
}

// Variable global para el nombre de la tabla
let currentTableName;

// ===================== CONFIGURACIÓN EXPRESS =====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ===================== RUTAS =====================
// Ruta principal
app.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM ${currentTableName} ORDER BY id DESC`);
        
        // Determinar badge y título según entorno
        const env = process.env.NODE_ENV || 'development';
        let badge, title, color;
        
        switch(env) {
            case 'production':
                badge = '🔴 PRODUCCIÓN';
                title = 'PROD BIBLIOTECA DIGITAL';
                color = 'red';
                break;
            case 'staging':
                badge = '🟡 STAGING';
                title = 'STAGING BIBLIOTECA DIGITAL';
                color = 'orange';
                break;
            default:
                badge = '🟢 DEVELOPMENT';
                title = 'DEV BIBLIOTECA DIGITAL';
                color = 'green';
        }
        
        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        background: white;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        overflow: hidden;
                    }
                    .header {
                        background: #1a1a2e;
                        color: white;
                        padding: 40px;
                        text-align: center;
                        border-bottom: 5px solid ${color};
                    }
                    .badge {
                        display: inline-block;
                        background: ${color};
                        color: white;
                        padding: 10px 20px;
                        border-radius: 50px;
                        font-weight: bold;
                        font-size: 1.2em;
                        margin-bottom: 20px;
                        animation: pulse 2s infinite;
                    }
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); }
                    }
                    h1 { 
                        font-size: 3em; 
                        margin-bottom: 10px;
                        background: linear-gradient(45deg, ${color}, #667eea);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    }
                    .stats {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        padding: 30px;
                        background: #f8f9fa;
                    }
                    .stat-card {
                        background: white;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                        text-align: center;
                        border-top: 4px solid ${color};
                    }
                    .stat-card h3 {
                        color: ${color};
                        margin-bottom: 10px;
                        font-size: 2.5em;
                    }
                    .books-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                        gap: 25px;
                        padding: 40px;
                    }
                    .book-card {
                        background: white;
                        border-radius: 15px;
                        padding: 25px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        transition: transform 0.3s, box-shadow 0.3s;
                        border-left: 5px solid ${color};
                    }
                    .book-card:hover {
                        transform: translateY(-10px);
                        box-shadow: 0 15px 40px rgba(0,0,0,0.2);
                    }
                    .book-card h3 {
                        color: #1a1a2e;
                        margin-bottom: 10px;
                        font-size: 1.5em;
                    }
                    .book-card p {
                        color: #666;
                        margin: 8px 0;
                    }
                    .available {
                        color: #28a745;
                        font-weight: bold;
                    }
                    .unavailable {
                        color: #dc3545;
                        font-weight: bold;
                    }
                    .form-section {
                        padding: 40px;
                        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                        border-top: 2px solid #dee2e6;
                    }
                    .form-container {
                        max-width: 600px;
                        margin: 0 auto;
                        background: white;
                        padding: 30px;
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    }
                    .form-container h2 {
                        color: ${color};
                        margin-bottom: 25px;
                        text-align: center;
                    }
                    .form-group {
                        margin-bottom: 20px;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 8px;
                        color: #1a1a2e;
                        font-weight: bold;
                    }
                    .form-group input, .form-group select {
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #ddd;
                        border-radius: 8px;
                        font-size: 16px;
                        transition: border-color 0.3s;
                    }
                    .form-group input:focus, .form-group select:focus {
                        outline: none;
                        border-color: ${color};
                    }
                    .btn {
                        background: ${color};
                        color: white;
                        padding: 15px 30px;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: all 0.3s;
                        width: 100%;
                    }
                    .btn:hover {
                        opacity: 0.9;
                        transform: translateY(-2px);
                    }
                    .actions {
                        display: flex;
                        gap: 10px;
                        margin-top: 15px;
                    }
                    .btn-small {
                        padding: 8px 15px;
                        font-size: 14px;
                        border-radius: 5px;
                        text-decoration: none;
                        display: inline-block;
                        text-align: center;
                    }
                    .btn-edit { background: #ffc107; color: #000; }
                    .btn-delete { background: #dc3545; color: white; }
                    .btn-toggle { background: #17a2b8; color: white; }
                    .footer {
                        text-align: center;
                        padding: 20px;
                        background: #1a1a2e;
                        color: white;
                        margin-top: 40px;
                    }
                    .info-box {
                        background: #e8f4fd;
                        border-left: 4px solid #17a2b8;
                        padding: 15px;
                        margin: 20px 40px;
                        border-radius: 0 8px 8px 0;
                    }
                    .env-info {
                        font-size: 0.9em;
                        color: #666;
                        text-align: center;
                        margin-top: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="badge">${badge}</div>
                        <h1>${title} v2.1.1</h1>
                        <p>Gestión completa de biblioteca con PostgreSQL</p>
                    </div>
                    
                    <div class="info-box">
                        <strong>Información del entorno:</strong><br>
                        Entorno: ${env} | Tabla: ${currentTableName} | Libros: ${result.rows.length}
                    </div>
                    
                    <div class="stats">
                        <div class="stat-card">
                            <h3>${result.rows.length}</h3>
                            <p>Libros totales</p>
                        </div>
                        <div class="stat-card">
                            <h3>${result.rows.filter(b => b.disponible).length}</h3>
                            <p>Libros disponibles</p>
                        </div>
                        <div class="stat-card">
                            <h3>${result.rows.filter(b => !b.disponible).length}</h3>
                            <p>Libros prestados</p>
                        </div>
                    </div>
                    
                    <div class="books-grid">
                        ${result.rows.map(book => `
                            <div class="book-card">
                                <h3>${book.titulo}</h3>
                                <p><strong>Autor:</strong> ${book.autor}</p>
                                <p><strong>Año:</strong> ${book.anio || 'N/A'}</p>
                                <p><strong>Género:</strong> ${book.genero || 'No especificado'}</p>
                                <p><strong>Estado:</strong> 
                                    <span class="${book.disponible ? 'available' : 'unavailable'}">
                                        ${book.disponible ? '✅ Disponible' : '❌ Prestado'}
                                    </span>
                                </p>
                                <p><strong>ID:</strong> ${book.id}</p>
                                <div class="actions">
                                    <a href="/toggle/${book.id}" class="btn-small btn-toggle">
                                        ${book.disponible ? 'Prestar' : 'Devolver'}
                                    </a>
                                    <a href="/delete/${book.id}" class="btn-small btn-delete" 
                                       onclick="return confirm('¿Eliminar este libro?')">
                                        Eliminar
                                    </a>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="form-section">
                        <div class="form-container">
                            <h2>📖 Agregar Nuevo Libro</h2>
                            <form action="/add" method="POST">
                                <div class="form-group">
                                    <label for="titulo">Título:</label>
                                    <input type="text" id="titulo" name="titulo" required placeholder="Ej: Cien años de soledad">
                                </div>
                                <div class="form-group">
                                    <label for="autor">Autor:</label>
                                    <input type="text" id="autor" name="autor" required placeholder="Ej: Gabriel García Márquez">
                                </div>
                                <div class="form-group">
                                    <label for="anio">Año de publicación:</label>
                                    <input type="number" id="anio" name="anio" placeholder="Ej: 1967">
                                </div>
                                <div class="form-group">
                                    <label for="genero">Género:</label>
                                    <select id="genero" name="genero">
                                        <option value="">Seleccionar género</option>
                                        <option value="Novela">Novela</option>
                                        <option value="Ciencia ficción">Ciencia ficción</option>
                                        <option value="Fantasía">Fantasía</option>
                                        <option value="Realismo mágico">Realismo mágico</option>
                                        <option value="Ensayo">Ensayo</option>
                                        <option value="Poesía">Poesía</option>
                                        <option value="Teatro">Teatro</option>
                                        <option value="Biografía">Biografía</option>
                                        <option value="Historia">Historia</option>
                                    </select>
                                </div>
                                <button type="submit" class="btn">Agregar Libro</button>
                            </form>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>Sistema de Biblioteca Digital | PostgreSQL + Node.js + Express</p>
                        <p class="env-info">Entorno: ${env} | Tabla: ${currentTableName} | Puerto: ${process.env.PORT || 10000}</p>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error al obtener libros:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Agregar libro
app.post('/add', async (req, res) => {
    try {
        const { titulo, autor, anio, genero } = req.body;
        await pool.query(
            `INSERT INTO ${currentTableName} (titulo, autor, anio, genero) VALUES ($1, $2, $3, $4)`,
            [titulo, autor, anio || null, genero || null]
        );
        res.redirect('/');
    } catch (error) {
        console.error('Error al agregar libro:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Toggle disponibilidad
app.get('/toggle/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT disponible FROM ${currentTableName} WHERE id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).send('Libro no encontrado');
        }
        
        const nuevoEstado = !result.rows[0].disponible;
        await pool.query(
            `UPDATE ${currentTableName} SET disponible = $1 WHERE id = $2`,
            [nuevoEstado, id]
        );
        
        res.redirect('/');
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Eliminar libro
app.get('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM ${currentTableName} WHERE id = $1`, [id]);
        res.redirect('/');
    } catch (error) {
        console.error('Error al eliminar libro:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// ===================== INICIALIZACIÓN DEL SERVIDOR =====================
async function startServer() {
    try {
        // Inicializar base de datos
        currentTableName = await initializeDatabase();
        
        // Obtener puerto de Render o usar 10000 localmente
        const port = process.env.PORT || 10000;
        
        app.listen(port, () => {
            console.log('='.repeat(48));
            
            // Mostrar mensaje según entorno
            const env = process.env.NODE_ENV || 'development';
            switch(env) {
                case 'production':
                    console.log('🔴 PROD BIBLIOTECA DIGITAL v2.1.1');
                    break;
                case 'staging':
                    console.log('🟡 STAGING BIBLIOTECA DIGITAL v2.1.1');
                    break;
                default:
                    console.log('🟢 DEV BIBLIOTECA DIGITAL v2.1.1');
            }
            
            console.log('='.repeat(48));
            console.log(`📍 Puerto: ${port}`);
            console.log(`📊 Tabla: ${currentTableName}`);
            console.log(`🌐 URL: http://localhost:${port}`);
            console.log('✅ Servidor listo y conectado a PostgreSQL');
            console.log('='.repeat(48));
        });
        
    } catch (error) {
        console.error('💥 Error fatal al iniciar servidor:', error);
        process.exit(1);
    }
}

// Iniciar el servidor
startServer();
