const { db } = require('../models/bunisses_transacctions');

const getBusinessUserProfile = (req, res) => {
    const { companyID, businessUserID } = req.body;

    const query = `
        SELECT u.businessUserID, u.username, u.firstname, u.lastname, u.role, u.phoneNumber,
               c.companyName
        FROM business_users u
        JOIN companies c ON u.companyID = c.companyID
        WHERE u.businessUserID = ? AND u.companyID = ?
    `;

    db.get(query, [businessUserID, companyID], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });

        res.status(200).json({ 
            username: user.username,
            companyName: user.companyName,
            lastname: user.lastname,
            businessUserID: user.businessUserID,
            firstname: user.firstname,
            role: user.role,
            phoneNumber: user.phoneNumber
        });
    });
};

module.exports = { getBusinessUserProfile };