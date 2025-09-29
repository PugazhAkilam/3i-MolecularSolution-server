const { poolPromise, sql } = require('../config/db'); 


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

module.exports = {handleForgetPassword}