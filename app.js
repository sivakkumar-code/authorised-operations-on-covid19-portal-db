const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializingDBandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started listening...");
    });
  } catch (err) {
    console.log(`DB error ${err.message}`);
    process.exit(1);
  }
};
initializingDBandServer();

const authenticationFunction = (req, res, next) => {
  let jwtToken;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    // token is not provided by the user or an invalid token
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY", async (error, payload) => {
      if (error) {
        // invalid token
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        // successful verification of token proceed to next middleware or handler
        req.username = payload.username;
        next();
      }
    });
  }
};

app.post("/login/", async (req, res) => {
  console.log("working...");
  const { username, password } = req.body;
  const findUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbResponseOnUser = await db.get(findUserQuery);
  if (dbResponseOnUser === undefined) {
    // unregistered user tries to login
    res.status(400);
    res.send("Invalid user");
  } else {
    const checkPassword = await bcrypt.compare(
      password,
      dbResponseOnUser.password
    );
    if (checkPassword) {
      // Successful login of the user
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRET_KEY");
      res.send({ jwtToken });
    } else {
      // user provides an incorrect password
      res.status(400);
      res.send("Invalid password");
    }
  }
});

app.get("/states/", authenticationFunction, async (req, res) => {
  const sqlQuery = `
    SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population
    FROM state;
    `;
  const dbResponse = await db.all(sqlQuery);
  res.send(dbResponse);
});

app.get("/states/:stateId/", authenticationFunction, async (req, res) => {
  const { stateId } = req.params;
  const sqlQuery = `
    SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population
    FROM state
    WHERE state_id = ${stateId};
    `;
  const dbResponse = await db.get(sqlQuery);
  res.send(dbResponse);
});

app.post("/districts/", authenticationFunction, async (req, res) => {
  console.log("working...");
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  console.log(req.body);
  const sqlQuery = `
        INSERT INTO
            district (district_name, state_id, cases, cured, active, deaths)
        VALUES 
        (
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
        );
    `;
  console.log("working///");
  const a = await db.run(sqlQuery);
  console.log(a);
  res.send("District Successfully Added");
});

app.get("/districts/:districtId/", authenticationFunction, async (req, res) => {
  const { districtId } = req.params;
  const sqlQuery = `
    SELECT 
        district_id AS districtId,
        district_name AS districtName,
        state_id AS stateId,
        cases,
        cured,
        active,
        deaths
    FROM district
    WHERE district_id = ${districtId};
    `;
  const dbResponse = await db.get(sqlQuery);
  res.send(dbResponse);
});

app.delete(
  "/districts/:districtId/",
  authenticationFunction,
  async (req, res) => {
    const { districtId } = req.params;
    const sqlQuery = `
    DELETE
    FROM district
    WHERE district_id = ${districtId};
    `;
    await db.run(sqlQuery);
    res.send("District Removed");
  }
);

// app.put("/districts/:districtId/", async (req, res) => {
//   console.log("working...");
// });

app.get("/states/:stateId/stats/", authenticationFunction, async (req, res) => {
  const { stateId } = req.params;
  const sqlQuery = `
    SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM state
        JOIN district ON state.state_id = district.state_id
    WHERE state.state_id = ${stateId}
    GROUP BY state.state_id;
    `;
  const dbResponse = await db.get(sqlQuery);
  res.send(dbResponse);
});

module.exports = app;

app.put("/districts/:districtId/", authenticationFunction, async (req, res) => {
  const { districtId } = req.params;
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  console.log(req.body);
  console.log(req.params);
  const sqlQuery = `
        UPDATE
            district
        SET
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE district_id = ${districtId};
    `;
  const a = await db.run(sqlQuery);
  console.log(a);
  res.send("District Details Updated");
});
