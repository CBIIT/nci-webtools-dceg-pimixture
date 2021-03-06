import os
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from configparser import SafeConfigParser
import logging
from logging.handlers import TimedRotatingFileHandler
import pyper as pr

config = SafeConfigParser()
config_file = os.environ.get('PIMIXTURE_CONFIG_FILE', 'config.ini')
config.read(config_file)


logFileName = config.get('log', 'log_file_name')
processorLogFileName = config.get('log', 'processor_log_file_name')


# Mail settings
ADMIN = config.get('mail', 'admin')
HOST = config.get('mail', 'host')
SENDER = config.get('mail', 'sender')
REPORT_URL = config.get('mail', 'report_url')

# Folder settings
INPUT_DATA_PATH = config.get('folders', 'input_data_path')
if not os.path.exists(INPUT_DATA_PATH):
    os.makedirs(INPUT_DATA_PATH)

OUTPUT_DATA_PATH = config.get('folders', 'output_data_path')
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
VISIBILITY_TIMEOUT = int(config.get('sqs', 'visibility_timeout'))
QUEUE_LONG_PULL_TIME = int(config.get('sqs', 'queue_long_pull_time'))

# Output settings
SS_FILE_TYPE = config.get('output', 'file_type')

# R settings
FITTING_TIMEOUT = int(config.get('R', 'fitting_timeout'))

# Constants
IMPORT_R_WRAPPER = 'source("R/pimixtureWrapper.R")'
CSV_FORMAT = 'CSV'
EXCEL_FORMAT = 'EXCEL'

extensionMap = {
    CSV_FORMAT: '.csv',
    EXCEL_FORMAT: '.xlsx'
}

def getPIMixtureVersion():
    r = pr.R()
    r(IMPORT_R_WRAPPER)
    r('version <- getPIMixtureVersion()')
    return r.get('version')

PIMIXTURE_VERSION = getPIMixtureVersion()


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

stdFormatter = logging.Formatter('%(asctime)s [%(levelname)s] %(module)s - %(message)s')
miniFormatter = logging.Formatter('[%(levelname)s] %(module)s - %(message)s')

def getLogger():
    logLevel = config.get('log', 'log_level')
    numericLevel = getattr(logging, logLevel.upper(), None)
    if not isinstance(numericLevel, int):
        raise ValueError('Invalid log level: %s' % logLevel)
    log = logging.getLogger('pimixture')
    log.setLevel(numericLevel)
    return log

def getFileLogger(fileName):
    log = getLogger()
    logFolder = config.get('log', 'log_folder')
    if logFolder and not os.path.exists(logFolder):
        os.makedirs(logFolder)
    logFileName = os.path.join(logFolder, fileName)
    fileHandler = TimedRotatingFileHandler(logFileName, when='midnight', interval=1, backupCount=60)
    fileHandler.setFormatter(stdFormatter)
    log.addHandler(fileHandler)
    return log

def getConsoleLogger(formatter):
    log = getLogger()
    stdHandler = logging.StreamHandler()
    stdHandler.setFormatter(formatter)
    log.addHandler(stdHandler)
    return log


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

def send_mail(sender, recipient, subject, contents, log, attachments=None):
    """Sends an email to the provided recipient

    Arguments:
        - sender {string} -- The sender of the email
        - recipient {string} -- The recipient of the email, can be ',' separated if multiple recipient
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
        contents = contents if type(contents) is str else contents.encode('utf-8')
        message.attach(MIMEText(contents, 'html', 'utf-8'))

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
        server.sendmail(sender, recipient.split(','), message.as_string())
        return True
    except Exception as e:
        log.error(e)
        return False
    finally:
        if server and getattr(server, 'quit'):
            server.quit()

def formatTime(sec):
    DAY = 60 * 60 * 24
    HOUR = 60 * 60
    MINUTE = 60
    days = 0 if sec < DAY else int(sec // DAY)
    sec %= DAY
    hours = 0 if sec < HOUR else int(sec // HOUR)
    sec %= HOUR
    minutes = 0 if sec < MINUTE else int(sec // MINUTE)
    sec %= MINUTE
    time = ''
    if days > 1:
        time += '{} days'.format(days)
    elif days == 1:
        time += '1 day'

    if hours > 1:
        if time:
            time += ' '
        time += '{} hours'.format(hours)
    elif hours == 1:
        if time:
            time += ' '
        time += ' 1 hour'
    else:
        if time:
            time += ' 0 hours'

    if minutes > 1:
        if time:
            time += ' '
        time += '{} minutes'.format(minutes)
    elif minutes == 1:
        if time:
            time += ' '
        time += '1 minute'
    else:
        if time:
            time+= ' 0 minutes'

    if sec == 1:
        if time:
            time += ' '
        time += '1 second'
    else:
        if time:
            sec = round(sec)
            if sec == 1:
                time += ' 1 second'
            else:
                time += ' {:.0f} seconds'.format(sec)
        else:
            time += '{:.2f} seconds'.format(sec)
    return time
