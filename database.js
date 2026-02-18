const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'abel_shine_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// Définition des modèles
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

// Création des tables
sequelize.sync({ alter: true })
    .then(() => console.log('Tables créées avec succès'))
    .catch(err => console.error('Erreur création tables:', err));

module.exports = sequelize;
module.exports.Inscription = Inscription;
module.exports.Contact = Contact;
