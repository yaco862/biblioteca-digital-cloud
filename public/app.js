document.addEventListener('DOMContentLoaded', () => {
    cargarLibros();
    cargarEstadisticas();
    configurarFormulario();
});

function configurarFormulario() {
    const form = document.getElementById('formLibro');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await agregarLibro();
    });
}

async function cargarLibros() {
    try {
        const response = await fetch('/api/libros');
        const resultado = await response.json();
        
        if (resultado.success) {
            mostrarLibros(resultado.data);
        } else {
            console.error('Error al cargar libros');
        }
    } catch (error) {
        console.error('Error de conexión:', error);
        mostrarError('No se pudieron cargar los libros. Verifica la conexión.');
    }
}

function mostrarLibros(libros) {
    const container = document.getElementById('libros');
    const mensajeVacio = document.getElementById('mensajeVacio');
    
    if (libros.length === 0) {
        container.innerHTML = '';
        mensajeVacio.style.display = 'block';
        return;
    }
    
    mensajeVacio.style.display = 'none';
    container.innerHTML = '';
    
    libros.forEach(libro => {
        const card = crearTarjetaLibro(libro);
        container.appendChild(card);
    });
}

function crearTarjetaLibro(libro) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
        <div class="book-title">${libro.titulo}</div>
        <div class="book-info"><strong>Autor:</strong> ${libro.autor}</div>
        <div class="book-info"><strong>Año:</strong> ${libro.año}</div>
        <div class="book-info"><strong>Género:</strong> ${libro.genero}</div>
        ${libro.isbn ? `<div class="book-info"><strong>ISBN:</strong> ${libro.isbn}</div>` : ''}
        <span class="badge ${libro.disponible ? 'disponible' : 'no-disponible'}">
            ${libro.disponible ? '✓ Disponible' : '✗ Prestado'}
        </span>
        <div class="book-actions">
            <button class="btn-small btn-toggle" onclick="toggleDisponibilidad(${libro.id}, ${!libro.disponible})">
                ${libro.disponible ? '📤 Prestar' : '📥 Devolver'}
            </button>
            <button class="btn-small btn-delete" onclick="eliminarLibro(${libro.id})">
                🗑️ Eliminar
            </button>
        </div>
    `;
    return card;
}

async function agregarLibro() {
    const titulo = document.getElementById('titulo').value;
    const autor = document.getElementById('autor').value;
    const año = document.getElementById('año').value;
    const genero = document.getElementById('genero').value;
    const isbn = document.getElementById('isbn').value;
    
    try {
        const response = await fetch('/api/libros', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ titulo, autor, año, genero, isbn })
        });
        
        const resultado = await response.json();
        
        if (resultado.success) {
            document.getElementById('formLibro').reset();
            await cargarLibros();
            await cargarEstadisticas();
            mostrarMensaje('✓ Libro agregado exitosamente', 'success');
        } else {
            mostrarMensaje('✗ Error al agregar libro', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('✗ Error de conexión al agregar libro', 'error');
    }
}

async function toggleDisponibilidad(id, disponible) {
    try {
        const response = await fetch(`/api/libros/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ disponible })
        });
        
        const resultado = await response.json();
        
        if (resultado.success) {
            await cargarLibros();
            await cargarEstadisticas();
            mostrarMensaje(`✓ Libro ${disponible ? 'devuelto' : 'prestado'} correctamente`, 'success');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('✗ Error al actualizar estado del libro', 'error');
    }
}

async function eliminarLibro(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este libro?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/libros/${id}`, {
            method: 'DELETE'
        });
        
        const resultado = await response.json();
        
        if (resultado.success) {
            await cargarLibros();
            await cargarEstadisticas();
            mostrarMensaje('✓ Libro eliminado correctamente', 'success');
        } else {
            mostrarMensaje('✗ Error al eliminar libro', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('✗ Error de conexión al eliminar libro', 'error');
    }
}

async function cargarEstadisticas() {
    try {
        const response = await fetch('/api/estadisticas');
        const resultado = await response.json();
        
        if (resultado.success) {
            const stats = resultado.data;
            document.getElementById('totalLibros').textContent = stats.total;
            document.getElementById('disponibles').textContent = stats.disponibles;
            document.getElementById('prestados').textContent = stats.prestados;
            document.getElementById('porcentaje').textContent = stats.porcentajeDisponible + '%';
        }
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

async function buscarLibros() {
    const termino = document.getElementById('busqueda').value.trim();
    
    if (!termino) {
        await cargarLibros();
        return;
    }
    
    try {
        const response = await fetch(`/api/buscar?q=${encodeURIComponent(termino)}`);
        const resultado = await response.json();
        
        if (resultado.success) {
            mostrarLibros(resultado.data);
            
            if (resultado.total === 0) {
                mostrarMensaje(`No se encontraron libros para "${termino}"`, 'info');
            }
        }
    } catch (error) {
        console.error('Error al buscar:', error);
        mostrarMensaje('✗ Error al realizar la búsqueda', 'error');
    }
}

function limpiarBusqueda() {
    document.getElementById('busqueda').value = '';
    cargarLibros();
}

document.addEventListener('DOMContentLoaded', () => {
    const inputBusqueda = document.getElementById('busqueda');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                buscarLibros();
            }
        });
    }
});

function mostrarMensaje(mensaje, tipo) {
    alert(mensaje);
}

function mostrarError(mensaje) {
    console.error(mensaje);
    alert(mensaje);
}
