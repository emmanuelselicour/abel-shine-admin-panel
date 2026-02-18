const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const sequelize = require('./database');

// Import des routes
const inscriptionsRoutes = require('./routes/inscriptions');
const contactRoutes = require('./routes/contact');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'abel-shine-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Configuration EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes API (pour recevoir les données des formulaires)
app.use('/api/inscriptions', inscriptionsRoutes);
app.use('/api/contact', contactRoutes);

// Routes du panel admin
app.get('/admin/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    // À changer avec vos identifiants
    if (username === 'abel-shine-admin' && password === 'Abel@2026Shine') {
        req.session.isAuthenticated = true;
        res.redirect('/admin/dashboard');
    } else {
        res.render('login', { error: 'Identifiants incorrects' });
    }
});

// Middleware d'authentification pour les routes admin
const requireAuth = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

app.get('/admin/dashboard', requireAuth, async (req, res) => {
    try {
        const [inscriptions] = await sequelize.query(
            'SELECT COUNT(*) as count FROM Inscriptions WHERE DATE(createdAt) = CURDATE()'
        );
        const [contacts] = await sequelize.query(
            'SELECT COUNT(*) as count FROM Contacts WHERE DATE(createdAt) = CURDATE()'
        );
        const [totalInscrits] = await sequelize.query(
            'SELECT COUNT(*) as count FROM Inscriptions'
        );
        
        res.render('dashboard', {
            todayInscriptions: inscriptions[0].count,
            todayContacts: contacts[0].count,
            totalInscrits: totalInscrits[0].count
        });
    } catch (error) {
        console.error(error);
        res.render('dashboard', {
            todayInscriptions: 0,
            todayContacts: 0,
            totalInscrits: 0
        });
    }
});

app.get('/admin/inscriptions', requireAuth, async (req, res) => {
    try {
        const [inscriptions] = await sequelize.query(
            'SELECT * FROM Inscriptions ORDER BY createdAt DESC'
        );
        res.render('inscriptions', { inscriptions });
    } catch (error) {
        console.error(error);
        res.render('inscriptions', { inscriptions: [] });
    }
});

app.get('/admin/contacts', requireAuth, async (req, res) => {
    try {
        const [contacts] = await sequelize.query(
            'SELECT * FROM Contacts ORDER BY createdAt DESC'
        );
        res.render('contacts', { contacts });
    } catch (error) {
        console.error(error);
        res.render('contacts', { contacts: [] });
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// Synchronisation de la base de données
sequelize.sync({ alter: true }).then(() => {
    console.log('Base de données synchronisée');
    app.listen(PORT, () => {
        console.log(`Serveur démarré sur le port ${PORT}`);
    });
}).catch(err => {
    console.error('Erreur de synchronisation DB:', err);
});
