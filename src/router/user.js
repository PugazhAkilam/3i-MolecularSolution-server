const express = require('express');
const router = express.Router();
const { handleForgetPassword ,loginCheck,getProfileDetail ,resetpassword,logout} = require('../controller/userController');
const authMiddleware = require('../middleware/auth');


// Endpoint to handle "Forgot Password" request
// Endpoint to handle "Forgot Password" request
router.post('/forgot-password', handleForgetPassword);

router.post('/login', loginCheck );
router.post('/logout', logout );
router.get('/me', authMiddleware ,getProfileDetail);
// Endpoint to handle "Forgot Password" request


// Endpoint to handle "Reset Password" request with a valid token
router.post('/reset-password',resetpassword );

module.exports = router;