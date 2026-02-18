// server.js - Version finale avec authentification fonctionnelle
const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);
const sequelize = require('./database');
const { Inscription, Contact } = require('./database');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Configuration du pool PostgreSQL pour les sessions
let pgPool;
try {
    pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000
    });
    console.log('✅ Pool PostgreSQL initialisé');
} catch (error) {
    console.error('❌ Erreur initialisation pool:', error);
}

// ========== MIDDLEWARE DE BASE ==========
app.use(cors({
    origin: ['https://emmanuelselicour.github.io', 'http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== CONFIGURATION SESSION SIMPLIFIÉE ==========
// Version sans base de données pour tester
app.use(session({
    secret: process.env.SESSION_SECRET || 'abel-shine-secret-2026-simple-key',
    resave: true,
    saveUninitialized: true,
    cookie: { 
        secure: false, // Mettre à false pour HTTP
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
        sameSite: 'lax'
    },
    name: 'abel-shine.sid'
}));

console.log('✅ Middleware session configuré');

// ========== MIDDLEWARE D'AUTHENTIFICATION ==========
const requireAuth = (req, res, next) => {
    console.log('🔒 Vérification auth - Session:', req.session ? req.session.id : 'pas de session');
    console.log('🔒 isAuthenticated:', req.session ? req.session.isAuthenticated : false);
    
    if (req.session && req.session.isAuthenticated === true) {
        console.log('✅ Authentification réussie');
        next();
    } else {
        console.log('❌ Non authentifié, redirection vers login');
        res.redirect('/admin/login');
    }
};

// ========== ROUTES PUBLIQUES ==========
app.get('/', (req, res) => {
    res.json({ message: 'API ABEL SHINE - Panel Admin', status: 'online' });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

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
            error: 'Erreur serveur' 
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

        console.log('✅ Message contact enregistré avec ID:', contact.id);
        res.status(200).json({ 
            success: true, 
            message: 'Message envoyé avec succès',
            id: contact.id 
        });
    } catch (error) {
        console.error('❌ Erreur contact:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ========== ROUTES ADMIN ==========

// Page de login
app.get('/admin/login', (req, res) => {
    console.log('📄 Affichage page login');
    
    // Si déjà authentifié, rediriger vers dashboard
    if (req.session && req.session.isAuthenticated === true) {
        console.log('🔄 Déjà authentifié, redirection vers dashboard');
        return res.redirect('/admin/dashboard');
    }
    
    // Afficher la page de login
    res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Admin - Connexion | ABEL SHINE</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: 'Segoe UI', sans-serif;
                }
                body {
                    background: linear-gradient(135deg, #c8a2c8, #d4af37);
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .login-container {
                    background: white;
                    padding: 3rem;
                    border-radius: 30px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    width: 90%;
                    max-width: 400px;
                }
                h1 {
                    text-align: center;
                    margin-bottom: 2rem;
                    color: #2d2d2d;
                }
                .logo {
                    text-align: center;
                    margin-bottom: 1rem;
                }
                .logo img {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    border: 3px solid #d4af37;
                }
                input {
                    width: 100%;
                    padding: 1rem;
                    margin: 1rem 0;
                    border: 2px solid #ddd;
                    border-radius: 50px;
                    font-size: 1rem;
                }
                button {
                    width: 100%;
                    padding: 1rem;
                    background: linear-gradient(135deg, #c8a2c8, #d4af37);
                    color: white;
                    border: none;
                    border-radius: 50px;
                    font-size: 1.2rem;
                    font-weight: bold;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                button:hover {
                    transform: translateY(-2px);
                }
                .error {
                    background: #ffebee;
                    color: #c62828;
                    padding: 1rem;
                    border-radius: 50px;
                    margin-bottom: 1rem;
                    text-align: center;
                }
                .info {
                    background: #e3f2fd;
                    color: #1976d2;
                    padding: 1rem;
                    border-radius: 50px;
                    margin-bottom: 1rem;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="login-container">
                <div class="logo">
                    <img src="https://i.postimg.cc/GmNfdBVD/IMG-20260214-WA0015.jpg" alt="Logo">
                </div>
                <h1>Panel Admin ABEL SHINE</h1>
                
                ${req.query.error ? `<div class="error">${req.query.error}</div>` : ''}
                ${req.query.message ? `<div class="info">${req.query.message}</div>` : ''}
                
                <form method="POST" action="/admin/login">
                    <input type="text" name="username" placeholder="Nom d'utilisateur" value="abel-shine-admin" required>
                    <input type="password" name="password" placeholder="Mot de passe" value="Abel@2026Shine" required>
                    <button type="submit">Se connecter</button>
                </form>
                <p style="text-align: center; margin-top: 1rem; color: #666;">
                    Identifiants: abel-shine-admin / Abel@2026Shine
                </p>
            </div>
        </body>
        </html>
    `);
});

// Traitement du login
app.post('/admin/login', (req, res) => {
    console.log('🔑 Tentative de login - Body reçu:', req.body);
    console.log('🔑 Session avant login:', req.session ? req.session.id : 'pas de session');
    
    const { username, password } = req.body;
    
    // Vérification des identifiants
    if (username === 'abel-shine-admin' && password === 'Abel@2026Shine') {
        console.log('✅ Identifiants corrects');
        
        // Créer la session
        req.session.isAuthenticated = true;
        req.session.username = username;
        req.session.loginTime = new Date().toISOString();
        
        // Sauvegarder et rediriger
        req.session.save((err) => {
            if (err) {
                console.error('❌ Erreur sauvegarde session:', err);
                return res.redirect('/admin/login?error=Erreur+de+sauvegarde+session');
            }
            
            console.log('✅ Session sauvegardée avec succès');
            console.log('✅ Session après login:', req.session);
            console.log('✅ isAuthenticated:', req.session.isAuthenticated);
            
            res.redirect('/admin/dashboard');
        });
    } else {
        console.log('❌ Identifiants incorrects - username:', username, 'password:', password);
        res.redirect('/admin/login?error=Identifiants+incorrects');
    }
});

// Dashboard
app.get('/admin/dashboard', requireAuth, async (req, res) => {
    console.log('📊 Accès au dashboard - Utilisateur:', req.session.username);
    
    try {
        // Récupérer quelques statistiques simples
        const totalInscrits = await Inscription.count();
        const totalContacts = await Contact.count();
        
        res.send(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Dashboard | ABEL SHINE</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                        font-family: 'Segoe UI', sans-serif;
                    }
                    body {
                        background: #f5f5f5;
                    }
                    .header {
                        background: linear-gradient(135deg, #c8a2c8, #d4af37);
                        color: white;
                        padding: 1rem 2rem;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 {
                        font-size: 1.8rem;
                    }
                    .logout {
                        color: white;
                        text-decoration: none;
                        background: rgba(255,255,255,0.2);
                        padding: 0.5rem 1rem;
                        border-radius: 50px;
                    }
                    .logout:hover {
                        background: rgba(255,255,255,0.3);
                    }
                    .container {
                        padding: 2rem;
                        max-width: 1400px;
                        margin: 0 auto;
                    }
                    .success-message {
                        background: #d4edda;
                        color: #155724;
                        padding: 1rem;
                        border-radius: 50px;
                        margin-bottom: 2rem;
                        text-align: center;
                        border: 2px solid #28a745;
                    }
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 2rem;
                        margin-bottom: 3rem;
                    }
                    .stat-card {
                        background: white;
                        padding: 2rem;
                        border-radius: 20px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        text-align: center;
                    }
                    .stat-card h3 {
                        color: #666;
                        font-size: 1.2rem;
                        margin-bottom: 1rem;
                    }
                    .stat-card .number {
                        font-size: 3rem;
                        font-weight: bold;
                        color: #c8a2c8;
                    }
                    .menu-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                        gap: 2rem;
                    }
                    .menu-card {
                        background: white;
                        border-radius: 20px;
                        padding: 2rem;
                        text-decoration: none;
                        color: inherit;
                        transition: transform 0.3s;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        display: block;
                    }
                    .menu-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    }
                    .menu-card h2 {
                        color: #2d2d2d;
                        margin-bottom: 1rem;
                    }
                    .menu-card p {
                        color: #666;
                        margin-bottom: 1.5rem;
                    }
                    .badge {
                        background: linear-gradient(135deg, #c8a2c8, #d4af37);
                        color: white;
                        padding: 0.5rem 1rem;
                        border-radius: 50px;
                        display: inline-block;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>👋 Bienvenue, ${req.session.username} !</h1>
                    <a href="/admin/logout" class="logout">Déconnexion</a>
                </div>
                
                <div class="container">
                    <div class="success-message">
                        ✅ Connexion réussie ! Session ID: ${req.session.id.substring(0,8)}...
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <h3>Total inscriptions</h3>
                            <div class="number">${totalInscrits}</div>
                        </div>
                        <div class="stat-card">
                            <h3>Total messages</h3>
                            <div class="number">${totalContacts}</div>
                        </div>
                        <div class="stat-card">
                            <h3>Connecté depuis</h3>
                            <div class="number" style="font-size: 1.5rem;">${new Date(req.session.loginTime).toLocaleString()}</div>
                        </div>
                    </div>

                    <div class="menu-grid">
                        <a href="/admin/inscriptions" class="menu-card">
                            <h2>📝 Inscriptions</h2>
                            <p>Consultez toutes les demandes d'inscription</p>
                            <span class="badge">Voir les inscriptions</span>
                        </a>
                        <a href="/admin/contacts" class="menu-card">
                            <h2>📬 Messages contact</h2>
                            <p>Consultez tous les messages reçus</p>
                            <span class="badge">Voir les messages</span>
                        </a>
                        <a href="https://emmanuelselicour.github.io/ABEL-SHINE-ECOLE/" class="menu-card" target="_blank">
                            <h2>🌐 Voir le site</h2>
                            <p>Retourner sur le site public</p>
                            <span class="badge">Visiter le site</span>
                        </a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Erreur dashboard:', error);
        res.status(500).send('Erreur serveur');
    }
});

// Route simple pour les inscriptions
app.get('/admin/inscriptions', requireAuth, async (req, res) => {
    try {
        const inscriptions = await Inscription.findAll({
            order: [['createdAt', 'DESC']],
            limit: 50
        });
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Inscriptions | ABEL SHINE</title>
                <style>
                    body { font-family: Arial; padding: 20px; background: #f5f5f5; }
                    .header { background: linear-gradient(135deg, #c8a2c8, #d4af37); color: white; padding: 20px; margin-bottom: 20px; border-radius: 10px; }
                    table { width: 100%; background: white; border-collapse: collapse; border-radius: 10px; overflow: hidden; }
                    th { background: #c8a2c8; color: white; padding: 15px; text-align: left; }
                    td { padding: 15px; border-bottom: 1px solid #ddd; }
                    tr:hover { background: #f9f9f9; }
                    .back { margin-bottom: 20px; }
                    .back a { color: white; text-decoration: none; background: #2d2d2d; padding: 10px 20px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="back"><a href="/admin/dashboard">← Retour au dashboard</a></div>
                <div class="header">
                    <h1>📝 Inscriptions reçues (${inscriptions.length})</h1>
                </div>
                <table>
                    <tr>
                        <th>Date</th>
                        <th>Nom</th>
                        <th>WhatsApp</th>
                        <th>Email</th>
                        <th>Formation</th>
                        <th>Message</th>
                        <th>Statut</th>
                    </tr>
        `;
        
        inscriptions.forEach(ins => {
            html += `
                <tr>
                    <td>${new Date(ins.createdAt).toLocaleString()}</td>
                    <td><strong>${ins.nom}</strong></td>
                    <td><a href="https://wa.me/${ins.whatsapp.replace(/\s/g, '')}" target="_blank">${ins.whatsapp}</a></td>
                    <td>${ins.email}</td>
                    <td>${ins.formation}</td>
                    <td>${ins.message || '-'}</td>
                    <td><span style="background: ${ins.status === 'Nouveau' ? '#ffebee' : '#e8f5e8'}; padding: 5px 10px; border-radius: 5px;">${ins.status}</span></td>
                </tr>
            `;
        });
        
        html += '</table></body></html>';
        res.send(html);
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur');
    }
});

// Route simple pour les contacts
app.get('/admin/contacts', requireAuth, async (req, res) => {
    try {
        const contacts = await Contact.findAll({
            order: [['createdAt', 'DESC']],
            limit: 50
        });
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Messages | ABEL SHINE</title>
                <style>
                    body { font-family: Arial; padding: 20px; background: #f5f5f5; }
                    .header { background: linear-gradient(135deg, #c8a2c8, #d4af37); color: white; padding: 20px; margin-bottom: 20px; border-radius: 10px; }
                    .message-card { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; border-left: 5px solid #c8a2c8; }
                    .message-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
                    .date { color: #666; }
                    .status { padding: 5px 10px; border-radius: 5px; background: ${contact.status === 'Non lu' ? '#ffebee' : '#e8f5e8'}; }
                    .contact-info { background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0; }
                    .message-content { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 10px 0; font-style: italic; }
                    .back { margin-bottom: 20px; }
                    .back a { color: white; text-decoration: none; background: #2d2d2d; padding: 10px 20px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="back"><a href="/admin/dashboard">← Retour au dashboard</a></div>
                <div class="header">
                    <h1>📬 Messages de contact (${contacts.length})</h1>
                </div>
        `;
        
        contacts.forEach(contact => {
            html += `
                <div class="message-card">
                    <div class="message-header">
                        <span class="date">${new Date(contact.createdAt).toLocaleString()}</span>
                        <span class="status">${contact.status}</span>
                    </div>
                    <h3>${contact.nom}</h3>
                    <div class="contact-info">
                        📞 <a href="https://wa.me/${contact.whatsapp.replace(/\s/g, '')}" target="_blank">${contact.whatsapp}</a><br>
                        ✉️ ${contact.email}
                    </div>
                    <div class="message-content">
                        ${contact.message}
                    </div>
                </div>
            `;
        });
        
        html += '</body></html>';
        res.send(html);
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('Erreur');
    }
});

// Déconnexion
app.get('/admin/logout', (req, res) => {
    console.log('🚪 Déconnexion demandée');
    req.session.destroy((err) => {
        if (err) {
            console.error('Erreur déconnexion:', err);
        }
        res.clearCookie('abel-shine.sid');
        res.redirect('/admin/login?message=Déconnexion+réussie');
    });
});

// Route de test pour vérifier la session
app.get('/admin/check-session', (req, res) => {
    res.json({
        sessionExists: !!req.session,
        sessionID: req.session ? req.session.id : null,
        isAuthenticated: req.session ? req.session.isAuthenticated : false,
        username: req.session ? req.session.username : null,
        cookies: req.headers.cookie
    });
});

// ========== DÉMARRAGE SERVEUR ==========
async function startServer() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion DB vérifiée');
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Serveur démarré sur le port ${PORT}`);
            console.log(`📍 Panel admin: http://localhost:${PORT}/admin/login`);
            console.log(`📍 Test session: http://localhost:${PORT}/admin/check-session`);
            console.log(`📍 Santé: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ Erreur démarrage serveur:', error);
        process.exit(1);
    }
}

startServer();
