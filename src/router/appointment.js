// routes/appointment.js

const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../config/db'); // Adjust path as needed

// GET /api/appointment/withPatientDetails
router.get('/visitDetails', async (req, res) => {
    try {
        const pool = await poolPromise();
        
        const query = `
            SELECT 
                a.*,
                r.firstName,
                r.lastName,
                r.mobile,
                r.age
            FROM 
                Appointment AS a
            JOIN 
                Register_Patient AS r ON a.patientId = r.patientId
            WHERE 
                a.pulse IS NOT NULL
            ORDER BY 
                a.updateDate DESC;
        `;
        
        const result = await pool.request().query(query);

        res.status(200).json({
            message: "Appointments with patient details fetched successfully.",
            data: result.recordset
        });

    } catch (err) {
        console.error("Error fetching data with patient details:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});
router.get('/appointmentDetails/:id', async (req, res) => {
    const {id} = req.params;
    try {
        const pool = await poolPromise();
        const request = pool.request();
        const query = `
           SELECT * FROM Appointment
WHERE patientId = @id
ORDER BY createDate DESC;
        `;
        request.input("id", id);
        const result = await request.query(query);
        const user = result.recordset[0];
        console.log(result.recordset[0]);
        
        return res.status(200).json(
            {
                message: "Details fetched from DB",
                data: user
            }
        );        
    } catch(err) {
        console.log("error", err);      
        res.status(500).json({ message: "Internal server error."});
    }
});

module.exports = router;