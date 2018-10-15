import os
from ConfigParser import SafeConfigParser
config = SafeConfigParser()
config.read('config.ini')

# Folder settings
INPUT_DATA_PATH = config.get('folders', 'input_data_path')
print('INPUT_DATA_PATH: {}'.format(INPUT_DATA_PATH))
if not os.path.isdir(INPUT_DATA_PATH):
    os.makedirs(INPUT_DATA_PATH)

OUTPUT_DATA_PATH = config.get('folders', 'output_data_path')
print('OUTPUT_DATA_PATH: {}'.format(OUTPUT_DATA_PATH))
if not os.path.isdir(OUTPUT_DATA_PATH):
    os.makedirs(OUTPUT_DATA_PATH)

# Prefix settings
INPUT_FILE_PREFIX = config.get('prefixes', 'input_file_prefix')
OUTPUT_FILE_PREFIX = config.get('prefixes', 'output_file_prefix')

# S3 settings
INPUT_BUCKET = config.get('s3', 'input_bucket')
OUTPUT_BUCKET = config.get('s3', 'output_bucket')
VISIBILITY_TIMEOUT = int(config.get('s3', 'visibility_timeout'))

# SQS settings
QUEUE_NAME = config.get('sqs', 'queue_name')
QUEUE_MSG_RETENTION_SECONDS = config.get('sqs', 'queue_msg_retention_seconds')
QUEUE_LONG_PULL_TIME = config.get('sqs', 'queue_long_pull_time')
QUEUE_MESSAGE_GROUP_ID = config.get('sqs', 'queue_message_group_id')

IMPORT_R_WRAPPER = 'source("R/pimixtureWrapper.R")'

def getInputFilePath(id, extention):
    return getFilePath(INPUT_DATA_PATH, INPUT_FILE_PREFIX, id, extention)

def getOutputFilePath(id, extention):
    return getFilePath(OUTPUT_DATA_PATH, OUTPUT_FILE_PREFIX, id, extention)

def getOutputFileName(id, extension):
    return getFileName(OUTPUT_FILE_PREFIX, id, extension)

def getFilePath(path, prefix, id, extension):
    filename = getFileName(prefix, id, extension)
    return os.path.join(path, filename)

def getFileName(prefix, id, extension):
    return prefix + id + extension
