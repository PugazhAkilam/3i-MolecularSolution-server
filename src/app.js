const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
//const { poolPromise } = require('./config/db');
//const { memo } = require('react');
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





const PORT = process.env.DB_PORT;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});