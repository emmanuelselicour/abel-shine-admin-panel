// database.js - Version PostgreSQL
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

// Utilisation de l'URL de connexion PostgreSQL
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false // Nécessaire pour Render
        }
    },
    logging: false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// Définition des modèles (inchangée)
const Inscription = sequelize.define('Inscription', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    nom: { type: Sequelize.STRING, allowNull: false },
    whatsapp: { type: Sequelize.STRING, allowNull: false },
    email: { type: Sequelize.STRING, allowNull: false },
    formation: { type: Sequelize.STRING, allowNull: false },
    message: { type: Sequelize.TEXT },
    status: { type: Sequelize.STRING, defaultValue: 'Nouveau' },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

const Contact = sequelize.define('Contact', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    nom: { type: Sequelize.STRING, allowNull: false },
    whatsapp: { type: Sequelize.STRING, allowNull: false },
    email: { type: Sequelize.STRING, allowNull: false },
    message: { type: Sequelize.TEXT, allowNull: false },
    status: { type: Sequelize.STRING, defaultValue: 'Non lu' },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// Test de la connexion
sequelize.authenticate()
    .then(() => console.log('✅ Connexion à PostgreSQL établie avec succès.'))
    .catch(err => console.error('❌ Impossible de se connecter à PostgreSQL:', err));

// Synchronisation
sequelize.sync({ alter: true })
    .then(() => console.log('✅ Tables synchronisées avec succès'))
    .catch(err => console.error('❌ Erreur synchronisation tables:', err));

module.exports = sequelize;
module.exports.Inscription = Inscription;
module.exports.Contact = Contact;
