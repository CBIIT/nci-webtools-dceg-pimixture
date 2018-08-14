import json, os, sys, time
import linecache
from flask import Flask, jsonify, request, Response, send_from_directory
import pyper as pr
import csv
import uuid
import codecs

app = Flask(__name__)

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

def buildFailure(message,statusCode = 500):
    response = jsonify(message)
    response.status_code = statusCode
    return response

def buildSuccess(message):
    return jsonify(message)


@app.route('/templateList', methods=["GET"])
def templates():
    templateSet = {}
    path = os.path.join(os.getcwd(),'templates')
    for fileName in [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f)) and f.endswith('.html')]:
        with open(os.path.join(path,fileName)) as file:
            templateSet[fileName[:-5]] = file.read()
    return jsonify(templateSet)

@app.route('/run', methods=["POST"])
def runModel():
    try:
        if request.form and request.form['jsonData']:
            parameters = json.loads(request.form['jsonData'])
        else:
            message = "Missing input jsonData!"
            print(message)
            return buildFailure(message, 400)

        inputFileName = None
        id = str(uuid.uuid4())
        if (len(request.files) > 0):
            inputCSVFile = request.files['csvFile']
            ext = os.path.splitext(inputCSVFile.filename)[1]
            inputFileName = getInputFilePath(id, ext)
            inputCSVFile.save(inputFileName)
            if not os.path.isfile(inputFileName):
                message = "Upload file failed!"
                print(message)
                return buildFailure(message, 500)
        outputRdsFileName = getOutputFilePath(id, '.rds')
        outputCSVFileName = getOutputFilePath(id, '.csv')
        outputFileName = getOutputFilePath(id, '.out')
        parameters['filename'] = inputFileName
        parameters['outputRdsFilename'] = outputRdsFileName
        parameters['outputFilename'] = outputFileName

        r = pr.R();
        r('source("./pimixtureWrapper.R")')
        r.assign('parameters',json.dumps(parameters))
        print(r('returnFile = runCalculation(parameters)'))
        returnFile = r.get('returnFile')
        del r
        if not returnFile:
            message = "Got an error when trying to run PIMixture() function!"
            print(message)
            return buildFailure(message, 500)
        with open(returnFile) as file:
            results = json.loads(file.read())
        os.remove(returnFile)
        os.remove(parameters['filename'])
        results['prediction.results'] = None
        results['csvFile'] = outputCSVFileName
        with open(outputCSVFileName, 'w') as outputCSVFile:
            writer = csv.writer(outputCSVFile, dialect='excel')
            writer.writerow(['Data Summary'])
            writer.writerow(['Label', 'Number of the cases'])
            for key, val in results['data.summary'].items():
                writer.writerow([key, val])

            writer.writerow([])
            writer.writerow(['Regression coefficient estimates'])
            writer.writerow(['Model', 'Label', 'Coefficient'])
            for val in results['regression.coefficient']:
                writer.writerow([val['Model'], val['Label'], val['Coef.']])

            writer.writerow([])
            writer.writerow(['Odds Ratio (OR) for the prevalence'])
            writer.writerow(['Model', 'Label', 'OR'])
            for val in results['odds.ratio']:
                writer.writerow([val['Model'], val['Label'], val['exp(Coef.)']])

            writer.writerow([])
            writer.writerow(['Hazard Ratio (HR) for the incidence'])
            writer.writerow(['Model', 'Label', 'HR'])
            for val in results['hazard.ratio']:
                writer.writerow([val['Model'], val['Label'], val['exp(Coef.)']])

        return buildSuccess(results)
    except Exception as e:
        exc_type, exc_obj, tb = sys.exc_info()
        f = tb.tb_frame
        lineno = tb.tb_lineno
        inputFileName = f.f_code.co_filename
        linecache.checkcache(inputFileName)
        line = linecache.getline(inputFileName, lineno, f.f_globals)
        print('EXCEPTION IN ({}, LINE {} "{}"): {}'.format(inputFileName, lineno, line.strip(), exc_obj))
        return buildFailure({"status": False, "statusMessage":"An unknown error occurred"})

@app.route('/predict', methods=["POST"])
def runPredict():
    try:
        if request.form and request.form['jsonData']:
            parameters = json.loads(request.form['jsonData'])
        else:
            message = "Missing input jsonData!"
            print(message)
            return buildFailure(message, 400)

        id = str(uuid.uuid4())
        filesToRemoveWhenDone = []
        if 'serverFile' in parameters:
            rdsFile = parameters['serverFile']
            if os.path.isfile(rdsFile):
                # Server file exists
                parameters['rdsFile'] = rdsFile
            else:
                message = "Server file '{}' doesn't exit on server anymore!<br>Please upload model file you downloaded previousely.".format(rdsFile)
                print(message)
                return buildFailure(message, 410)
        elif len(request.files) > 0 and 'rdsFile' in request.files:
            rdsFile = request.files['rdsFile']
            ext = os.path.splitext(rdsFile.filename)[1]
            inputRdsFileName = getInputFilePath(id, ext)
            rdsFile.save(inputRdsFileName)
            if os.path.isfile(inputRdsFileName):
                parameters['rdsFile'] = inputRdsFileName
                filesToRemoveWhenDone.append(inputRdsFileName)
            else:
                message = "Upload RDS file failed!"
                print(message)
                return buildFailure(message, 500)
        else:
            message = "Missing model file!"
            print(message)
            return buildFailure(message, 400)

        if len(request.files) > 0 and 'testDataFile' in request.files:
            testDataFile = request.files['testDataFile']
            ext = os.path.splitext(testDataFile.filename)[1]
            inputTestDataFileName = getInputFilePath(id, ext)
            # couldn't make testDataFile.stream to work with csv files with BOM character (from excel)
            # TODO: try to make testDataFile.stream work, so we don't have to save the file then open it again!
            testDataFile.save(inputTestDataFileName)
            if os.path.isfile(inputTestDataFileName):
                filesToRemoveWhenDone.append(inputTestDataFileName)
                try:
                    with codecs.open(inputTestDataFileName, encoding='utf-8-sig', mode='r') as testDataCsvFile:
                        reader = csv.reader(testDataCsvFile, dialect='excel')
                        variableNames = reader.next()
                        if variableNames:
                            testData = []
                            for row in reader:
                                obj = {}
                                for idx, val in enumerate(row):
                                    obj[variableNames[idx]] = float(val)
                                testData.append(obj)
                            if testData:
                                parameters['testData'] = testData
                except Exception as e:
                    print(e)
                    return buildFailure(str(e), 400)
            else:
                message = "Upload CSV file failed!"
                print(message)
                return buildFailure(message, 500)

        # generate timePoints from 'start', 'end' and optional 'step'
        if 'timePoints' in parameters:
            parameters['timePoints'] = [int(x) for x in parameters['timePoints']]
        else:
            if 'begin' in parameters and 'end' in parameters:
                start = int(parameters['begin'])
                end = int(parameters['end'])
                step = int(parameters['stepSize']) if 'stepSize' in parameters else 1
                parameters['timePoints'] = list(range(start, end + 1, step))

        r = pr.R()
        r('source("./pimixtureWrapper.R")')
        r.assign('parameters',json.dumps(parameters))
        rOutput = r('predictionResult = runPredict(parameters)')
        rResults = r.get('predictionResult')
        if not rResults:
            message = "Got an error when trying to run PIMixture.predict() function"
            print message
            return buildFailure(message, 500)
        del r
        results = json.loads(rResults)

        fieldNames = ['time', 'cox.predictor', 'logit.predictor', 'CR']
        id = str(uuid.uuid4())
        csvFileName = getOutputFilePath(id, '.csv')
        with open(csvFileName, 'w') as outputCSVFile:
            writer = csv.DictWriter(outputCSVFile, fieldnames=fieldNames)
            writer.writeheader()
            writer.writerows(results)

        data = {
            'results': {
                'prediction': results,
                'csvFile': csvFileName
            }
        }
        return buildSuccess(data)

    except Exception as e:
        exc_type, exc_obj, tb = sys.exc_info()
        f = tb.tb_frame
        lineno = tb.tb_lineno
        errFileName = f.f_code.co_filename
        linecache.checkcache(errFileName)
        line = linecache.getline(errFileName, lineno, f.f_globals)
        print('EXCEPTION IN ({}, LINE {} "{}"): {}'.format(errFileName, lineno, line.strip(), exc_obj))
        return buildFailure({"status": False, "statusMessage":"An unknown error occurred"})

    finally:
        if filesToRemoveWhenDone:
            for filename in filesToRemoveWhenDone:
                if os.path.isfile(filename):
                    os.remove(filename)

@app.route('/uploadModel', methods=["POST"])
def uploadModelFile():
    try:
        if len(request.files) > 0 and 'rdsFile' in request.files:
            id = str(uuid.uuid4())
            modelFile = request.files['rdsFile']
            ext = os.path.splitext(modelFile.filename)[1]
            inputModelFileName = getInputFilePath(id, ext)
            modelFile.save(inputModelFileName)
            if os.path.isfile(inputModelFileName):
                r = pr.R()
                r('source("./pimixtureWrapper.R")')
                r.assign('params', json.dumps({'rdsFile': inputModelFileName}))
                params = r.get('params')
                print(params)
                print(r('covariates <- readFromRDS(params)'))
                results = r.get('covariates')
                if results:
                    covariatesArr = json.loads(results)
                    if len(covariatesArr) > 0:
                        return buildSuccess({
                                'serverFile': inputModelFileName,
                                'covariatesArr': covariatesArr
                            })
                    else:
                        message = "Couldn't read covariates from RDS file!"
                        print message
                        return buildFailure(message, 400)
                else:
                    message = "Couldn't read covariates from RDS file!"
                    print message
                    return buildFailure(message, 400)
            else:
                message = "Upload RDS file failed!"
                print message
                return buildFailure(message, 500)
        else:
            message = "No valid RDS file provided!"
            print message
            return buildFailure(message, 500)

    except Exception as e:
        exc_type, exc_obj, tb = sys.exc_info()
        f = tb.tb_frame
        lineno = tb.tb_lineno
        errFileName = f.f_code.co_filename
        linecache.checkcache(errFileName)
        line = linecache.getline(errFileName, lineno, f.f_globals)
        print('EXCEPTION IN ({}, LINE {} "{}"): {}'.format(errFileName, lineno, line.strip(), exc_obj))
        return buildFailure({"status": False, "statusMessage":"An unknown error occurred"})


def getInputFilePath(id, extention):
    return getFilePath(INPUT_DATA_PATH, INPUT_FILE_PREFIX, id, extention)


def getOutputFilePath(id, extention):
    return getFilePath(OUTPUT_DATA_PATH, OUTPUT_FILE_PREFIX, id, extention)

def getFilePath(path, prefix, id, extention):
    filename = prefix + id + extention
    return os.path.join(path, filename)

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()

    # Default port is 9200
    parser.add_argument('-p', '--port', type = int, dest = 'port', default = 80, help = 'Sets the Port')
    parser.add_argument('-d', '--debug', action = 'store_true', help = 'Enables debugging')
    args = parser.parse_args()
    if (args.debug):
        @app.route('/common/<path:path>')
        def common_folder(path):
            return send_from_directory("common",path)

        @app.route('/<path:path>')
        def static_files(path):
            if (path.endswith('/')):
                path += 'index.html'
            return send_from_directory(os.getcwd(),path)

        @app.route('/')
        def rootPath():
            return send_from_directory(os.getcwd(), 'index.html')

        app.run(port = args.port, debug = args.debug, use_evalex = False)
    else:
        app.run(host = '0.0.0.0', port = args.port, debug = False, use_evalex = False)
