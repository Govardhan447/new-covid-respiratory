const express = require('express')

const app = express()
app.use(express.json())
const path = require('path')
const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

let db = null
const initilizeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Running server on http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB error:${e.message}`)
    process.exit(1)
  }
}

initilizeDBAndServer()

const convertDBobjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}
const convertDBobjectToResponseObject1 = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}
const authenticationToken = async (request, response, next) => {
  let jwtToken
  const authHeaders = request.headers['authorization']
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(' ')[1]
  }
  if (jwtToken == undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'myscreatePassword', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

app.post('/login', async (request, response) => {
  const {username, password} = request.body

  const getUserName = `SELECT * FROM user WHERE  username ="${username}";`
  const dbUser = await db.get(getUserName)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const checkPassword = await bcrypt.compare(password, dbUser.password)
    console.log(checkPassword)
    if (checkPassword === false) {
      response.status(400)
      response.send('Invalid password')
    } else {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'myscreatePassword')
      response.send({jwtToken})
    }
  }
})

//Autrization Token

app.get('/states/', authenticationToken, async (request, response) => {
  const getStatesDetails = `
        SELECT * FROM state ;`
  const dbRespones = await db.all(getStatesDetails)
  response.send(
    dbRespones.map(eachItem => convertDBobjectToResponseObject(eachItem)),
  )
})

//GET  StateID list API2

app.get('/states/:stateId/', authenticationToken, async (request, response) => {
  const {stateId} = request.params
  const getStateDetails = `
    SELECT
      *
    FROM
        state
    WHERE 
        state_id = ${stateId};`
  const dbResponse = await db.all(getStateDetails)
  const result = dbResponse.map(eachState =>
    convertDBobjectToResponseObject(eachState),
  )
  response.send(result[0])
})

// POST create District Details API3

app.post('/districts/', authenticationToken, async (request, response) => {
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  const createDistrictDetails = `
  INSERT INTO
    district (district_name, state_id, cases, cured, active,deaths)
  VALUES (
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
  );`
  const dbResponse = await db.run(createDistrictDetails)
  response.send('District Successfully Added')
})

// GET districtId details API4

app.get(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictDetails = `
  SELECT
  *
  FROM
    district
  WHERE
    district_id = ${districtId};`
    const dbResponse = await db.all(getDistrictDetails)
    const result = dbResponse.map(eachitem =>
      convertDBobjectToResponseObject1(eachitem),
    )
    response.send(result[0])
  },
)
//DELETE DistrictId API 5

app.delete(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictDetails = `
  DELETE FROM
    district
  WHERE 
    district_id = ${districtId};`
    const dbResponse = await db.all(deleteDistrictDetails)
    response.send('District Removed')
  },
)

// PUT update District Details API 6

app.put(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const districtDetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      districtDetails
    const updateDistricDetails = `
  UPDATE
    district
  SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths =${deaths}
  ;`
    const dbResponse = await db.run(updateDistricDetails)
    response.send('District Details Updated')
  },
)

// GET State Status API 7

app.get(
  '/states/:stateId/stats/',
  authenticationToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStateStatusDetails = `
  SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths) 
  FROM 
      district
  WHERE
    state_id = ${stateId}
  ;`

    const dbResponse = await db.get(getStateStatusDetails)

    response.send({
      totalCases: dbResponse['SUM(cases)'],
      totalCured: dbResponse['SUM(cured)'],
      totalActive: dbResponse['SUM(active)'],
      totalDeaths: dbResponse['SUM(deaths)'],
    })
  },
)

module.exports = app