import os

INPUT_DATA_PATH = os.environ['PIMIXTURE_INPUT_DATA_FOLDER'] if 'PIMIXTURE_INPUT_DATA_FOLDER' in os.environ else 'tmp'
print('INPUT_DATA_PATH: {}'.format(INPUT_DATA_PATH))
if not os.path.isdir(INPUT_DATA_PATH):
    os.makedirs(INPUT_DATA_PATH)

OUTPUT_DATA_PATH = os.environ['PIMIXTURE_OUTPUT_DATA_FOLDER'] if 'PIMIXTURE_OUTPUT_DATA_FOLDER' in os.environ else 'tmp'
print('OUTPUT_DATA_PATH: {}'.format(OUTPUT_DATA_PATH))
if not os.path.isdir(OUTPUT_DATA_PATH):
    os.makedirs(OUTPUT_DATA_PATH)
# TEMP_PATH = os.environ['PIMIXTURE_DATA_FOLDER'] if 'PIMIXTURE_DATA_FOLDER' in os.environ else 'tmp'

INPUT_FILE_PREFIX = 'pimixtureInput_'
OUTPUT_FILE_PREFIX = 'pimixtureOutput_'

IMPORT_R_WRAPPER = 'source("R/pimixtureWrapper.R")'

INPUT_BUCKET = 'pimixture'
OUTPUT_BUCKET = 'pimixture'

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
