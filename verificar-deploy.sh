#!/bin/bash

echo "================================================"
echo "🔍 VERIFICACIÓN COMPLETA DE DESPLIEGUE"
echo "================================================"
echo ""

# Verificar repositorio Git
echo "📦 Verificando repositorio Git..."
git status
echo ""

# Verificar archivos importantes
echo "📄 Verificando archivos críticos..."
ls -lh server.js package.json init-db.js .env 2>/dev/null
echo ""

# Verificar dependencias
echo "📚 Verificando node_modules..."
if [ -d "node_modules" ]; then
    echo "✅ node_modules existe"
else
    echo "❌ node_modules NO existe"
fi
echo ""

# Mostrar último commit
echo "📝 Último commit:"
git log -1 --oneline
echo ""

# Verificar conexión a base de datos local
echo "🔌 Probando conexión a base de datos..."
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
pool.query('SELECT COUNT(*) FROM libros', (err, res) => {
    if (err) {
        console.log('❌ Error:', err.message);
    } else {
        console.log('✅ Conectado! Libros en BD:', res.rows[0].count);
    }
    pool.end();
});
"
echo ""

echo "================================================"
echo "✅ VERIFICACIÓN COMPLETADA"
echo "================================================"
