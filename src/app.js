const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
//const { poolPromise } = require('./config/db');
const { memo } = require('react');
const user = require('./router/user');


app.use(cors());
app.use(express.json())

app.use('/api/user', user);

//API
// poolPromise()

const { poolPromise, sql } = require('./config/db');

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

app.get('/api/registeredPatients', async ( req, res )  => {
    try {
        const pool = await poolPromise();
        const request = pool.request();
        const query = `
        
	WITH RankedAppointments AS (
    SELECT 
        r.userId,
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
        r.activeFlag AS patientActiveFlag,      --  alias added

        a.id AS appointmentId,
        a.patientId AS app_patientId,
        a.doctor,
        a.date,
        a.time,
        a.bloodPressure,
        a.pulse,
        a.respiratoryRate,
        a.stressLevel,
        a.createDate,
        a.updateDate,
        a.activeFlag AS appointmentActiveFlag,  --  alias added

        ROW_NUMBER() OVER (
            PARTITION BY a.patientId 
            ORDER BY a.createDate DESC
        ) AS rn
    FROM 
        Register_Patient AS r
    JOIN 
        Appointment AS a 
    ON 
        a.patientId = r.patientId
    WHERE 
        r.activeFlag = 1 
)
SELECT *
FROM RankedAppointments
WHERE rn = 1;

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


app.post('/api/appointment', async (req, res) => {
    console.log("req.body", req.body);
    const { date, time, doctor, patient,pulse,bloodPressure,respiratoryRate,stressLevel } = req.body;
    
    console.log(typeof pulse,typeof bloodPressure,typeof respiratoryRate,typeof stressLevel);
    
    // Extract patient details from the nested object
    const { regId: patientId } = patient;
    
 let pulseAsString = String(pulse);
    let respiratoryRateAsString = String(respiratoryRate);
    let stressLevelAsString = String(stressLevel);
    let bloodPressureAsString = String(bloodPressure);
    
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
            .input('bloodPressure', sql.NVarChar, bloodPressureAsString)
            .input('pulse', sql.NVarChar, pulseAsString)
            .input('respiratoryRate', sql.NVarChar, respiratoryRateAsString)
            .input('stressLevel', sql.NVarChar, stressLevelAsString)
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

app.post('/api/newPatientRegistration', async (req, res) => {
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

//Registered patient count
app.get('/api/registeredPatientCount',async (req, res) => {
    try {        
        const pool = await poolPromise();
        const request = pool.request();
        const query = `SELECT COUNT(*) FROM Register_Patient;`;
        const result = await request.query(query);
        console.log("result", result);
        const count = result.recordset[0][''];
        
        return res.status(200).json({
            message: "Total count of Registered patient.",
            count: count
        });
        
    } catch(err) {
        console.log("error",err);
        res.status(500).json({ message: "Internal server error"});
    }
});

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
      SELECT a.patientId, r.firstName, r.lastName, r.mobile, r.age, doctor,
             a.createDate, a.bloodPressure, a.pulse, a.respiratoryRate
      FROM Appointment AS a
      JOIN Register_Patient AS r
        ON a.patientId = r.patientId
      WHERE a.activeFlag = 1
        AND CAST(a.createDate AS DATE) = @filterDate
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
app.delete('/api/deleteAppointment:id', async (req, res) => {
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


const PORT = process.env.DB_PORT;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});