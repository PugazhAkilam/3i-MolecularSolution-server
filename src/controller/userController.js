const { poolPromise, sql } = require('../config/db'); 
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({path: path.resolve(__dirname,'../../../.env')})

// Nodemailer transporter for sending emails
const transporter = nodemailer.createTransport({
    service: 'gmail', // Or another service like Outlook, SendGrid, etc.
    auth: {
        user: "kirushlaundrytransport1@gmail.com",
        pass: "zvlt zkpd aeen hcrk"
    }
});


const loginCheck = async (req, res) => {
    const { userName, password } = req.body;
    console.log("userName", userName);

    try {
        const pool = await poolPromise();
        const request = pool.request();

        if( !userName || !password) {
            return res.status(400).json({ message: "Please fill all required fields. "})
        }

        request.input("userName", sql.VarChar, userName);

        const query = `
            SELECT id,userName,password,userType FROM User_Master
            WHERE userName = @userName;
        `;

        const result = await request.query(query);
        console.log("checkUserResult:", result);

        if (result.recordset.length === 0) {
            return res.status(400).json({ message: "User not found" });
        }

        const user = result.recordset[0];
    const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';
        // For now, just compare raw passwords
        // TODO: Use bcrypt to hash and compare passwords securely
        if (user.password !== password) {
            return res.status(401).json({ message: "Invalid password" });
        }
       const token = jwt.sign(
            { id: user.id, userType: user.userType },
            JWT_SECRET,
            { expiresIn: '24h' }
        );


    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

        return res.status(200).json({
            data: user,
            message: "Login successful"
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Internal server error" });
    }   
}

const handleForgetPassword = async (req, res) => {
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
}
const getProfileDetail = async (req, res) => {
     const userId = req.user.id;
        
        console.log("userId", userId);
        
    try {
        // Get user ID from JWT token (set by auth middleware)
        const userId = req.user.id;
        
        console.log("userId", userId);
        
        const pool = await poolPromise();
        const request = pool.request();
        
        const query = `            
            SELECT userName, userType, name, email, createDate 
            FROM User_Master
            WHERE id = @id;
        `;
        
        request.input("id", userId);
        const result = await request.query(query);
        
        const user = result.recordset;

        res.status(200).json({   
            data: user,
            message: "Profile Details fetched successfully."                                   
        });
        
    } catch(error) {
        console.log("error", error);
        res.status(500).json({message: "Internal server Error"});
    }                                                                                                                                                                                                   
};


const resetpassword = async (req, res) => {

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
}
const logout= (req, res) => {
    // Set an expired cookie to force removal
    res.cookie('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      expires: new Date(0) // Set expiration to the past
    });
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  }

module.exports = {handleForgetPassword,getProfileDetail,loginCheck,resetpassword,logout}