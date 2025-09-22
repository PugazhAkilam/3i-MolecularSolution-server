const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
//const { poolPromise } = require('./config/db');
const { memo } = require('react');
const user = require('./router/user');
const patient=require('./router/regpatient');
const appointment = require('./router/appointment');
//const sql = require('mssql');

app.use(cors());
app.use(express.json())

app.use('/api/user', user);
app.use('/api/patient', patient);
app.use('/api/appointment', appointment);

//API
// poolPromise()

const { poolPromise, sql } = require('./config/db');

app.get('/getMedhistory/:patientId', async (req, res) => {
    const { patientId } = req.params;

    if (!patientId) {
        return res.status(400).json({ message: 'Patient ID is required.' });
    }

    try {
        const pool = await poolPromise();

        // Query 1: Get patient's general medical history
        const historyResult = await pool.request()
            .input('patientId', sql.NVarChar(), patientId)
            .query(`
                SELECT ChiefComplaint, SummaryNote, PreExisting, Allergy
                FROM Register_Patient
                WHERE PatientId = @patientId;
            `);

        // Query 2: Get all prescriptions for the patient
        const prescriptionsResult = await pool.request()
            .input('patientId', sql.NVarChar(), patientId)
            .query(`
                SELECT MedicineName AS name, Dosage AS dosage, Duration AS duration, Frequency AS frequency, Notes AS notes
                FROM Prescription
                WHERE PatientId = @patientId
                ORDER BY CreateDate DESC;
            `);

        if (historyResult.recordset.length > 0) {
            const history = historyResult.recordset[0];
            const prescriptions = prescriptionsResult.recordset;

            // Parse the JSON string for pre-existing conditions
            try {
                history.PreExisting = history.PreExisting ? JSON.parse(history.PreExisting) : [];
            } catch (jsonErr) {
                console.warn(`Could not parse PreExisting for patient ${patientId}:`, jsonErr);
                history.PreExisting = []; // Default to an empty array on error
            }
            
            // Combine all data into a single object
            const responseData = {
                ...history,
                prescriptions: prescriptions
            };

            res.status(200).json(responseData);
        } else {
            res.status(404).json({ message: 'No medical history found for this patient.' });
        }
    } catch (err) {
        console.error("Database query error:", err);
        res.status(500).json({ message: 'Failed to retrieve medical history and prescriptions.', error: err.message });
    }
});

app.post('/saveConsultation', async (req, res) => {
    const {
        patientId,
        appointmentId,
        chiefComplaint,
        summaryNote,
        preExistingProblems,
        allergy,
        prescriptions
    } = req.body;
   console.log("req.body", req.body);
   
    if (!patientId || !appointmentId) {
        return res.status(400).json({ message: 'Patient ID and Appointment ID are required.' });
    }

    let pool;
    let transaction;

    try {
        pool = await poolPromise();
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        // 1. Update the Patient's table with consultation notes
        const patientUpdateQuery = `
            UPDATE Register_Patient
            SET ChiefComplaint = @chiefComplaint,
                SummaryNote = @summaryNote,
                PreExisting = @preExistingProblems,
                Allergy = @allergy
            WHERE patientId= @patientId;
        `;

        await new sql.Request(transaction)
            .input('chiefComplaint', sql.NVarChar(sql.MAX), chiefComplaint || null)
            .input('summaryNote', sql.NVarChar(sql.MAX), summaryNote || null)
            .input('preExistingProblems', sql.NVarChar(sql.MAX), JSON.stringify(preExistingProblems))
            .input('allergy', sql.NVarChar(sql.MAX), allergy || null)
            .input('patientId', sql.NVarChar(), patientId)
            .query(patientUpdateQuery);

        console.log(`Updated Patient ID: ${patientId}`);
     
               // --- NEW: Delete existing prescriptions for this appointment ---
        const prescriptionDeleteQuery = `
            DELETE FROM Prescription
            WHERE AppointmentId = @appointmentId;
        `;
        await new sql.Request(transaction)
            .input('appointmentId', sql.Int, appointmentId)
            .query(prescriptionDeleteQuery);

        console.log(`Deleted existing prescriptions for Appointment ID: ${appointmentId}`);
        
        // 2. Insert into the Prescription table for each prescription
        if (prescriptions && prescriptions.length > 0) {
            const prescriptionInsertQuery = `
                INSERT INTO Prescription (AppointmentId, PatientId, MedicineName, Dosage, Duration, Frequency, Notes)
                VALUES (@appointmentId, @patientId, @medicineName, @dosage, @duration, @frequency, @notes);
            `;

            for (const prescription of prescriptions) {
                await new sql.Request(transaction)
                    .input('appointmentId', sql.Int, appointmentId)
                    .input('patientId', sql.NVarChar(15), patientId)
                    .input('medicineName', sql.NVarChar(255), prescription.name)
                    .input('dosage', sql.NVarChar(100), prescription.dosage)
                    .input('duration', sql.NVarChar(100), prescription.duration)
                    .input('frequency', sql.NVarChar(100), prescription.frequency)
                    .input('notes', sql.NVarChar(sql.MAX), prescription.notes)
                    .query(prescriptionInsertQuery);
            }
            console.log(`Inserted ${prescriptions.length} new prescriptions.`);
        }

        await transaction.commit();
        res.status(200).json({ message: 'Consultation data and prescriptions saved successfully!' });

    } catch (err) {
        if (transaction) {
            try {
                await transaction.rollback();
                console.log("Transaction rolled back.");
            } catch (rollbackErr) {
                console.error("Rollback failed:", rollbackErr);
            }
        }
        console.error("Error during save operation:", err);
        res.status(500).json({ message: 'Failed to save data.', error: err.message });
    }
});
app.put('/api/editAppointment/:id', async (req, res) => {
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
});
app.get('/dashboard/patients-stats', async (req, res) => {
  try {
    const pool = await poolPromise();

    const totalPatientsQuery = 'SELECT COUNT(*) AS totalPatients FROM Register_Patient';
    const newPatientsQuery = `
      SELECT COUNT(*) AS newPatientsThisMonth 
      FROM Register_Patient 
      WHERE createOn >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0)
    `;
    const patientsAgeQuery = 'SELECT age FROM Register_Patient WHERE age IS NOT NULL';

    const [totalPatientsResult, newPatientsResult, patientsAgeResult] = await Promise.all([
      pool.request().query(totalPatientsQuery),
      pool.request().query(newPatientsQuery),
      pool.request().query(patientsAgeQuery),
    ]);

    res.json({
      totalPatients: totalPatientsResult.recordset[0].totalPatients,
      newPatientsThisMonth: newPatientsResult.recordset[0].newPatientsThisMonth,
      patients: patientsAgeResult.recordset,
    });
  } catch (error) {
    console.error('Error in /dashboard/patients-stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/dashboard/todays-appointments', async (req, res) => {
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
});


app.post('/api/login', async (req, res) => {
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
            SELECT userName, password FROM User_Master
            WHERE userName = @userName;
        `;

        const result = await request.query(query);
        console.log("checkUserResult:", result);

        if (result.recordset.length === 0) {
            return res.status(400).json({ message: "User not found" });
        }

        const user = result.recordset[0];

        // For now, just compare raw passwords
        // TODO: Use bcrypt to hash and compare passwords securely
        if (user.password !== password) {
            return res.status(401).json({ message: "Invalid password" });
        }

        return res.status(200).json({
            data: user,
            message: "Login successful"
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Internal server error" });
    }   
});




app.post('/api/appointment', async (req, res) => {
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
});
// app.get('/api/appointment', async ( req, res ) => {
//     try{
//     const pool = await poolPromise();
//     const request = pool.request();

//     const query = `
//     SELECT * FROM Appointment as a
//     JOIN Register_Patient as r
//     ON a.patientId = r.patientId;`;

//     const result = await request.query(query);
//     // console.log("result", result);
//     const user = result.recordset;

//     res.status(200).json({
//         message: "Data fetched from appointment table successfully.",
//         data: user
//     });
//     }

//     catch(err) {
//         console.log("error",err);
//         res.status(500).json({message: "Internal server error"});
//     }
// });


//New patient registration form - POST



//Registered patient count


app.get('/api/selectedPatient/:id', async (req, res) => {
    const {id} = req.params;
    try {
        const pool = await poolPromise();
        const request = pool.request();
        const query = `
            SELECT * FROM Register_Patient as r
            JOIN Appointment as a
            ON r.patientId = a.patientId
            WHERE a.patientId = @id;
        `;
        request.input("id", id);
        const result = await request.query(query);
        const user = result.recordset;
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

app.get('/api/patientDetails/:id', async (req, res) => {
    const {id} = req.params;
    try {
        const pool = await poolPromise();
        const request = pool.request();
        const query = `
            SELECT * FROM Register_Patient 
            WHERE patientId = @id;
        `;
        request.input("id", id);
        const result = await request.query(query);
        const user = result.recordset;
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

app.get('/api/appointmentDetails/:id', async (req, res) => {
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



//patient list - appointmnet
// app.get('/api/patientList', async (req, res) => {
//     try {
//         const pool = await poolPromise();
//         const request = pool.request();
//         const query = `
//            SELECT a.patientId,r.firstName,r.lastName,r.mobile,r.age,doctor,a.bloodPressure,a.pulse,a.respiratoryRate
//            FROM Appointment as a
//            JOIN Register_Patient as r
//            ON a.patientId = r.patientId
//            WHERE a.activeFlag = 1
//            ;
//            `;
    
//         const result = await request.query(query);
//         console.log("result", result);
//         const user = result.recordset;
//         return res.status(200).json({
//             message: "Patient List fetched successfully.",
//             data: user
//         });
//     } catch(err) {
//         console.log("error", err);
//         res.status(500).json({ message: "Internal server error"});
//     }
// });
app.get('/api/patientList', async (req, res) => {
  try {
    const pool = await poolPromise();
    const request = pool.request();

    // Get optional date from query string, default to today's date
    // Expecting date in 'YYYY-MM-DD' format
    const filterDate = req.query.date || new Date().toISOString().slice(0, 10);


     console.log("filterDate", filterDate);
     
    // Add date parameter to SQL request to avoid SQL injection
    request.input('filterDate', sql.Date, filterDate);

    const query = `
      SELECT a.id as appointmentId,a.date,a.time as times,a.patientId, r.firstName, r.lastName, r.mobile, r.age, doctor,r.sex,r.email,r.addressLine1,
             a.createDate, a.bloodPressure, a.pulse, a.respiratoryRate,a.stressLevel,r.height,r.weight
      FROM Appointment AS a
      JOIN Register_Patient AS r
        ON a.patientId = r.patientId
      WHERE a.activeFlag = 1
        AND CAST(a.date AS DATE) = @filterDate
        ORDER BY a.createDate DESC
    `;

    const result = await request.query(query);
    const user = result.recordset;

    return res.status(200).json({
      message: "Patient List fetched successfully.",
      data: user
    });
  } catch (err) {
    console.log("error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE appointment
app.delete('/api/deleteAppointment/:id', async (req, res) => {
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
});

//DELETE Patient
app.delete('/api/deletePatient:id', async (req, res) => {
    const {id} = req.params;
    try {
        const pool = await poolPromise();
        const request = pool.request();
        const query = `
         UPDATE Register_Patient
			SET activeFlag = 0
			WHERE patientId = @id;
           `;
        request.input('id', id);
        await request.query(query);

        res.status(200).json({ message: "Patient deleted successfully" })
    } catch(err) {
        console.log("error", err);
        res.status(500).json({ message: "Internal server error"});
    }
});

app.put('/api/editAppointment/:id', async (req, res) => {
    const {id} = req.params;
    const {doctor, date, time, bloodPressureAsString, pulseAsString,respiratoryRateAsString,stressLevelAsString} = req.body;
    console.log("1");
    
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
    createDate = getDate(),
    updateDate = getDate()
    WHERE patientId = @id;
    ;
           `;
           request.input('id', id)
            request.input('doctor', sql.NVarChar, doctor)
            request.input('date', sql.DateTime, date)
            request.input('time', sql.NVarChar, time)
            request.input('bloodPressure', sql.NVarChar, bloodPressureAsString)
            request.input('pulse', sql.NVarChar, pulseAsString)
            request.input('respiratoryRate', sql.NVarChar, respiratoryRateAsString)
            request.input('stressLevel', sql.NVarChar, stressLevelAsString)
           
        const result =  await request.query(query);
        console.log("result", result);
        
        res.status(200).json({ message: "Appointment updated successfully"
         })

    }
    catch(err) {
        console.log("/api/editAppointment/id", err);
        res.status(500).json({ message: "Internal server error"});
    }
});


const PORT = process.env.DB_PORT;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});