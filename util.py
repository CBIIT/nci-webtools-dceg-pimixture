import os, sys
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from ConfigParser import SafeConfigParser
import logging as log

config = SafeConfigParser()
config_file = os.environ.get('PIMIXTURE_CONFIG_FILE', 'config.ini')
config.read(config_file)

logLevel = config.get('log', 'log_level')
numericLevel = getattr(log, logLevel.upper(), None)
if not isinstance(numericLevel, int):
    raise ValueError('Invalid log level: %s' % logLevel)

log.basicConfig(level=numericLevel, format='%(asctime)s [%(levelname)s] %(module)s - %(message)s')

# log = logging.getLogger('pimixture')
# stdHandler = logging.StreamHandler(sys.stdout)
# stdHandler.setLevel(logging.INFO)
# stdFormatter = logging.Formatter('%(asctime)s [%(levelname)s] %(module)s - %(message)s')
# stdHandler.setFormatter(stdFormatter)
# log.addHandler(stdHandler)

# Mail setttings
HOST = config.get('mail', 'host')
SENDER = config.get('mail', 'sender')

# Folder settings
INPUT_DATA_PATH = config.get('folders', 'input_data_path')
log.info('INPUT_DATA_PATH: {}'.format(INPUT_DATA_PATH))
if not os.path.isdir(INPUT_DATA_PATH):
    os.makedirs(INPUT_DATA_PATH)

OUTPUT_DATA_PATH = config.get('folders', 'output_data_path')
log.info('OUTPUT_DATA_PATH: {}'.format(OUTPUT_DATA_PATH))
if not os.path.isdir(OUTPUT_DATA_PATH):
    os.makedirs(OUTPUT_DATA_PATH)

# Prefix settings
INPUT_FILE_PREFIX = config.get('prefixes', 'input_file_prefix')
OUTPUT_FILE_PREFIX = config.get('prefixes', 'output_file_prefix')

# Suffix settings
FITTING_SUFFIX = config.get('suffixes', 'fitting_suffix')
PREDICTION_SUFFIX = config.get('suffixes', 'prediction_suffix')

# S3 settings
INPUT_BUCKET = config.get('s3', 'input_bucket')
OUTPUT_BUCKET = config.get('s3', 'output_bucket')
URL_EXPIRE_TIME = int(config.get('s3', 'url_expire_time'))

# SQS settings
QUEUE_NAME = config.get('sqs', 'queue_name')
QUEUE_MSG_RETENTION_SECONDS = config.get('sqs', 'queue_msg_retention_seconds')
VISIBILITY_TIMEOUT = int(config.get('sqs', 'visibility_timeout'))
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
        server.quit()
