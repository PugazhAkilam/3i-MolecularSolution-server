// routes/appointment.js

const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../config/db'); // Adjust path as needed
const { createAppointment, getTodayAppointments, removeAppointment, updateAppointment, getAppointmentsData, getVisitDetails, getVisitDetails2,getAppointment} = require('../controller/appointmentController');

router.post('/createAppointment', createAppointment);

router.get('/dashboard/todays-appointments', getTodayAppointments);

// DELETE appointment
router.delete('/deleteAppointment/:id', removeAppointment);

router.put('/editAppointment/:id', updateAppointment);

// GET /api/appointment/withPatientDetails
router.get('/visitDetails', getVisitDetails);

router.get('/visitDetails2/:id', getVisitDetails2);


router.get('/appointmentDetails/:id', getAppointmentsData);

router.get('/getappointment/:id', getAppointment);

module.exports = router;