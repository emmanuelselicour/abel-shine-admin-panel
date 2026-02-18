const express = require('express');
const router = express.Router();
const { Contact } = require('../database');

// Route pour recevoir les messages de contact
router.post('/', async (req, res) => {
    try {
        const { nom, whatsapp, email, message } = req.body;
        
        const contact = await Contact.create({
            nom: nom,
            whatsapp: whatsapp,
            email: email,
            message: message
        });

        res.status(200).json({ 
            success: true, 
            message: 'Message enregistré avec succès',
            id: contact.id 
        });
    } catch (error) {
        console.error('Erreur contact:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// Route pour marquer un message comme lu
router.put('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        await Contact.update({ status: 'Lu' }, { where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
