const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const path = require('path');
const { poolPromise, sql } = require('../config/db'); // Adjust the path if necessary
require('dotenv').config({path: path.resolve(__dirname,'../../.env')})
const router = express.Router();

// Nodemailer transporter for sending emails
const transporter = nodemailer.createTransport({
    service: 'gmail', // Or another service like Outlook, SendGrid, etc.
    auth: {
        user: "kirushlaundrytransport1@gmail.com",
        pass: "zvlt zkpd aeen hcrk"
    }
});

// Endpoint to handle "Forgot Password" request
// Endpoint to handle "Forgot Password" request
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        const pool = await poolPromise();
        const userResult = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT id, email FROM User_Master WHERE email = @email');

        if (userResult.recordset.length === 0) {
            return res.status(200).json({ message: 'If a user with that email exists, a password reset link has been sent.' });
        }

        const user = userResult.recordset[0];
        const secret = "kirushlaundrytransport1@gmailcom" + user.id; // Correct
        
        // **CORRECTION HERE:** Use 'id' from the user object to create the token payload.
        const token = jwt.sign({ id: user.id }, secret, { expiresIn: '1h' }); 
        
        const resetLink = `http://localhost:5174/forgotpassword?token=${token}`;
    
        const mailOptions = {
            from: "kirushlaundrytransport1@gmail.com",
            to: email,
            subject: 'Password Reset Request',
            html: `
                <p>Hello,</p>
                <p>You recently requested to reset your password. Click the link below to proceed.</p>
                <a href="${resetLink}">Reset Password</a>
                <p>If you did not request a password reset, please ignore this email.</p>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Email sending error:', error);
                return res.status(500).json({ message: 'Error sending email.' });
            }
            res.status(200).json({ message: 'Password reset link sent.' });
        });

    } catch (error) {
        console.error('Database or server error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Endpoint to handle "Forgot Password" request
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        const pool = await poolPromise();
        const userResult = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT id, email FROM User_Master WHERE email = @email');

        if (userResult.recordset.length === 0) {
            return res.status(200).json({ message: 'If a user with that email exists, a password reset link has been sent.' });
        }

        const user = userResult.recordset[0];
        const secret = "kirushlaundrytransport1@gmailcom" + user.id; // Correct
        
        // **CORRECTION HERE:** Use 'id' from the user object to create the token payload.
        const token = jwt.sign({ id: user.id }, secret, { expiresIn: '1h' }); 
        
        const resetLink = `http://localhost:5174/forgotpassword?token=${token}`;
    
        const mailOptions = {
            from: "kirushlaundrytransport1@gmail.com",
            to: email,
            subject: 'Password Reset Request',
            html: `
                <p>Hello,</p>
                <p>You recently requested to reset your password. Click the link below to proceed.</p>
                <a href="${resetLink}">Reset Password</a>
                <p>If you did not request a password reset, please ignore this email.</p>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Email sending error:', error);
                return res.status(500).json({ message: 'Error sending email.' });
            }
            res.status(200).json({ message: 'Password reset link sent.' });
        });

    } catch (error) {
        console.error('Database or server error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Endpoint to handle "Reset Password" request with a valid token
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    try {
        const pool = await poolPromise();
        
        console.log('Received token:', token);
        
        // **CORRECTION HERE:** Decode the token to get the 'id'
        const decoded = jwt.decode(token);
        
        // **CORRECTION HERE:** Check for decoded.id instead of decoded.user_id
        console.log('Decoded user_id:', decoded.id); 
        if (!decoded || !decoded.id) {
            return res.status(401).json({ message: 'Invalid token.' });
        }

        const secret = "kirushlaundrytransport1@gmailcom" + decoded.id; // Correct
        
        // Verify the token
        jwt.verify(token, secret, async (err, verified) => {
            if (err) {
                console.error('JWT verification error:', err);
                return res.status(401).json({ message: 'Invalid or expired token.' });
            }

            // **CORRECTION HERE:** Use the correct key from the verified payload
            const userIdFromToken = verified.id;
    console.log('User ID from token after verification:', userIdFromToken);
    
            // Hash the new password and update the database
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            const updateResult = await pool.request()
                .input('user_id', sql.Int, userIdFromToken) // Pass the correct variable here
                .input('password', sql.NVarChar,newPassword)
                .query('UPDATE User_Master SET password = @password WHERE id = @user_id');
            
            if (updateResult.rowsAffected[0] === 0) {
                return res.status(404).json({ message: 'User not found or password not updated.' });
            }

            res.status(200).json({ message: 'Password updated successfully.' });
        });

    } catch (error) {
        console.error('Error during password reset:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;