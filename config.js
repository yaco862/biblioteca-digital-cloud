// config.js - Configuración por entorno

const config = {
    development: {
        environment: 'development',
        name: 'Desarrollo',
        badge_color: '#FFA500', // Naranja
        badge_text: 'DEV',
        table_prefix: 'dev',
        features: {
            debug: true,
            analytics: false,
            email_notifications: false,
            auto_backup: false
        }
    },
    staging: {
        environment: 'staging',
        name: 'Staging',
        badge_color: '#FFD700', // Amarillo
        badge_text: 'STAGING',
        table_prefix: 'staging',
        features: {
            debug: true,
            analytics: true,
            email_notifications: false,
            auto_backup: true
        }
    },
    production: {
        environment: 'production',
        name: 'Producción',
        badge_color: '#28A745', // Verde
        badge_text: 'PROD',
        table_prefix: 'prod',
        features: {
            debug: false,
            analytics: true,
            email_notifications: true,
            auto_backup: true
        }
    }
};

// Detectar entorno actual
const currentEnvironment = process.env.NODE_ENV || 'development';

// Exportar configuración del entorno actual
module.exports = {
    ...config[currentEnvironment],
    all: config,
    tableName: `libros_${config[currentEnvironment].table_prefix}`
};
