
const { poolPromise, sql } = require('../config/db'); 

const createAppointment = async (req, res) => {
    console.log("req.body", req.body);
    const { date, time, doctor, patient,pulse,bloodPressure,respiratoryRate,stressLevel } = req.body;
    
    console.log(typeof pulse,typeof bloodPressure,typeof respiratoryRate,typeof stressLevel);
    
    // Extract patient details from the nested object
    const { regId: patientId } = patient;
const safeValue = (val) => (val === undefined || val === "" ? null : val);

// let pulseAsString = safeValue(pulse);
// let respiratoryRateAsString = safeValue(respiratoryRate);
let stressLevelAsString = safeValue(stressLevel);
let bloodPressureAsString = safeValue(bloodPressure);

     const pulseAsString = pulse ? String(pulse) : null;
    const respiratoryRateAsString = respiratoryRate ? String(respiratoryRate) : null; 
    // Get current timestamps
    const createDate = new Date().toISOString();
    const updateDate = new Date().toISOString();
    
    const activeFlag = 1; // Assuming 1 means active

    try {
        const pool = await poolPromise();
        
        const result = await pool.request()
            .input('patientId', sql.NVarChar, patientId)
            .input('doctor', sql.NVarChar, doctor)
            .input('date', sql.DateTime, date)
            .input('time', sql.NVarChar, time)
            .input('bloodPressure', sql.NVarChar, bloodPressure)
            .input('pulse', sql.NVarChar, pulseAsString)
            .input('respiratoryRate', sql.NVarChar, respiratoryRateAsString)
            .input('stressLevel', sql.NVarChar, stressLevel)
            .input('createDate', sql.DateTime, createDate)
            .input('updateDate', sql.DateTime, updateDate)
            .input('activeFlag', sql.Int, activeFlag)
            .query(`
                INSERT INTO [dbo].[Appointment] (
                    patientId, doctor, date, time, bloodPressure, pulse,
                    respiratoryRate, stressLevel
                )
                VALUES (
                    @patientId, @doctor, @date, @time, @bloodPressure, @pulse,
                    @respiratoryRate, @stressLevel
                )
            `);
        
        // Log the result and send a success response
        console.log("Insert result:", result);
        res.status(201).json({ message: "Appointment created successfully" });

    } catch (err) {
        console.error("error", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

const getTodayAppointments = async (req, res) => {
  try {
    const pool = await poolPromise();

    const todaysAppointmentsQuery = `
      SELECT COUNT(*) AS todaysAppointments 
      FROM Appointment 
      WHERE activeflag = 1 AND CAST(date AS DATE) = CAST(GETDATE() AS DATE)
    `;

    const appointmentsByDoctorQuery = `
      SELECT doctor, COUNT(*) AS count 
      FROM Appointment 
      WHERE activeflag = 1
      GROUP BY doctor
    `;

    const todaysAppointmentsResult = await pool.request().query(todaysAppointmentsQuery);
    const appointmentsByDoctorResult = await pool.request().query(appointmentsByDoctorQuery);

    console.log('Todays Appointments:', todaysAppointmentsResult.recordset[0].todaysAppointments);
    console.log('Appointments by Doctor:', appointmentsByDoctorResult.recordset);

    res.json({
      todaysAppointments: todaysAppointmentsResult.recordset[0].todaysAppointments,
      appointmentsByDoctor: appointmentsByDoctorResult.recordset,
    });
  } catch (error) {
    console.error('Error in /dashboard/todays-appointments:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

const removeAppointment = async (req, res) => {
    const {id} = req.params;  
    console.log("id", id);
      
    try {
        const pool = await poolPromise();
        const request = pool.request();
        const query = `
         UPDATE Appointment
            SET activeFlag = 0
            where patientId = @id;
           `;
        request.input('id', id);
        await request.query(query);

        res.status(200).json({ message: "Product deleted successfully" })

    } catch(err) {
        console.log("error", err);
        res.status(500).json({ message: "Internal server error"});
    }
}

const updateAppointment = async (req, res) => {
    const { id } = req.params;
    const {
        doctor,
        date,
        time,
        bloodPressure,
        pulse,
        respiratoryRate,
        stressLevel
    } = req.body;

    console.log("req.body", req.body);
  const pulseAsString = pulse ? String(pulse) : null;
    const respiratoryRateAsString = respiratoryRate ? String(respiratoryRate) : null;
    try {
        const pool = await poolPromise();
        const request = pool.request();

        const query = `
           UPDATE Appointment
           SET doctor = @doctor,
               date = @date,
               time = @time,
               bloodPressure = @bloodPressure,
               pulse = @pulse,
               respiratoryRate = @respiratoryRate,
               stressLevel = @stressLevel,
               updateDate = GETDATE()
           WHERE id = @id;
        `;

        // The key fix is here:
        // Explicitly check if the value is a string before passing it.
        // If not, convert it or set it to null.
        request.input('id', sql.Int, id); // Assuming ID is an integer
        request.input('doctor', sql.NVarChar, doctor || null);
        request.input('date', sql.DateTime, date || null);
        request.input('time', sql.NVarChar, time || null);

        // Robust handling for potentially problematic values
        request.input('bloodPressure', sql.NVarChar, typeof bloodPressure === 'string' ? bloodPressure : null);
    request.input('pulse', sql.NVarChar, pulseAsString);
        request.input('respiratoryRate', sql.NVarChar, respiratoryRateAsString);
        request.input('stressLevel', sql.NVarChar, typeof stressLevel === 'string' ? stressLevel : null);

        const result = await request.query(query);
        console.log("result", result);

        if (result.rowsAffected[0] > 0) {
            res.status(200).json({ message: "Appointment updated successfully" });
        } else {
            res.status(404).json({ message: "Appointment not found or no changes were made." });
        }
    }
    catch (err) {
        console.error("/api/editAppointment/id", err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
}

const getVisitDetails =  async (req, res) => {
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
}

const getAppointmentsData =  async (req, res) => {
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
}
module.exports = { createAppointment, getTodayAppointments , removeAppointment, updateAppointment, getAppointmentsData, getVisitDetails}