import json, os, sys, time
import linecache
from flask import Flask, jsonify, request, Response, send_from_directory
import pyper as pr
import csv
import uuid

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
            userFile = request.files['csvFile']
            ext = os.path.splitext(userFile.filename)[1]
            inputFileName = getInputFilePath(id, ext)
            userFile.save(inputFileName)
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
        r.assign('parameters',json.dumps(parameters));
        print(r('returnFile = runCalculation(parameters)'))
        returnFile = r['returnFile']
        del r
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

        inputFileName = None
        id = str(uuid.uuid4())
        if 'serverFile' in parameters:
            rdsFile = parameters['serverFile']
            if os.path.isfile(rdsFile):
                # Server file exists
                parameters['rdsFile'] = rdsFile
            else:
                message = "Server file '{}' doesn't exit on server anymore!".format(rdsFile)
                print(message)
                return buildFailure(message, 400)
        elif (len(request.files) > 0):
            userFile = request.files['rdsFile']
            ext = os.path.splitext(userFile.filename)[1]
            inputFileName = getInputFilePath(id, ext)
            userFile.save(inputFileName)
            if os.path.isfile(inputFileName):
                parameters['rdsFile'] = inputFileName
            else:
                message = "Upload file failed!"
                print(message)
                return buildFailure(message, 500)
        else:
            message = "Missing model file!"
            print(message)
            return buildFailure(message, 400)

        # generate timePoints from 'start', 'end' and optional 'step'
        if 'timePoints' in parameters:
            parameters['timePoints'] = [int(x) for x in parameters['timePoints']]
        else:
            if 'begin' in parameters and 'end' in parameters:
                start = int(parameters['begin'])
                end = int(parameters['end'])
                step = int(parameters['stepSize']) if 'stepSize' in parameters else 1
                parameters['timePoints'] = list(range(start, end + 1, step))

        r = pr.R();
        r('source("./pimixtureWrapper.R")')
        r.assign('parameters',json.dumps(parameters));
        rOutput = r('predictionResult = runPredict(parameters)')
        rResults = r['predictionResult']
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
            'csvFile': csvFileName,
            'prediction': results
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

@app.route('/predictDummy', methods=["POST"])
def runPredictDummy():
    print("In dummy")
    try:
        parameters = dict(request.form)
        for field in parameters:
            parameters[field] = parameters[field][0]
        results = json.loads(wrapper.runPredictDummy(json.dumps(parameters))[0])
        #with open("results.json") as file:
        #    results = json.loads(file.read())
        response = buildSuccess(results)
    except Exception as e:
        exc_type, exc_obj, tb = sys.exc_info()
        f = tb.tb_frame
        lineno = tb.tb_lineno
        linecache.checkcache(filename)
        line = linecache.getline(filename, lineno, f.f_globals)
        response = buildFailure({"status": False, "statusMessage":"An unknown error occurred"})
    finally:
        return response

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
