import sys
import re
import pymongo
from pymongo.errors import ConnectionFailure, OperationFailure
from faker import Faker
import random
from PIL import Image, ImageDraw
import io
import base64
import geopandas as gpd
from shapely.geometry import Point
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------------
# 1. Shapefile Loading (Ensure you have downloaded & unzipped the shapefile)
# ----------------------------------------------------------------------------
# Download the 110m Admin 0 - Countries shapefile from:
# https://www.naturalearthdata.com/downloads/110m-cultural-vectors/
# and unzip it to a directory named "geodata" or adjust the path accordingly.
landmass_shapefile = "geodata/ne_110m_admin_0_countries.shp"
landmasses = gpd.read_file(landmass_shapefile)

# ----------------------------------------------------------------------------
# 2. User Prompts
# ----------------------------------------------------------------------------

def get_num_fake_records():
    """
    Attempt to read an integer from command-line;
    if not present or invalid, prompts the user.
    """
    if len(sys.argv) > 1:
        try:
            return int(sys.argv[1])
        except ValueError:
            pass  # If invalid or missing, fall through to user input

    while True:
        val = input("Enter the number of fake records: ")
        try:
            return int(val)
        except ValueError:
            print("Invalid input. Please enter a whole number.")

def get_image_choice():
    """
    Asks the user what type of images to generate:
    1 - Cat pictures (fetched from the internet)
    2 - Random Pillow images
    3 - No images (skip all image logic)
    Returns an integer (1, 2, or 3).
    """
    while True:
        print("\nChoose the type of images to generate:")
        print("1) Cat pictures")
        print("2) Random Pillow images")
        print("3) No images")
        choice = input("Enter your choice (1/2/3): ")
        if choice in ["1", "2", "3"]:
            return int(choice)
        else:
            print("Invalid choice. Please enter 1, 2, or 3.")

# ----------------------------------------------------------------------------
# 3. MongoDB Connection and Password Redaction
# ----------------------------------------------------------------------------

def redact_password(uri):
    """Redact any password in the URI by replacing it with *****."""
    return re.sub(r':[^@]+@', ':*****@', uri)

def connect_to_mongodb(uri, timeout_ms=100):
    """
    Connect to MongoDB with a short timeout
    and return a client, or None if connection fails.
    """
    import pymongo  # local import so we only load if we need it
    try:
        # Enforce a short server selection timeout
        client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=timeout_ms)
        client.server_info()  # Forces a server selection attempt
        return client
    except ConnectionFailure as e:
        logger.error(f"Connection error with URI {redact_password(uri)}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error with URI {redact_password(uri)}: {e}")
    return None

def prompt_for_custom_uri():
    """Prompt the user to enter a custom MongoDB URI or quit."""
    while True:
        print("\nAll default MongoDB URIs failed to connect.")
        print("1) Enter a new MongoDB URI manually")
        print("2) Quit")
        user_choice = input("Your choice (1/2): ").strip()
        if user_choice == "1":
            new_uri = input("Enter MongoDB URI (e.g. mongodb://localhost:27017/test): ").strip()
            return new_uri
        elif user_choice == "2":
            logger.info("Exiting program as requested by user.")
            return None
        else:
            print("Invalid input. Please enter '1' or '2'.")

def get_working_mongodb_client(uri_list):
    """
    Attempt to connect to each MongoDB URI in 'uri_list' in order.
    If all fail, prompt the user for a custom URI until success or user quits.
    Returns a working client or None.
    """
    for uri in uri_list:
        logger.info(f"Attempting MongoDB URI: {redact_password(uri)}")
        client = connect_to_mongodb(uri, timeout_ms=100)
        if client is not None:
            logger.info(f"Connected successfully to {redact_password(uri)}")
            return client

    # If all default URIs fail, ask the user for a custom URI
    while True:
        custom_uri = prompt_for_custom_uri()
        if custom_uri is None:
            # User chose to quit
            return None

        logger.info(f"Trying custom URI: {redact_password(custom_uri)}")
        custom_client = connect_to_mongodb(custom_uri, timeout_ms=100)
        if custom_client is not None:
            logger.info(f"Connected successfully to custom URI: {redact_password(custom_uri)}")
            return custom_client
        else:
            # Prompt again
            print("Connection failed, please try again.")

# ----------------------------------------------------------------------------
# 4. Data Generation Helpers
# ----------------------------------------------------------------------------

fake = Faker()

def generate_land_coordinates():
    """Generate random coordinates on land by referencing shapefile polygons."""
    while True:
        lon, lat = random.uniform(-180, 180), random.uniform(-90, 90)
        point = Point(lon, lat)
        # Check if this point is on land (any polygon of the shapefile)
        if landmasses.contains(point).any():
            return [lon, lat]

def generate_varied_email():
    """Generate a varied fake email."""
    email_providers = [
        'gmail.com', 'yahoo.com', 'outlook.com', 'example.com',
        'test.com', 'hotmail.com'
    ]
    email_formats = [
        lambda: f"{fake.first_name()}.{fake.last_name()}@{random.choice(email_providers)}",
        lambda: f"{fake.first_name()}{random.randint(1, 100)}@{random.choice(email_providers)}",
        lambda: f"{fake.last_name()}{random.randint(1, 100)}@{random.choice(email_providers)}",
        lambda: f"{fake.first_name()}{fake.last_name()}@{random.choice(email_providers)}",
    ]
    return random.choice(email_formats)()

# ----------------------------------------------------------------------------
# 5. Conditional Image Logic
# ----------------------------------------------------------------------------

def create_cat_image():
    """
    Downloads a cat image from a random URL, adds text, and returns base64.
    Returns None if an error occurs.
    """
    import requests
    cat_image_urls = [
        "https://cataas.com/cat/says/Hello",
        "https://cataas.com/cat/gif",
        "https://cataas.com/cat"
    ]
    try:
        random_cat_url = random.choice(cat_image_urls)
        response = requests.get(random_cat_url, stream=True)
        response.raise_for_status()
        image = Image.open(response.raw).convert('RGB')
        draw = ImageDraw.Draw(image)
        draw.text((10, 10), "Meow! I'm a cat!", fill=(255, 255, 255))
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    except Exception as e:
        logger.warning(f"Failed to fetch cat image: {e}")
        return None

def create_fake_image():
    """Create a 100x100 random-colored Pillow image with text, in base64."""
    image = Image.new('RGB', (100, 100), (
        random.randint(0, 255),
        random.randint(0, 255),
        random.randint(0, 255)
    ))
    draw = ImageDraw.Draw(image)
    draw.text((10, 40), "Fake Image", fill=(255, 255, 255))
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

def get_image_function(image_choice):
    """
    Return a function that generates the appropriate image or None.
      - If image_choice == 1 => cat image
      - If image_choice == 2 => fake Pillow image
      - If image_choice == 3 => no images
    This ensures we never import requests or define cat_image_urls
    if the user doesn't need cat images.
    """
    if image_choice == 1:
        return create_cat_image
    elif image_choice == 2:
        return create_fake_image
    else:
        # No images at all
        def no_image():
            return None
        return no_image

# ----------------------------------------------------------------------------
# 6. MongoDB Database Operations
# ----------------------------------------------------------------------------

def perform_db_operations(client, database_name, num_records, image_generator):
    if client is None:
        logger.error(f"Skipping operations for database {database_name} due to connection issues.")
        return

    try:
        database = client[database_name]
        collection = database["registrations"]

        def database_size():
            stats = database.command("dbStats")
            return stats["storageSize"] / 1024 / 1024  # MB

        def count_records():
            return collection.count_documents({})
        
        def generate_fake_data(num_records):
            data = []
            for _ in range(num_records):
                record = {
                    "name": fake.name(),
                    "age": fake.random_int(min=18, max=60),
                    "city": fake.city(),
                    "email": generate_varied_email(),
                    "notes": fake.text(max_nb_chars=200),
                    "location": {
                        "type": "Point",
                        "coordinates": generate_land_coordinates()
                    },
                    # If the image generator returns None, we'll store None
                    "image": image_generator()
                }
                data.append(record)
            return data
        
        records_before = count_records()
        size_before = database_size()
        logger.info(f"Total records before insert: {records_before}")
        logger.info(f"Database size before insert: {size_before:.2f} MB")

        data_list = generate_fake_data(num_records)
        collection.insert_many(data_list)

        records_after = count_records()
        size_after = database_size()
        logger.info(f"Total records inserted: {num_records}")
        logger.info(f"Total records after insert: {records_after}")
        logger.info(f"Database size after insert: {size_after:.2f} MB")

    except OperationFailure as e:
        logger.error(f"MongoDB operation failure for database {database_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error for database {database_name}: {e}")

# ----------------------------------------------------------------------------
# 7. Main Execution
# ----------------------------------------------------------------------------

def main():
    # 1) Get the number of records to create
    num_records = get_num_fake_records()

    # 2) Get user's image choice (cat, random, or none)
    image_choice = get_image_choice()

    # 3) Prepare the function that generates images (or None)
    image_generator = get_image_function(image_choice)

    # 4) Attempt to get a working MongoDB client
    mongodb_uris = [
        # update this based on your install, typically change the port >.<
        "mongodb://127.0.0.1:23456/test",
    ]
    client = get_working_mongodb_client(mongodb_uris)
    if not client:
        logger.error("No valid MongoDB connection. Exiting.")
        return

    # 5) Perform database operations
    perform_db_operations(client, "test", num_records, image_generator)

if __name__ == "__main__":
    main()
