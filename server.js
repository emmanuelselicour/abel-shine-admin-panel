// server.js - Version corrigée avec gestion robuste des sessions
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

// Middleware de sécurité (désactivé partiellement pour le développement)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
}));

// Configuration CORS élargie
app.use(cors({
    origin: true, // Accepte toutes les origines en développement
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Trop de requêtes, veuillez réessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Middleware de parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuration des sessions AMÉLIORÉE
app.use(session({
    store: new pgSession({
        pool: pgPool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
        pruneSessionInterval: 60
    }),
    secret: process.env.SESSION_SECRET || 'abel-shine-secret-2026-change-this-in-production',
    resave: true, // Changé à true pour forcer la sauvegarde
    saveUninitialized: true, // Changé à true pour créer une session même vide
    cookie: { 
        secure: false, // Mis à false pour le développement (HTTP)
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
        sameSite: 'lax'
    },
    name: 'abel-shine.sid',
    rolling: true // Renouvelle le cookie à chaque requête
}));

// Middleware pour logger les sessions (debug)
app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    console.log('Is Authenticated:', req.session.isAuthenticated);
    next();
});

// Configuration EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========== ROUTES API ==========
app.post('/api/inscriptions', async (req, res) => {
    try {
        console.log('📝 Nouvelle inscription reçue:', req.body);
        
        const { nom, whatsapp, email, formation, message } = req.body;
        
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

app.post('/api/contact', async (req, res) => {
    try {
        console.log('📬 Nouveau message contact reçu:', req.body);
        
        const { nom, whatsapp, email, message } = req.body;
        
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
const requireAuth = (req, res, next) => {
    console.log('Vérification auth - Session:', req.session);
    console.log('isAuthenticated:', req.session.isAuthenticated);
    
    if (req.session && req.session.isAuthenticated === true) {
        console.log('✅ Authentification réussie');
        next();
    } else {
        console.log('❌ Authentification échouée, redirection vers login');
        res.redirect('/admin/login');
    }
};

// Page de login
app.get('/admin/login', (req, res) => {
    console.log('📄 Affichage page login');
    // Si déjà authentifié, rediriger vers dashboard
    if (req.session.isAuthenticated) {
        console.log('Utilisateur déjà authentifié, redirection vers dashboard');
        return res.redirect('/admin/dashboard');
    }
    res.render('login', { error: null });
});

// Traitement du login (VERSION CORRIGÉE)
app.post('/admin/login', async (req, res) => {
    console.log('🔐 Tentative de connexion:', req.body);
    
    const { username, password } = req.body;
    
    // Vérification des identifiants (à personnaliser)
    if (username === 'abel-shine-admin' && password === 'Abel@2026Shine') {
        console.log('✅ Identifiants corrects');
        
        // Sauvegarder l'authentification dans la session
        req.session.isAuthenticated = true;
        req.session.username = username;
        req.session.lastLogin = new Date().toISOString();
        
        // Sauvegarder explicitement la session
        req.session.save((err) => {
            if (err) {
                console.error('❌ Erreur sauvegarde session:', err);
                return res.render('login', { error: 'Erreur de session' });
            }
            
            console.log('✅ Session sauvegardée avec succès');
            console.log('Session après login:', req.session);
            
            // Rediriger vers le dashboard
            res.redirect('/admin/dashboard');
        });
    } else {
        console.log('❌ Identifiants incorrects');
        console.log('Attendu:', { username: 'abel-shine-admin', password: 'Abel@2026Shine' });
        console.log('Reçu:', { username, password });
        
        res.render('login', { error: 'Identifiants incorrects' });
    }
});

// Dashboard
app.get('/admin/dashboard', requireAuth, async (req, res) => {
    console.log('📊 Accès au dashboard');
    
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
            totalInscrits,
            username: req.session.username
        });
    } catch (error) {
        console.error('Erreur dashboard:', error);
        res.render('dashboard', {
            todayInscriptions: 0,
            todayContacts: 0,
            totalInscrits: 0,
            username: req.session.username
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
    console.log('🚪 Déconnexion');
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Erreur déconnexion:', err);
        }
        res.clearCookie('abel-shine.sid');
        res.redirect('/admin/login');
    });
});

// Route de santé
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Route racine - redirection vers login admin
app.get('/', (req, res) => {
    res.redirect('/admin/login');
});

// Gestion des erreurs 404
app.use((req, res) => {
    console.log('404 - Route non trouvée:', req.url);
    res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err);
    res.status(500).json({ 
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Démarrage du serveur
async function startServer() {
    try {
        // Vérifier la connexion à la base de données
        await sequelize.authenticate();
        console.log('✅ Connexion DB vérifiée');
        
        // Synchroniser les modèles
        await sequelize.sync({ alter: true });
        console.log('✅ Modèles synchronisés');
        
        // Démarrer le serveur
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Serveur démarré sur le port ${PORT}`);
            console.log(`📊 Panel admin: http://localhost:${PORT}/admin/login`);
            console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔑 Identifiants: abel-shine-admin / Abel@2026Shine`);
        });
    } catch (error) {
        console.error('❌ Erreur démarrage serveur:', error);
        process.exit(1);
    }
}

startServer();
