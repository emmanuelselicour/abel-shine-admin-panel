// server.js - Version finale avec session store PostgreSQL et sécurité renforcée
const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);
const sequelize = require('./database');
const { Inscription, Contact } = require('./database');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Configuration du pool PostgreSQL pour les sessions
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000
});

// Middleware de sécurité
app.use(helmet({
    contentSecurityPolicy: false, // Désactivé pour permettre les scripts inline
    crossOriginEmbedderPolicy: false
}));

// Configuration CORS
app.use(cors({
    origin: ['https://emmanuelselicour.github.io', 'http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Rate limiting pour éviter les abus
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limite de 100 requêtes par IP
    message: 'Trop de requêtes, veuillez réessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false
});

// Appliquer le rate limiting aux routes API
app.use('/api/', limiter);

// Middleware de parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuration des sessions avec stockage PostgreSQL
app.use(session({
    store: new pgSession({
        pool: pgPool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
        pruneSessionInterval: 60 // Nettoyage des sessions expirées toutes les 60 secondes
    }),
    secret: process.env.SESSION_SECRET || 'abel-shine-secret-2026-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // HTTPS en production
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
        sameSite: 'lax'
    },
    name: 'abel-shine.sid' // Nom personnalisé du cookie
}));

// Configuration EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========== ROUTES API ==========

// Route pour recevoir les inscriptions
app.post('/api/inscriptions', async (req, res) => {
    try {
        console.log('📝 Nouvelle inscription reçue:', req.body);
        
        const { nom, whatsapp, email, formation, message } = req.body;
        
        // Validation des données
        if (!nom || !whatsapp || !email || !formation) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tous les champs requis doivent être remplis' 
            });
        }

        const inscription = await Inscription.create({
            nom: nom,
            whatsapp: whatsapp,
            email: email,
            formation: formation,
            message: message || ''
        });

        console.log('✅ Inscription enregistrée avec ID:', inscription.id);

        res.status(200).json({ 
            success: true, 
            message: 'Inscription enregistrée avec succès',
            id: inscription.id 
        });
    } catch (error) {
        console.error('❌ Erreur inscription:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur lors de l\'inscription' 
        });
    }
});

// Route pour recevoir les messages de contact
app.post('/api/contact', async (req, res) => {
    try {
        console.log('📬 Nouveau message contact reçu:', req.body);
        
        const { nom, whatsapp, email, message } = req.body;
        
        // Validation des données
        if (!nom || !whatsapp || !email || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tous les champs sont requis' 
            });
        }

        const contact = await Contact.create({
            nom: nom,
            whatsapp: whatsapp,
            email: email,
            message: message
        });

        console.log('✅ Message contact enregistré avec ID:', contact.id);

        res.status(200).json({ 
            success: true, 
            message: 'Message envoyé avec succès',
            id: contact.id 
        });
    } catch (error) {
        console.error('❌ Erreur contact:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur lors de l\'envoi du message' 
        });
    }
});

// Route pour mettre à jour le statut d'une inscription
app.put('/api/inscriptions/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        await Inscription.update({ status }, { where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur mise à jour statut:', error);
        res.status(500).json({ success: false });
    }
});

// Route pour marquer un message comme lu
app.put('/api/contact/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        await Contact.update({ status: 'Lu' }, { where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur mise à jour message:', error);
        res.status(500).json({ success: false });
    }
});

// ========== ROUTES ADMIN ==========

// Middleware d'authentification
const requireAuth = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

// Page de login
app.get('/admin/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    // À remplacer par une vérification en base de données pour plus de sécurité
    if (username === 'abel-shine-admin' && password === 'Abel@2026Shine') {
        req.session.isAuthenticated = true;
        req.session.username = username;
        res.redirect('/admin/dashboard');
    } else {
        res.render('login', { error: 'Identifiants incorrects' });
    }
});

// Dashboard
app.get('/admin/dashboard', requireAuth, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayInscriptions = await Inscription.count({
            where: {
                createdAt: {
                    [sequelize.Sequelize.Op.gte]: today
                }
            }
        });

        const todayContacts = await Contact.count({
            where: {
                createdAt: {
                    [sequelize.Sequelize.Op.gte]: today
                }
            }
        });

        const totalInscrits = await Inscription.count();
        
        res.render('dashboard', {
            todayInscriptions,
            todayContacts,
            totalInscrits
        });
    } catch (error) {
        console.error('Erreur dashboard:', error);
        res.render('dashboard', {
            todayInscriptions: 0,
            todayContacts: 0,
            totalInscrits: 0
        });
    }
});

// Liste des inscriptions
app.get('/admin/inscriptions', requireAuth, async (req, res) => {
    try {
        const inscriptions = await Inscription.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.render('inscriptions', { inscriptions });
    } catch (error) {
        console.error('Erreur récupération inscriptions:', error);
        res.render('inscriptions', { inscriptions: [] });
    }
});

// Liste des contacts
app.get('/admin/contacts', requireAuth, async (req, res) => {
    try {
        const contacts = await Contact.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.render('contacts', { contacts });
    } catch (error) {
        console.error('Erreur récupération contacts:', error);
        res.render('contacts', { contacts: [] });
    }
});

// Déconnexion
app.get('/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Erreur déconnexion:', err);
        }
        res.clearCookie('abel-shine.sid');
        res.redirect('/admin/login');
    });
});

// Route de santé pour Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
    console.error('Erreur serveur:', err);
    res.status(500).json({ 
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Démarrage du serveur
async function startServer() {
    try {
        // Attendre que la base de données soit prête
        await sequelize.authenticate();
        console.log('✅ Connexion DB vérifiée');
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Serveur démarré sur le port ${PORT}`);
            console.log(`📊 Panel admin: http://localhost:${PORT}/admin/login`);
            console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('❌ Erreur démarrage serveur:', error);
        process.exit(1);
    }
}

startServer();
