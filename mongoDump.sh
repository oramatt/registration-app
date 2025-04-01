#!/bin/bash

# Script purpose - Execution
# 
# Author: Matt DeMarco (matthew.demarco@oracle.com)
# 
# Example script for the Execution phase of a migration focused on data migration from source to target
# This script can do the following:
# 1. Bulk data export -- single operation exporting data in bulk from MongoDB source to file system location
# 2. Bulk data import -- single operation importing data into Oracle database with MongoDB API
#
#



# Function to validate inputs
validate_input() {
    if [[ -z "$1" ]]; then
        echo "Error: $2 cannot be empty."
        exit 1
    fi
}

# Function to check if a command exists in PATH
check_command() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required MongoDB tools
if ! check_command "mongodump"; then
    echo "mongodump not found in PATH."
    read -p "Please enter the full path to the mongodump binary: " mongodump_path
    validate_input "$mongodump_path" "mongodump binary path"
    export PATH="$mongodump_path:$PATH"
else
    mongodump_path="mongodump"
fi

if ! check_command "mongorestore"; then
    echo "mongorestore not found in PATH."
    read -p "Please enter the full path to the mongorestore binary: " mongorestore_path
    validate_input "$mongorestore_path" "mongorestore binary path"
    export PATH="$mongorestore_path:$PATH"
else
    mongorestore_path="mongorestore"
fi

# Get source MongoDB details
echo "Enter the endpoint information for your MongoDB database (source): "
read -p "Example (localhost:27017/dbname): " srcMongo
validate_input "$srcMongo" "Source MongoDB URI"

echo "Enter the collection name to export from (source) or leave blank to export all collections: "
read -p "Example (registrations): " srcCol

# Ask user if they want to use parallel collection dumping
read -p "Specify number of parallel collections for export (leave blank for default): " numParallelCollections

# Construct the parallel argument if specified
if [[ -n "$numParallelCollections" ]]; then
    parallelArg="--numParallelCollections=$numParallelCollections"
else
    parallelArg=""
fi

# Prompt for target MongoDB details
echo "Enter the connection details for your Oracle API for MongoDB (target):"

read -p "Username: " tgtUser
validate_input "$tgtUser" "Username"

read -sp "Password: " tgtPass
echo
validate_input "$tgtPass" "Password"

read -p "Hostname (e.g., localhost): " tgtHost
validate_input "$tgtHost" "Hostname"

read -p "Database Name: " tgtDb
validate_input "$tgtDb" "Database Name"

# Construct the connection string
tgtMongo="${tgtUser}:${tgtPass}@${tgtHost}:27017/${tgtDb}?authMechanism=PLAIN&authSource=%24external&tls=true&retryWrites=false&loadBalanced=true"
echo "Constructed Target MongoDB URI: mongodb://${tgtMongo}"

# Validate constructed URI
validate_input "$tgtMongo" "Target MongoDB URI"

echo "Enter the collection name to import into (target) or leave blank to import all collections: "
read -p "Example (registrations): " tgtCol

# Ask user for optional --noIndexRestore
read -p "Do you want to skip index restoration (yes/no, default is no)? " skipIndexRestore

if [[ "$skipIndexRestore" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    indexRestoreArg="--noIndexRestore"
else
    indexRestoreArg=""
fi

# Ask user for parallel restoration options
read -p "Specify number of collections to restore in parallel (leave blank for default 4): " restoreParallelCollections
read -p "Specify number of insertion workers per collection (leave blank for default 1): " restoreInsertionWorkers

# Construct the parallel restoration arguments
restoreParallelArg=""
if [[ -n "$restoreParallelCollections" ]]; then
    restoreParallelArg="--numParallelCollections=$restoreParallelCollections"
fi

restoreInsertionArg=""
if [[ -n "$restoreInsertionWorkers" ]]; then
    restoreInsertionArg="--numInsertionWorkersPerCollection=$restoreInsertionWorkers"
fi

# Local storage for export
echo "Enter the local storage location for the export file: "
read -p "Example (/tmp): " jsonLoc
validate_input "$jsonLoc" "Export file location"

# Remove trailing slashes from jsonLoc
jsonLoc=$(echo "$jsonLoc" | sed 's:/*$::')

# Create local storage directory if not exists
if [[ ! -d "$jsonLoc" ]]; then
    mkdir -p "$jsonLoc"
    echo "Created directory: $jsonLoc"
fi

# Check if a specific collection is provided
if [[ -z "$srcCol" ]]; then
    echo "Exporting all collections from source MongoDB..."
    $mongodump_path --uri="mongodb://$srcMongo" $parallelArg --out="$jsonLoc"
    if [[ $? -ne 0 ]]; then
        echo "Error: mongodump failed. Check source MongoDB details."
        exit 1
    fi
else
    echo "Exporting data from source MongoDB collection: $srcCol"
    $mongodump_path --uri="mongodb://$srcMongo" --collection="$srcCol" --out="$jsonLoc"
    if [[ $? -ne 0 ]]; then
        echo "Error: mongodump failed. Check source MongoDB details."
        exit 1
    fi
fi

# Construct path to BSON directory or file
dbName=$(basename $srcMongo) # Extract database name
if [[ -z "$srcCol" ]]; then
    bsonPath="$jsonLoc/$dbName" # Path for all collections
else
    bsonPath="$jsonLoc/$dbName/$srcCol.bson" # Path for a specific collection
    metadataPath="$jsonLoc/$dbName/$srcCol.metadata.json"
fi

# Validate BSON path
if [[ ! -d "$bsonPath" && ! -f "$bsonPath" ]]; then
    echo "Error: BSON data not found at $bsonPath"
    exit 1
fi

# Import data to target MongoDB
if [[ -z "$tgtCol" ]]; then
    echo "Importing all collections into target MongoDB..."
    $mongorestore_path --uri="mongodb://$tgtMongo" \
    --tlsInsecure \
    $indexRestoreArg \
    $restoreParallelArg \
    $restoreInsertionArg \
    "$bsonPath"
else
    echo "Importing data into target MongoDB collection: $tgtCol"
    $mongorestore_path --uri="mongodb://$tgtMongo" \
    --tlsInsecure \
    --nsInclude="$(basename $tgtMongo)/$tgtCol" \
    $indexRestoreArg \
    $restoreParallelArg \
    $restoreInsertionArg \
    "$bsonPath"
fi

if [[ $? -ne 0 ]]; then
    echo "Error: mongorestore failed. Check target MongoDB details."
    exit 1
fi

# Final message
echo "Validate that data migration completed successfully! If indexes were not restored, please recreate them manually in the target database."
