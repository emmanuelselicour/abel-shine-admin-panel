// database.js - Version finale avec gestion d'erreurs améliorée
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

// Configuration de la connexion PostgreSQL
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false // Nécessaire pour Render
        }
    },
    logging: false, // Désactiver les logs SQL en production
    pool: {
        max: 10,              // Maximum de connexions dans le pool
        min: 2,               // Minimum de connexions maintenues
        acquire: 60000,       // Temps max pour acquérir une connexion (60s)
        idle: 10000           // Temps d'inactivité avant libération
    },
    retry: {
        max: 3,               // Nombre de tentatives de reconnexion
        timeout: 3000         // Délai entre les tentatives
    }
});

// Définition du modèle Inscription
const Inscription = sequelize.define('Inscription', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    nom: { 
        type: Sequelize.STRING, 
        allowNull: false,
        validate: {
            notEmpty: { msg: "Le nom ne peut pas être vide" }
        }
    },
    whatsapp: { 
        type: Sequelize.STRING, 
        allowNull: false,
        validate: {
            notEmpty: { msg: "Le numéro WhatsApp est requis" }
        }
    },
    email: { 
        type: Sequelize.STRING, 
        allowNull: false,
        validate: {
            isEmail: { msg: "Format d'email invalide" },
            notEmpty: { msg: "L'email est requis" }
        }
    },
    formation: { 
        type: Sequelize.STRING, 
        allowNull: false 
    },
    message: { 
        type: Sequelize.TEXT,
        defaultValue: ''
    },
    status: { 
        type: Sequelize.STRING, 
        defaultValue: 'Nouveau',
        validate: {
            isIn: {
                args: [['Nouveau', 'Contacté', 'Inscrit', 'Archivé']],
                msg: "Statut invalide"
            }
        }
    },
    createdAt: { 
        type: Sequelize.DATE, 
        defaultValue: Sequelize.NOW 
    },
    updatedAt: { 
        type: Sequelize.DATE, 
        defaultValue: Sequelize.NOW 
    }
});

// Définition du modèle Contact
const Contact = sequelize.define('Contact', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    nom: { 
        type: Sequelize.STRING, 
        allowNull: false 
    },
    whatsapp: { 
        type: Sequelize.STRING, 
        allowNull: false 
    },
    email: { 
        type: Sequelize.STRING, 
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    message: { 
        type: Sequelize.TEXT, 
        allowNull: false 
    },
    status: { 
        type: Sequelize.STRING, 
        defaultValue: 'Non lu',
        validate: {
            isIn: [['Non lu', 'Lu', 'Répondu']]
        }
    },
    createdAt: { 
        type: Sequelize.DATE, 
        defaultValue: Sequelize.NOW 
    },
    updatedAt: { 
        type: Sequelize.DATE, 
        defaultValue: Sequelize.NOW 
    }
});

// Fonction pour initialiser la base de données avec gestion d'erreurs
async function initializeDatabase() {
    let retries = 5;
    let connected = false;
    
    while (retries > 0 && !connected) {
        try {
            console.log(`🔄 Tentative de connexion à la DB... (${retries} essais restants)`);
            
            // Tester la connexion
            await sequelize.authenticate();
            console.log('✅ Connexion à PostgreSQL établie avec succès.');
            
            // Synchroniser les modèles
            await sequelize.sync({ alter: true });
            console.log('✅ Tables synchronisées avec succès.');
            
            connected = true;
            
        } catch (error) {
            console.error(`❌ Erreur de connexion: ${error.message}`);
            retries -= 1;
            
            // Ignorer l'erreur de clé dupliquée car elle n'est pas bloquante
            if (error.code === '23505') {
                console.log('⚠️  Les tables existent déjà (erreur non bloquante)');
                connected = true;
                break;
            }
            
            if (retries === 0) {
                console.error('❌ Échec de connexion après plusieurs tentatives');
                throw error;
            }
            
            // Attendre avant de réessayer (backoff exponentiel)
            const delay = (5 - retries) * 2000;
            console.log(`⏳ Nouvelle tentative dans ${delay/1000} secondes...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    return connected;
}

// Exécuter l'initialisation
initializeDatabase().catch(err => {
    console.error('❌ Erreur fatale de base de données:', err);
    process.exit(1);
});

module.exports = sequelize;
module.exports.Inscription = Inscription;
module.exports.Contact = Contact;
