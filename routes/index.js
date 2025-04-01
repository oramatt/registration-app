const express = require('express');
const mongoose = require('mongoose');
const { check, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const auth = require('http-auth');

const router = express.Router();
const Registration = mongoose.model('Registration');

// Not needed for local deploy
const basic = auth.basic({
  file: path.join(__dirname, '../users.htpasswd'),
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Enable MongoDB command monitoring
mongoose.connection.on('commandStarted', (event) => {
  console.log('Command Started:', JSON.stringify(event, null, 2));
});

// Middleware to log rendered HTML
router.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function (body) {
    console.log('Rendered HTML:', body);
    return originalSend.apply(this, arguments);
  };
  next();
});

// Load the main registration form
router.get('/', (req, res) => {
  console.log('Registration page loaded');
  res.render('form', { title: 'Registration form' });
});

// Post for the main registration form
router.post('/',
  upload.single('image'), // Handle single file upload with field name 'image'
  [
    check('name')
      .isLength({ min: 1 })
      .withMessage('Please enter a name'),
    check('email')
      .isLength({ min: 1 })
      .withMessage('Please enter an email'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    console.log(req.body);
    if (req.file) {
      console.log('Image uploaded:', req.file.originalname);
    } else {
      console.log('No image uploaded');
    }

    if (errors.isEmpty()) {
      const registrationData = {
        name: req.body.name,
        email: req.body.email,
        notes: req.body.notes,
        image: req.file ? req.file.buffer.toString('base64') : null // Convert image to Base64
      };
      const registration = new Registration(registrationData);
      registration.save()
        .then(() => { 
          console.log('Registration successful');
          res.send('Thank you for your registration!'); 
        })
        .catch((err) => {
          console.log('Error saving registration:', err);
          res.send('Sorry! Something went wrong.');
        });
    } else {
      console.log('Validation errors:', errors.array());
      res.render('form', {
        title: 'Registration form',
        errors: errors.array(),
        data: req.body,
      });
    }
  }
);

// Route for displaying all registrations
router.get('/registrations', async (req, res) => {
  let errors = {};
  let domainCounts = [];
  let registrations = [];
  let totalCount = 0;
  let totalPages = 0;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const searchQuery = req.query.search || '';

  console.log('Registrations page loaded');
  console.log('Page:', page, 'Limit:', limit, 'Search query:', searchQuery);

  // Define the SQL variable in the appropriate scope
  let sql = '';

  // MongoDB aggregation pipeline
  try {
    const pipeline = [
      {
        $project: {
          email: 1,
          domain: { $arrayElemAt: [{ $split: ["$email", "@"] }, 1] }
        }
      },
      {
        $group: {
          _id: "$domain",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];

    console.log('Running MongoDB aggregation pipeline:', JSON.stringify(pipeline, null, 2));
    domainCounts = await Registration.aggregate(pipeline);
    console.log('MongoDB aggregation results:', JSON.stringify(domainCounts, null, 2));
  } catch (err) {
    console.log('Error loading domain counts with MongoDB aggregation:', err);
    // Fallback to SQL for Oracle MongoDB API
    try {
      console.log('Falling back to Oracle API for MongoDB $sql aggregation.');
      sql = `
        SELECT JSON_OBJECT(
          'domain' VALUE SUBSTR(email, INSTR(email, '@') + 1),
          'count' VALUE COUNT(*)
        ) AS json_result
        FROM registrations
        NESTED DATA COLUMNS (email)
        GROUP BY SUBSTR(email, INSTR(email, '@') + 1)
        ORDER BY COUNT(*) DESC
      `;

      console.log('Running SQL:', sql);

      const results = await Registration.aggregate([
        {
          $sql: {
            statement: sql
          }
        }
      ]);

      // Parse the JSON results
      domainCounts = results.map(result => {
        try {
          const parsed = JSON.parse(result.DATA);
          return { _id: parsed.domain, count: parsed.count }; // Match _id field with MongoDB
        } catch (e) {
          console.error('Error parsing JSON result:', result.DATA, e);
          return null;
        }
      }).filter(result => result !== null);
    } catch (sqlErr) {
      console.log('Error loading domain counts with Oracle API for MongoDB $sql aggregation:', sqlErr);
      console.log('Executed SQL:', sql);
      errors.domainCounts = 'Error loading domain counts';
    }
  }

  // Fetch all registrations
  try {
    registrations = await Registration.find().skip(skip).limit(limit);
    totalCount = await Registration.countDocuments();
    totalPages = Math.ceil(totalCount / limit);
  } catch (err) {
    console.error('Error loading registrations:', err);
    errors.registrations = 'Error loading registrations';
  }

  // Apply search if searchQuery is present
  if (searchQuery) {
    try {
      const searchRegex = new RegExp(searchQuery, 'i'); // Case-insensitive search
      registrations = await Registration.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { notes: { $regex: searchRegex } },
          { city: { $regex: searchRegex } }
        ]
      }).skip(skip).limit(limit);

      totalCount = await Registration.countDocuments({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { notes: { $regex: searchRegex } },
          { city: { $regex: searchRegex } }
        ]
      });

      totalPages = Math.ceil(totalCount / limit);
    } catch (err) {
      console.error('Error loading search results:', err);
      errors.registrations = 'Error loading search results';
    }
  }

  res.render('index', { 
    title: 'Listing ALL registrations', 
    registrations, 
    totalCount, 
    domainCounts: domainCounts.length ? domainCounts : null, // Only pass if domainCounts are available
    currentPage: page, 
    totalPages, 
    limit,
    searchQuery, // Pass searchQuery to the template
    errors // Pass errors to the template
  });
});

// Route to handle delete registration
router.post('/registrations/delete/:id', async (req, res) => {
  try {
    await Registration.findByIdAndDelete(req.params.id);
    console.log(`Registration with id ${req.params.id} deleted`);
    res.redirect('/registrations');
  } catch (err) {
    console.error('Error deleting registration:', err);
    res.send('Sorry! Something went wrong.');
  }
});

// Route to render the update form
router.get('/registrations/update/:id', async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    res.render('update', { title: 'Update Registration', registration });
  } catch (err) {
    console.error('Error fetching registration for update:', err);
    res.send('Sorry! Something went wrong.');
  }
});

// Route to handle update registration
router.post('/registrations/update/:id', upload.single('image'), async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      email: req.body.email,
      notes: req.body.notes,
      image: req.file ? req.file.buffer.toString('base64') : null
    };
    await Registration.findByIdAndUpdate(req.params.id, updateData);
    console.log(`Registration with id ${req.params.id} updated`);
    res.redirect('/registrations');
  } catch (err) {
    console.error('Error updating registration:', err);
    res.send('Sorry! Something went wrong.');
  }
});

// Route to handle deleteAll 
router.post('/registrations/deleteAll', async (req, res) => {
  try {
    await Registration.deleteMany({});
    console.log('All registrations deleted');
    res.redirect('/registrations');
  } catch (err) {
    console.error('Error deleting registrations:', err);
    res.send('Sorry! Something went wrong.');
  }
});

// Route to handle test page for sanity checks
router.get('/test', async (req, res) => {
  let sysdateResult = '';
  let mongoDateResult = '';
  let mongoConnectionStatus = 'Disconnected';
  let oracleConnectionStatus = 'Disconnected';

  // Get the current datetime from MongoDB
  try {
    const mongoResult = await mongoose.connection.db.command({ serverStatus: 1 });
    if (mongoResult && mongoResult.localTime) {
      mongoDateResult = mongoResult.localTime.toISOString();
      console.log('MongoDB datetime:', JSON.stringify(mongoDateResult));
      mongoConnectionStatus = 'Connected';
      // Get the total count of registrations from MongoDB
      mongoCount = await Registration.countDocuments();
    } else {
      mongoDateResult = 'No result from MongoDB query';
    }
  } catch (mongoErr) {
    console.log('Error executing MongoDB query:', mongoErr);
    mongoDateResult = 'Error executing MongoDB query';
  }

  // Get the current datetime from Oracle DB
  try {
    const sql = 'SELECT JSON_OBJECT(\'sysdate\' VALUE TO_CHAR(sysdate, \'YYYY-MM-DD HH24:MI:SS\')) AS json_result FROM dual';
    console.log('Running SQL:', sql);

    const results = await Registration.aggregate([
      {
        $sql: {
          statement: sql
        }
      }
    ]);

    console.log('SQL Results:', results);
    
    if (results.length > 0 && results[0].DATA) {
      const parsedResult = JSON.parse(results[0].DATA);
      sysdateResult = parsedResult.sysdate;
      console.log('Oracle datetime:', JSON.stringify(sysdateResult));
      oracleConnectionStatus = 'Connected';
    } else {
      sysdateResult = 'No result from SQL query';
    }
  } catch (err) {
    console.log('Error executing SQL:', err);
    sysdateResult = 'Error executing SQL';
  }

  // Redact password in the connection string
  let connectionString = 'Not available';
  if (process.env.DATABASE) {
    connectionString = process.env.DATABASE.replace(/\/\/(.*):(.*)@/, '//$1:REDACTED@');
  }

  console.log('MongoDB Connection String:', connectionString);
  console.log('Oracle Connection String:', connectionString);

  res.render('test', { 
    title: 'Test Page', 
    mongoDateResult, 
    sysdateResult, 
    mongoConnectionStatus, 
    oracleConnectionStatus,
    connectionString,
    mongoCount 
  });
});

// Display map with lat/long for sampledata
router.get('/map', async (req, res) => {
  try {
    const registrations = await Registration.find({
      'location.coordinates': { $exists: true, $ne: [] }
    }).select('name location');

    res.render('map', { 
      title: 'Map of Registrations', 
      registrations 
    });
  } catch (err) {
    console.error('Error loading registrations for map:', err);
    res.send('Sorry! Something went wrong.');
  }
});

router.get('/api/markers', async (req, res) => {
  const { south, west, north, east } = req.query;

  if (!south || !west || !north || !east) {
    return res.status(400).json({ error: 'Bounding box parameters are required' });
  }

  try {
    const markers = await Registration.find({
      'location.coordinates': {
        $geoWithin: {
          $box: [
            [parseFloat(west), parseFloat(south)], // Bottom-left corner
            [parseFloat(east), parseFloat(north)]  // Top-right corner
          ]
        }
      }
    }).select('name location');

    res.json(markers);
  } catch (err) {
    console.error('Error loading markers:', err);
    res.status(500).json({ error: 'Failed to load markers' });
  }
});


router.get('/api/clusters', async (req, res) => {
  const { south, west, north, east, zoom } = req.query;

  if (!south || !west || !north || !east || !zoom) {
    return res.status(400).json({ error: 'Bounding box and zoom level are required' });
  }

  try {
    // Calculate grid size based on zoom level
    const gridSize = 1 / Math.pow(2, zoom); // Example grid size logic (adjust as needed)

    // Aggregate points into clusters
    const clusters = await Registration.aggregate([
      {
        $match: {
          'location.coordinates': {
            $geoWithin: {
              $box: [
                [parseFloat(west), parseFloat(south)], // Bottom-left corner
                [parseFloat(east), parseFloat(north)]  // Top-right corner
              ]
            }
          }
        }
      },
      {
        $project: {
          name: 1,
          location: 1,
          // Calculate cluster keys based on grid size
          clusterX: { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, gridSize] } },
          clusterY: { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, gridSize] } }
        }
      },
      {
        $group: {
          _id: { clusterX: '$clusterX', clusterY: '$clusterY' },
          count: { $sum: 1 },
          location: { $avg: { $arrayElemAt: ['$location.coordinates', 1] } },
          longitude: { $avg: { $arrayElemAt: ['$location.coordinates', 0] } },
          names: { $push: '$name' }
        }
      },
      {
        $project: {
          _id: 0,
          cluster: '$_id',
          count: 1,
          latitude: '$location',
          longitude: 1,
          names: 1
        }
      }
    ]);

    res.json(clusters);
  } catch (err) {
    console.error('Error generating clusters:', err);
    res.status(500).json({ error: 'Failed to generate clusters' });
  }
});

router.get('/map/clusters', async (req, res) => {
  try {
    const { bounds, zoom } = req.query;
    const { northEast, southWest } = JSON.parse(bounds);

    // Extract latitude and longitude boundaries
    const minLat = southWest.lat;
    const maxLat = northEast.lat;
    const minLng = southWest.lng;
    const maxLng = northEast.lng;

    // Define grid size based on zoom level
    const gridSize = Math.pow(2, 18 - zoom); // Adjust grid size for clustering

    // MongoDB aggregation pipeline for server-side clustering
    const pipeline = [
      {
        $match: {
          "location.coordinates": {
            $geoWithin: {
              $box: [
                [minLng, minLat],
                [maxLng, maxLat]
              ]
            }
          }
        }
      },
      {
        $project: {
          gridX: { $floor: { $divide: [{ $arrayElemAt: ["$location.coordinates", 0] }, gridSize] } },
          gridY: { $floor: { $divide: [{ $arrayElemAt: ["$location.coordinates", 1] }, gridSize] } },
          name: 1,
          location: 1
        }
      },
      {
        $group: {
          _id: { gridX: "$gridX", gridY: "$gridY" },
          count: { $sum: 1 },
          coordinates: { $avg: "$location.coordinates" }, // Approximate cluster center
          name: { $first: "$name" }
        }
      },
      {
        $project: {
          count: 1,
          coordinates: 1,
          name: 1
        }
      }
    ];

    const clusters = await Registration.aggregate(pipeline);
    res.json(clusters);
  } catch (err) {
    console.error('Error generating clusters:', err);
    res.status(500).json({ error: 'Error generating clusters' });
  }
});

router.get('/map/registrations', async (req, res) => {
  try {
    const registrations = await Registration.find({}, { name: 1, city: 1, location: 1, image: 1 }).lean();
    res.json(registrations);
  } catch (err) {
    console.error('Error fetching registrations for map:', err);
    res.status(500).json({ error: 'Error fetching registrations' });
  }
});




module.exports = router;
