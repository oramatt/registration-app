# Registration App

A demonstration Node.js application showcasing MongoDB to Oracle API for MongoDB migration capabilities. This app provides a simple registration system with data visualization and migration tools.

## Features

- **User Registration**: Web-based form for collecting user registration data
- **Data Visualization**: 
  - Registration summary with email domain aggregation
  - Interactive map showing registrant locations (when lat/long data available)
- **Database Migration**: Tools for migrating data from MongoDB to Oracle API for MongoDB
- **Data Generation**: Python script for creating synthetic test data with geographic coordinates
- **Health Monitoring**: Sanity check endpoint for database connectivity testing

## Technology Stack

- **Backend**: Node.js
- **Frontend**: Bootstrap (responsive UI)
- **Database**: MongoDB → Oracle API for MongoDB
- **Data Generation**: Python with geospatial libraries
- **Mapping**: Interactive maps for location visualization

## Prerequisites

- Node.js installed
- MongoDB instance or MongoDB Atlas connection
- Oracle API for MongoDB credentials
- Python (for data generation scripts)

## Quick Start

### 1. Initial Setup with MongoDB

```bash
# Run the application with MongoDB
./runApp.sh
# Follow prompts to input your MongoDB connection information
```

### 2. Access the Application

- **Main App**: [http://localhost:3000](http://localhost:3000) - Create new registrations
- **View Registrations**: [http://localhost:3000/registrations](http://localhost:3000/registrations) - Summary with email domain analysis
- **Health Check**: [http://localhost:3000/test](http://localhost:3000/test) - Database connectivity and timestamp verification
- **Map View**: [http://localhost:3000/map](http://localhost:3000/map) - Geographic visualization of registrants

### 3. Migration to Oracle API for MongoDB

```bash
# Export data from MongoDB
./mongoDump.sh

# Restart app with Oracle API for MongoDB
./runApp.sh
# Input your Oracle API for MongoDB credentials when prompted
```

### 4. Stop the Application

```bash
pkill -f node
```

## Data Generation

Generate synthetic test data with geographic coordinates:

```bash
cd sample_data
python makeJSONData_OPTIONALPICS_wGeoData.py
```

**Features of the data generator:**
- Creates realistic registration data
- Uses shapefiles from `geodata/` directory for accurate lat/long coordinates within landmass boundaries
- Optional synthetic profile pictures or cat pictures from CATAAS (Cat As A Service)
- Configurable data volume and geographic distribution

## Project Structure

```
registration-app/
├── runApp.sh              # Application startup script
├── mongoDump.sh           # Data export utility
├── sample_data/
│   ├── makeJSONData_OPTIONALPICS_wGeoData.py  # Data generation script
│   └── geodata/           # Shapefiles for geographic data
└── [application files]
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Registration form (main page) |
| `GET /registrations` | Registration summary with domain aggregation |
| `GET /test` | Database health check and connectivity test |
| `GET /map` | Interactive map of registrant locations |

## Migration Workflow

1. **Start with MongoDB**: Use the app with your existing MongoDB setup
2. **Export Data**: Run `mongoDump.sh` to create JSON exports
3. **Switch to Oracle**: Restart with Oracle API for MongoDB credentials
4. **Verify Migration**: Check data integrity via `/registrations` and `/test` endpoints
5. **Continue Operations**: Add new data and confirm everything works

## Testing

The `/test` endpoint provides comprehensive health checking:
- Current timestamp from MongoDB/Oracle API for MongoDB
- Oracle database connectivity (if configured)
- Registration count verification

## Use Cases

- **Database Migration Demos**: Show seamless MongoDB to Oracle API for MongoDB transitions
- **Training Material**: Hands-on learning for database migration concepts
- **Development Testing**: Prototype application for testing database configurations
- **Geographic Analysis**: Visualize user distribution and registration patterns

## Contributing

This is a demonstration application. For questions or issues, contact: [Matt DeMarco](mailto:matthew.demarco@oracle.com)

## Credits

Based on the tutorial: [Build a Simple Beginner App with Node, Bootstrap & MongoDB](https://www.sitepoint.com/build-simple-beginner-app-node-bootstrap-mongodb/)

## Success Indicator

When you know, you know

---

