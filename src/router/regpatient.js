const express = require('express');
const router = express.Router();
const { addNewMedicalHistory, deleteMedHistory, updateMedHistory, getMedHistoryByIdByCategory, getPatientDetailsById ,fetchRegisteredPatient, getPatientList, getSelectedPatient, selectPatientStats, deletePatientId,deletePatientById, patientDetailsById, getMedHistoryById, updatePatientById, createConsultation, createNewPatient, getNextPatientById } = require('../controller/regPatientController');



router.post('/saveConsultation', createConsultation);

router.get('/patientList', getPatientList);

router.get('/selectedPatient/:id', getSelectedPatient);



router.get('/dashboard/patients-stats', selectPatientStats);

//DELETE Patient
router.delete('/deletePatient:id', deletePatientId);
// New GET endpoint to fetch a patient's details by ID
router.get('/getPatientDetails/:id', patientDetailsById);

router.get('/getMedhistory/:patientId', getMedHistoryById);

// New PUT endpoint to update a patient's details
router.put('/updatePatient/:id', updatePatientById);
router.post('/newPatientRegistration', createNewPatient);

router.get('/getNextPatientId', getNextPatientById);
// DELETE /api/deletePatient/:id
router.delete('/deletePatient/:id', deletePatientById);
router.get('/registeredPatients', fetchRegisteredPatient);


router.get('/patientDetails/:id', getPatientDetailsById);
// Get medical history items for a patient and category
router.get('/medicalHistory/:patientId/:category', getMedHistoryByIdByCategory);

// Add a new medical history item
router.post('/medicalHistory', addNewMedicalHistory);

// Update an existing medical history item
router.put('/medicalHistory/:id', updateMedHistory);

// Delete a medical history item
router.delete('/medicalHistory/:id', deleteMedHistory);
// ... (existing routes like newPatientRegistration, getNextPatientId, etc.)



module.exports = router;