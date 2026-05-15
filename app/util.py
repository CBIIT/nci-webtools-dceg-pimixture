import os
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
from logging.handlers import TimedRotatingFileHandler
import pyper as pr


# Log settings
logFileName = os.environ.get('LOG_FILE_NAME', 'pimixture-app.log')
processorLogFileName = os.environ.get('PROCESSOR_LOG_FILE_NAME', 'pimixture-processor.log')

# Mail settings
ADMIN = os.environ.get('EMAIL_ADMIN', '')
HOST = os.environ.get('EMAIL_SMTP_HOST', 'mailfwd.nih.gov')
SENDER = os.environ.get('EMAIL_SENDER', '')
REPORT_URL = os.environ.get('EMAIL_REPORT_URL', '')

# Folder settings
INPUT_DATA_PATH = os.environ.get('INPUT_DATA_PATH', '/data/input')
if not os.path.exists(INPUT_DATA_PATH):
    os.makedirs(INPUT_DATA_PATH)

OUTPUT_DATA_PATH = os.environ.get('OUTPUT_DATA_PATH', '/data/output')
if not os.path.exists(OUTPUT_DATA_PATH):
    os.makedirs(OUTPUT_DATA_PATH)

# Prefix settings
INPUT_FILE_PREFIX = os.environ.get('INPUT_FILE_PREFIX', 'pimixtureInput_')
OUTPUT_FILE_PREFIX = os.environ.get('OUTPUT_FILE_PREFIX', 'pimixtureOutput_')

# Suffix settings
FITTING_R_SUFFIX = os.environ.get('FITTING_R_SUFFIX', '_fit')
FITTING_SS_SUFFIX = os.environ.get('FITTING_SS_SUFFIX', '_fit_results')
PREDICTION_SUFFIX = os.environ.get('PREDICTION_SUFFIX', '_prediction')

# S3 settings
INPUT_BUCKET = os.environ.get('S3_INPUT_BUCKET', '')
OUTPUT_BUCKET = os.environ.get('S3_OUTPUT_BUCKET', '')
URL_EXPIRE_TIME = int(os.environ.get('S3_URL_EXPIRE_TIME', '1209600'))
S3_INPUT_FOLDER = os.environ.get('S3_INPUT_FOLDER', 'pimixture/input/')
S3_OUTPUT_FOLDER = os.environ.get('S3_OUTPUT_FOLDER', 'pimixture/output/')

# SQS settings
QUEUE_NAME = os.environ.get('SQS_QUEUE_NAME', '')
VISIBILITY_TIMEOUT = int(os.environ.get('SQS_VISIBILITY_TIMEOUT', '30'))
QUEUE_LONG_PULL_TIME = int(os.environ.get('SQS_QUEUE_LONG_PULL_TIME', '20'))

# Output settings
SS_FILE_TYPE = os.environ.get('OUTPUT_FILE_TYPE', 'EXCEL')

# R settings
FITTING_TIMEOUT = int(os.environ.get('R_FITTING_TIMEOUT', '86400'))

# Constants
IMPORT_R_WRAPPER = 'source("R/pimixtureWrapper.R")'
CSV_FORMAT = 'CSV'
EXCEL_FORMAT = 'EXCEL'

extensionMap = {
    CSV_FORMAT: '.csv',
    EXCEL_FORMAT: '.xlsx'
}

_pimixture_version = None

def getPIMixtureVersion():
    global _pimixture_version
    if _pimixture_version is None:
        try:
            r = pr.R()
            r(IMPORT_R_WRAPPER)
            r('version <- getPIMixtureVersion()')
            _pimixture_version = r.get('version') or 'unknown'
        except Exception:
            _pimixture_version = 'unknown'
    return _pimixture_version


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
    logLevel = os.environ.get('LOG_LEVEL', 'INFO')
    numericLevel = getattr(logging, logLevel.upper(), None)
    if not isinstance(numericLevel, int):
        raise ValueError('Invalid log level: %s' % logLevel)
    log = logging.getLogger('pimixture')
    log.setLevel(numericLevel)
    return log

def getFileLogger(fileName):
    log = getLogger()
    logFolder = os.environ.get('LOG_FOLDER', '')
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
        # send email
        server = smtplib.SMTP(HOST)
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
