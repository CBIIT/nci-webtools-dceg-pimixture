import os
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from ConfigParser import SafeConfigParser
import logging
from logging.handlers import TimedRotatingFileHandler

config = SafeConfigParser()
config_file = os.environ.get('PIMIXTURE_CONFIG_FILE', 'config.ini')
config.read(config_file)

logLevel = config.get('log', 'log_level')
numericLevel = getattr(logging, logLevel.upper(), None)
if not isinstance(numericLevel, int):
    raise ValueError('Invalid log level: %s' % logLevel)

log = logging.getLogger('pimixture')
log.setLevel(numericLevel)
stdFormatter = logging.Formatter('%(asctime)s [%(levelname)s] %(module)s - %(message)s')

logFolder = config.get('log', 'log_folder')
logFileName = config.get('log', 'log_file_name')
if logFolder and not os.path.exists(logFolder):
    os.makedirs(logFolder)
logFileName = os.path.join(logFolder, logFileName)
fileHandler = TimedRotatingFileHandler(logFileName, when='midnight', interval=1, backupCount=60)
fileHandler.setFormatter(stdFormatter)
log.addHandler(fileHandler)

# Mail settings
HOST = config.get('mail', 'host')
SENDER = config.get('mail', 'sender')

# Folder settings
INPUT_DATA_PATH = config.get('folders', 'input_data_path')
log.info('INPUT_DATA_PATH: {}'.format(INPUT_DATA_PATH))
if not os.path.exists(INPUT_DATA_PATH):
    os.makedirs(INPUT_DATA_PATH)

OUTPUT_DATA_PATH = config.get('folders', 'output_data_path')
log.info('OUTPUT_DATA_PATH: {}'.format(OUTPUT_DATA_PATH))
if not os.path.exists(OUTPUT_DATA_PATH):
    os.makedirs(OUTPUT_DATA_PATH)

# Prefix settings
INPUT_FILE_PREFIX = config.get('prefixes', 'input_file_prefix')
OUTPUT_FILE_PREFIX = config.get('prefixes', 'output_file_prefix')

# Suffix settings
FITTING_R_SUFFIX = config.get('suffixes', 'fitting_r_suffix')
FITTING_SS_SUFFIX = config.get('suffixes', 'fitting_ss_suffix')
PREDICTION_SUFFIX = config.get('suffixes', 'prediction_suffix')

# S3 settings
INPUT_BUCKET = config.get('s3', 'input_bucket')
OUTPUT_BUCKET = config.get('s3', 'output_bucket')
URL_EXPIRE_TIME = int(config.get('s3', 'url_expire_time'))
S3_INPUT_FOLDER = config.get('s3', 'input_folder')
S3_OUTPUT_FOLDER = config.get('s3', 'output_folder')

# SQS settings
QUEUE_NAME = config.get('sqs', 'queue_name')
QUEUE_MSG_RETENTION_SECONDS = config.get('sqs', 'queue_msg_retention_seconds')
VISIBILITY_TIMEOUT = int(config.get('sqs', 'visibility_timeout'))
QUEUE_LONG_PULL_TIME = config.get('sqs', 'queue_long_pull_time')

# Output settings
SS_FILE_TYPE = config.get('output', 'file_type')

# Constants
IMPORT_R_WRAPPER = 'source("R/pimixtureWrapper.R")'
CSV_FORMAT = 'CSV'
EXCEL_FORMAT = 'EXCEL'

extensionMap = {
    CSV_FORMAT: '.csv',
    EXCEL_FORMAT: '.xlsx'
}

# Following parameters will be load to fitting page when run prediction from email except those in emailExcludedFields
# These parameters will also be saved to output CSV/EXCEL files, except those in ssExcludedFields
savedParameters = [ {'field': 'jobName', 'name': 'Job Name'},
                    {'field': 'inputCSVFile', 'name': 'Input File Name'},
                    {'field': 'remoteInputCSVFile', 'name': 'Remote input CSV File'},
                    {'field': 'headers', 'name': 'Variables'},
                    {'field': 'design', 'name': 'Sample Design'},
                    {'field': 'model', 'name': 'Regression Model'},
                    {'field': 'strata', 'name': 'Strata'},
                    {'field': 'weight', 'name': 'Weight'},
                    {'field': 'outcomeC', 'name': 'C'},
                    {'field': 'outcomeL', 'name': 'L'},
                    {'field': 'outcomeR', 'name': 'R'},
                    {'field': 'covariatesSelection', 'name': 'Covariates'},
                    {'field': 'covariatesArr', 'name': 'Covariate Configuration'},
                    {'field': 'effects', 'name': 'Interactive Effects'},
                    {'field': 'effectsString', 'name': 'Interactive Effects'},
                    {'field': 'email', 'name': 'Email'}
                    ]

ssExcludedFields = ['inputCSVFile', 'remoteInputCSVFile', 'headers', 'effects']
emailExcludedFields = ['effectsString']

def addStreamHandler():
    stdHandler = logging.StreamHandler()
    stdHandler.setFormatter(stdFormatter)
    log.addHandler(stdHandler)

def getInputFilePath(id, extention):
    return getFilePath(INPUT_DATA_PATH, INPUT_FILE_PREFIX, id, extention)

def getOutputFilePath(id, extention):
    return getFilePath(OUTPUT_DATA_PATH, OUTPUT_FILE_PREFIX, id, extention)

def getInputFileKey(id, extension):
    return getFileName(S3_INPUT_FOLDER + OUTPUT_FILE_PREFIX, id, extension)
    
def getOutputFileKey(id, extension):
    return getFileName(S3_OUTPUT_FOLDER + OUTPUT_FILE_PREFIX, id, extension)

def getFilePath(path, prefix, id, extension):
    filename = getFileName(prefix, id, extension)
    return os.path.join(path, filename)

def getFileName(prefix, id, extension):
    return prefix + id + extension

def send_mail(sender, recipient, subject, contents, attachments=None):
    """Sends an email to the provided recipient

    Arguments:
        - sender {string} -- The sender of the email
        - recipient {string} -- The recipient of the email
        - subject {string} -- The email's subject
        - contents {string} -- The email's contents

    Keyword Arguments:
        - attachments {string[]} -- Filenames of attachments (default: {None})
    """
    server = None
    try:
        message = MIMEMultipart()
        message['Subject'] = subject
        message['From'] = sender
        message['To'] = recipient

        # set text for message
        message.attach(MIMEText(contents.encode('utf-8'), 'html', 'utf-8'))

        # add attachments to message
        if attachments is not None:
            for attachment in attachments:
                with open(attachment, 'rb') as _file:
                    message.attach(MIMEApplication(
                        _file.read(),
                        Name=os.path.basename(attachment)
                    ))
        host = config.get('mail', 'host')
        # send email
        server = smtplib.SMTP(host)
        server.sendmail(sender, recipient, message.as_string())
        return True
    except Exception as e:
        log.error(e)
        return False
    finally:
        if server and getattr(server, 'quit'):
            server.quit()
