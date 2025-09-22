const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../config/db');

// New GET endpoint to fetch a patient's details by ID
router.get('/getPatientDetails/:id', async (req, res) => {
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
});

// New PUT endpoint to update a patient's details
router.put('/updatePatient/:id', async (req, res) => {
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
});
router.post('/newPatientRegistration', async (req, res) => {
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
});

router.get('/getNextPatientId',async (req, res) => {
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
});
// DELETE /api/deletePatient/:id
router.delete('/deletePatient/:id', async (req, res) => {
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
});
router.get('/registeredPatients', async ( req, res )  => {
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
});


router.get('/patientDetails/:id', async (req, res) => {
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
// Get medical history items for a patient and category
router.get('/medicalHistory/:patientId/:category', async (req, res) => {
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
});

// Add a new medical history item
router.post('/medicalHistory', async (req, res) => {
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
});

// Update an existing medical history item
router.put('/medicalHistory/:id', async (req, res) => {
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
});

// Delete a medical history item
router.delete('/medicalHistory/:id', async (req, res) => {
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
});
// ... (existing routes like newPatientRegistration, getNextPatientId, etc.)

module.exports = router;