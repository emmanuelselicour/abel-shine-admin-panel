const express = require('express');
const router = express.Router();
const { Inscription } = require('../database');

// Route pour recevoir les inscriptions du formulaire
router.post('/', async (req, res) => {
    try {
        const { name, phone, email, formation, message } = req.body;
        
        const inscription = await Inscription.create({
            nom: name,
            whatsapp: phone,
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
        console.error('Erreur inscription:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// Route pour mettre à jour le statut d'une inscription
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        await Inscription.update({ status }, { where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
