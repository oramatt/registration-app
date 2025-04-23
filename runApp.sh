#!/bin/bash

# Function to prompt user for database connection details and update .env file
update_env_file() {
  echo "Select the database connection to use:"
  echo "1. Local MongoDB connection"
  echo "2. Local 23ai Oracle API for MongoDB connection"
  echo "3. OCI Autonomous JSON database"

  read -p "Enter the number (1, 2, or 3): " choice

  case $choice in
    1)
      read -p "Enter MongoDB host (e.g., 127.0.0.1): " mongo_host
      read -p "Enter MongoDB port (e.g., 23456): " mongo_port
      read -p "Enter MongoDB database name (e.g., test): " mongo_db
      echo "DATABASE=mongodb://$mongo_host:$mongo_port/$mongo_db" > .env
      echo "Using Local MongoDB connection."
      echo "DATABASE=mongodb://$mongo_host:$mongo_port/$mongo_db"
      ;;
    2)
      read -p "Enter Oracle database host (e.g., 127.0.0.1): " oracle_host
      read -p "Enter Oracle username: " oracle_user
      read -s -p "Enter Oracle password: " oracle_pass
      echo
      echo "DATABASE=mongodb://$oracle_user:$oracle_pass@$oracle_host/$oracle_user?authMechanism=PLAIN&authSource=%24external&retryWrites=false&loadBalanced=true&tls=true&tlsAllowInvalidCertificates=true" > .env
      echo "Using 23ai Oracle API for MongoDB connection."
      # Do not echo the full connection string with password here for security
      echo "DATABASE=mongodb://$oracle_user:*****@$oracle_host/$oracle_user?authMechanism=PLAIN&authSource=%24external&retryWrites=false&loadBalanced=true&tls=true&tlsAllowInvalidCertificates=true"
      ;;
    3)
      echo "DATABASE=mongodb://noone:nopass@where:27017/noone?authMechanism=PLAIN&authSource=%24external&retryWrites=false&loadBalanced=true&tls=true&tlsAllowInvalidCertificates=true" > .env
      echo "Using OCI Autonomous JSON connection."
      ;;
    *)
      echo "Invalid choice. Exiting."
      exit 1
      ;;
  esac
}

# Update .env file based on user choice
update_env_file

# Start the application
npm run watch --trace-warnings

nodemon ./start.js
