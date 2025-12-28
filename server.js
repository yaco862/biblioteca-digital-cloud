const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let libros = [
    { 
        id: 1, 
        titulo: 'Cien años de soledad', 
        autor: 'Gabriel García Márquez', 
        año: 1967, 
        genero: 'Ficción',
        isbn: '978-0307474728',
        disponible: true 
    },
    { 
        id: 2, 
        titulo: 'Don Quijote de la Mancha', 
        autor: 'Miguel de Cervantes', 
        año: 1605, 
        genero: 'Clásico',
        isbn: '978-8424936464',
        disponible: true 
    },
    { 
        id: 3, 
        titulo: '1984', 
        autor: 'George Orwell', 
        año: 1949, 
        genero: 'Ciencia Ficción',
        isbn: '978-0451524935',
        disponible: false 
    },
    { 
        id: 4, 
        titulo: 'El Principito', 
        autor: 'Antoine de Saint-Exupéry', 
        año: 1943, 
        genero: 'Infantil',
        isbn: '978-0156012195',
        disponible: true 
    }
];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/libros', (req, res) => {
    res.json({
        success: true,
        total: libros.length,
        disponibles: libros.filter(l => l.disponible).length,
        data: libros
    });
});

app.get('/api/libros/:id', (req, res) => {
    const libro = libros.find(l => l.id === parseInt(req.params.id));
    if (libro) {
        res.json({ success: true, data: libro });
    } else {
        res.status(404).json({ success: false, error: 'Libro no encontrado' });
    }
});

app.post('/api/libros', (req, res) => {
    const nuevoLibro = {
        id: libros.length > 0 ? Math.max(...libros.map(l => l.id)) + 1 : 1,
        titulo: req.body.titulo,
        autor: req.body.autor,
        año: parseInt(req.body.año),
        genero: req.body.genero || 'General',
        isbn: req.body.isbn || '',
        disponible: true
    };
    
    libros.push(nuevoLibro);
    res.status(201).json({ 
        success: true, 
        message: 'Libro agregado exitosamente',
        data: nuevoLibro 
    });
});

app.put('/api/libros/:id', (req, res) => {
    const libro = libros.find(l => l.id === parseInt(req.params.id));
    if (libro) {
        libro.disponible = req.body.disponible;
        res.json({ 
            success: true, 
            message: 'Estado actualizado correctamente',
            data: libro 
        });
    } else {
        res.status(404).json({ success: false, error: 'Libro no encontrado' });
    }
});

app.delete('/api/libros/:id', (req, res) => {
    const index = libros.findIndex(l => l.id === parseInt(req.params.id));
    if (index !== -1) {
        const libroEliminado = libros.splice(index, 1);
        res.json({ 
            success: true, 
            message: 'Libro eliminado correctamente',
            data: libroEliminado[0]
        });
    } else {
        res.status(404).json({ success: false, error: 'Libro no encontrado' });
    }
});

app.get('/api/estadisticas', (req, res) => {
    const disponibles = libros.filter(l => l.disponible).length;
    const prestados = libros.length - disponibles;
    
    res.json({
        success: true,
        data: {
            total: libros.length,
            disponibles: disponibles,
            prestados: prestados,
            porcentajeDisponible: libros.length > 0 
                ? ((disponibles / libros.length) * 100).toFixed(1) 
                : 0
        }
    });
});

app.get('/api/buscar', (req, res) => {
    const termino = req.query.q ? req.query.q.toLowerCase() : '';
    
    if (!termino) {
        return res.json({ success: true, data: libros });
    }
    
    const resultados = libros.filter(libro => 
        libro.titulo.toLowerCase().includes(termino) ||
        libro.autor.toLowerCase().includes(termino) ||
        libro.genero.toLowerCase().includes(termino)
    );
    
    res.json({ 
        success: true, 
        total: resultados.length,
        data: resultados 
    });
});

app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Ruta no encontrada' 
    });
});

app.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 SERVIDOR DE BIBLIOTECA DIGITAL');
    console.log('========================================');
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🌐 URL Local: http://localhost:${PORT}`);
    console.log(`📚 API Libros: http://localhost:${PORT}/api/libros`);
    console.log(`📊 API Stats: http://localhost:${PORT}/api/estadisticas`);
    console.log('========================================');
});
