# Demo App for migrating a MongoDB JSON workload
### Questions/problems --> matthew.demarco@oracle.com

1. Run the app with the `runApp.sh` file inputting your MongoDB information

2. Add data via website 'http://localhost:3000'

3. List registions 'http://localhost:3000/registrations'

4. Stop the app with this command: `pkill -f node`

5. Run the `mongoDump.sh` file to export JSON to new location

6. Restart app with `runApp.sh` file inputting your Oracle API for MongoDB information

7. Confirm data with 'http://localhost:3000/registrations'

8. Add data via website 'http://localhost:3000'

9. Bask in your success 🦄

10. App routes
	- http://localhost:3000/ --> application front page for manually creating registrations
	- http://localhost:3000/registrations --> summary page for all registrations using an aggregation pipeline to count all domains from email addresses of registrants
	- http://localhost:3000/test --> sanity checking page fetching current timestamp from MongoDB, Oracle API for MongoDB, and sysdate if connected to Oracle, along with a simple count of registrants
	- http://localhost:3000/map --> page showing locations of registrants if lat/long data is in the collection

11. `sample_data/makeJSONData_OPTIONALPICS_wGeoData.py` --> Random data generation can be done with this script. This script uses shapefiles in the `geodata` directory in order to create lat/long cooridates within landmass bountries. This script will optionally create synthetic pictures or fetch cat pictures from CATAAS (Cat As A Service) .


Credits - Based on tutorial found here: https://www.sitepoint.com/build-simple-beginner-app-node-bootstrap-mongodb/
