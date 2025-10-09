const { poolPromise, sql } = require('../config/db'); 



const getPatientList = async (req, res) => {
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
}

const getSelectedPatient = async (req, res) => {
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
}

const selectPatientStats = async (req, res) => {
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
}

const deletePatientId = async (req, res) => {
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
}

const patientDetailsById = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise();
        const result = await pool.request()
            .input('patientId', sql.NVarChar(), id)
            .query(`SELECT * FROM Register_Patient WHERE patientId = @patientId;`);

        if (result.recordset.length > 0) {
            res.status(200).json(result.recordset[0]);
        } else {
            res.status(404).json({ message: 'Patient not found.' });
        }
    } catch (err) {
        console.error("Error fetching patient details:", err);
        res.status(500).json({ message: "Internal server error." });
    }
}

const getMedHistoryById = async (req, res) => {
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
                FROM Appointment
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
}

const updatePatientById =  async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, age, sex, dob, city, email, height, weight, mobile, pincode, state, address1, address2 } = req.body;

    try {
        const pool = await poolPromise();
        const request = pool.request();
        const query = `
            UPDATE Register_Patient
            SET
                firstName = @firstName, lastName = @lastName, age = @age,
                sex = @sex, dob = @dob, city = @city, email = @email,
                height = @height, weight = @weight, mobile = @mobile,
                pincode = @pincode, state = @state, addressLine1 = @address1,
                addressLine2 = @address2
            WHERE patientId = @patientId;
        `;
        
        request.input("patientId", id);
        request.input("firstName", firstName);
        request.input("lastName", lastName);
        request.input("age", age);
        request.input("sex", sex);
        request.input("dob", dob);
        request.input("city", city);
        request.input("email", email);
        request.input("height", height);
        request.input("weight", weight);
        request.input("mobile", mobile);
        request.input("pincode", pincode);
        request.input("state", state);
        request.input("address1", address1);
        request.input("address2", address2);
        
        const result = await request.query(query);

        if (result.rowsAffected[0] > 0) {
            res.status(200).json({ message: "Patient updated successfully." });
        } else {
            res.status(404).json({ message: "Patient not found or no changes were made." });
        }
    } catch (err) {
        console.error("Error updating patient:", err);
        res.status(500).json({ message: "Internal server error." });
    }
}

const createConsultation = async (req, res) => {
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

   console.log("11111111");
   
   
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
            UPDATE Appointment
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
}

const createNewPatient = async (req, res) => {
    console.log("req.body",req.body);
    
    const { regId, firstName, lastName, age, sex, dob, city, email, height, weight, mobile, pincode, state, address1, address2 } = req.body;        
    try {


        if(!firstName  || !lastName || !dob || !sex || !mobile || !height || !weight){
            return res.status(400).json({ message: "All required fields are needed."});
        }
        const pool = await poolPromise();
        const request = pool.request();
        const query = `
            INSERT INTO Register_Patient(patientId, firstName, lastName, dob, sex, mobile, email, addressLine1, addressLine2, state, city, pincode, height, weight, age)
            VALUES( @patientId, @firstName, @lastName, @dob, @sex, @mobile, @email, @addressLine1, @addressLine2, @state, @city, @pincode, @height, @weight, @age);
        `;
        request.input("patientId", regId)
        request.input("firstName",firstName);
        request.input("lastName",lastName);
        request.input("age",age);
        request.input("sex",sex);
        request.input("dob",dob);
        request.input("city",city);
        request.input("email",email);
        request.input("height",height);
        request.input("weight",weight);
        request.input("mobile",mobile);
        request.input("pincode",pincode);
        request.input("state",state);
        request.input("addressLine1",address1);
        request.input("addressLine2",address2);     
        
        request.query(query);
        return res.status(200).json({
            message: "New patient registered successfully."
        });
        
    } 

    catch(err) {
        console.log("error", err);
        res.status(500).json({ message: "Internal server error"});
    }
}

const getNextPatientById = async (req, res) => {
         try {
        const pool = await poolPromise();
        const request = pool.request();

        // Corrected SQL query to sort by the numeric part of the patientId
        const lastPatientIdResult = await request
            .query(`
                SELECT TOP 1 patientId
                FROM Register_Patient
                ORDER BY CAST(SUBSTRING(patientId, 4, LEN(patientId) - 3) AS INT) DESC;
            `);

        let nextPatientId;
        if (lastPatientIdResult.recordset.length > 0) {
            const lastId = lastPatientIdResult.recordset[0].patientId;
            const lastNumberString = lastId.replace('PAT', '');
            const lastNumber = parseInt(lastNumberString, 10);
            const nextNumber = lastNumber + 1;
            nextPatientId = 'PAT' + nextNumber.toString().padStart(4, '0');
        } else {
            nextPatientId = 'PAT0001';
        }

        res.status(200).json({ nextPatientId });
        
    } catch (err) {
        console.error("Error fetching next patient ID:", err);
        res.status(500).json({ message: "Failed to generate patient ID." });
    }
}

const deletePatientById = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise();
        const request = pool.request();
        
        const query = `
            UPDATE Register_Patient
            SET activeFlag = 0
            WHERE patientId = @patientId;
        `;
        
        request.input('patientId', sql.NVarChar, id);
        
        const result = await request.query(query);

        if (result.rowsAffected[0] > 0) {
            res.status(200).json({ message: "Patient soft-deleted successfully" });
        } else {
            res.status(404).json({ message: "Patient not found or already deleted." });
        }
    } catch (err) {
        console.error("Error during patient soft-delete:", err);
        res.status(500).json({ message: "Internal server error." });
    }
}

const fetchRegisteredPatient = async ( req, res )  => {
    try {
        const pool = await poolPromise();
        const request = pool.request();
        const query = `
        
    WITH RankedAppointments AS (
    SELECT
        r.patientId AS reg_patientId,
        r.firstName,
        r.lastName,
        r.dob,
        r.sex,
        r.mobile,
        r.email,
        r.addressLine1,
        r.addressLine2,
        r.state,
        r.city,
        r.pincode,
        r.height,
        r.weight,
        r.age,
        r.activeFlag AS patientActiveFlag,
        a.id AS appointmentId,
        a.doctor,
        a.date,
        a.time,
        a.bloodPressure,
        a.pulse,
        a.respiratoryRate,
        a.stressLevel,
        a.createDate AS appointmentCreateDate,
        a.activeFlag AS appointmentActiveFlag,
        ROW_NUMBER() OVER (
            PARTITION BY r.patientId
            ORDER BY a.createDate DESC
        ) AS rn
    FROM
        Register_Patient AS r
    LEFT JOIN
        Appointment AS a ON r.patientId = a.patientId
    WHERE
        r.activeFlag = 1
)
SELECT *
FROM RankedAppointments
WHERE rn = 1 OR rn IS NULL;
        `;
        const result = await request.query(query);
        console.log("result", result);

        const users = result.recordset;

        res.status(200).json({
            data: users,
            message: "Registered Patients are fetched successfully"
        });
        
    } catch(error) {
        console.log("error",error);
        res.status(500).json({message: "Internal server Error"});
    }
}

const getPatientDetailsById =  async (req, res) => {
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
}

const getMedHistoryByIdByCategory = async (req, res) => {
  const { patientId, category } = req.params;
  console.log("Fetching medical history for patientId:", patientId, "category:", category);
  
  try {
   const pool = await poolPromise();
    const result =await pool.request()
      .input('patientId', sql.NVarChar, patientId)
      .input('category', sql.VarChar(50), category)
      .query(`
        SELECT Id, Description 
        FROM PatientMedicalHistory 
        WHERE PatientId = @patientId AND Category = @category
        ORDER BY CreatedAt DESC
      `);
    res.json({ data: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
}

const addNewMedicalHistory = async (req, res) => {
  const { patientId, category, description } = req.body;
  try {
    const pool = await poolPromise();
 await  pool.request()
      .input('patientId', sql.NVarChar, patientId)
      .input('category', sql.VarChar(50), category)
      .input('description', sql.NVarChar(500), description)
      .query(`
        INSERT INTO PatientMedicalHistory (PatientId, Category, Description) 
        VALUES (@patientId, @category, @description)
      `);
    res.json({ message: 'Added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
}

const updateMedHistory = async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;
  try {
   const pool = await poolPromise();
  await  pool.request()
      .input('id', sql.Int, id)
      .input('description', sql.NVarChar(500), description)
      .query(`
        UPDATE PatientMedicalHistory SET Description = @description, UpdatedAt = GETDATE() 
        WHERE Id = @id
      `);
    res.json({ message: 'Updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
}

const deleteMedHistory = async (req, res) => {
  const { id } = req.params;
  try {
const pool = await poolPromise();
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM PatientMedicalHistory WHERE Id = @id');
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
}

   

module.exports = {  updateMedHistory, deleteMedHistory, addNewMedicalHistory, getMedHistoryByIdByCategory, deletePatientById, getPatientDetailsById, getPatientList,fetchRegisteredPatient, getSelectedPatient, selectPatientStats, deletePatientId,createNewPatient, patientDetailsById, getNextPatientById, getMedHistoryById, updatePatientById, createConsultation}