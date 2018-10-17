import json, os, sys, time
import linecache
from flask import Flask, jsonify, request, Response, send_from_directory
import pyper as pr
import csv
import uuid
import codecs
from sqs import Queue
from s3 import S3Bucket
from fitting import *

app = Flask(__name__)

from util import *

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
            log.error(message)
            return buildFailure(message, 400)

        sendToQueue = parameters.get('sendToQueue', False)

        inputFileName = None
        id = str(uuid.uuid4())
        if (len(request.files) > 0):
            inputCSVFile = request.files['csvFile']
            ext = os.path.splitext(inputCSVFile.filename)[1]
            if sendToQueue:
                bucket = S3Bucket(INPUT_BUCKET)
                object = bucket.uploadFileObj('{}{}'.format(id, ext), inputCSVFile)
                if object:
                    parameters['inputCSVFile'] = {
                        'originalName': inputCSVFile.filename,
                        'bucket': object.bucket_name,
                        'key': object.key
                    }
                else:
                    message = "Upload CSV file to S3 failed!"
                    log.error(message)
                    return buildFailure(message, 500)

            else:
                parameters['inputCSVFile'] = inputCSVFile.filename
                inputFileName = getInputFilePath(id, ext)
                inputCSVFile.save(inputFileName)
                if not os.path.isfile(inputFileName):
                    message = "Upload file failed!"
                    log.error(message)
                    return buildFailure(message, 500)
                outputRdsFileName = getOutputFilePath(id, '.rds')
                outputCSVFileName = getOutputFilePath(id, '.csv')
                outputFileName = getOutputFilePath(id, '.out')
                parameters['filename'] = inputFileName
                parameters['outputRdsFilename'] = outputRdsFileName
                parameters['outputFilename'] = outputFileName
        else:
            message = 'No input data (CSV) file, please upload a data file!'
            log.warning(message)
            return buildFailure(message, 400)

        columns = [parameters['outcomeC'], parameters['outcomeL'],  parameters['outcomeR']]
        if 'design' in parameters and parameters['design'] == 1:
            columns += [parameters['strata'], parameters['weight']]
            parameters['weightInfo'] = [{'samp.weight': parameters['weight'],
                                        'strata': parameters['strata']}]
        if parameters['covariatesSelection']:
            columns += parameters['covariatesSelection']
            covariates = ' + '.join(parameters['covariatesSelection'])

            if 'effects' in parameters:
                effects = [x[0] + ' * ' + x[1] for x in parameters['effects']]
                if effects:
                    covariates += ' + ' + ' + '.join(effects)
                    parameters['effects'] = ' + '.join(effects)
            parameters['covariates'] = covariates
        parameters['columns'] = columns

        if sendToQueue:
            # Send parameters to queue
            sqs = Queue()
            sqs.sendMsgToQueue({
                'parameters': parameters,
                'jobId': id,
                'extension': ext,
                'jobType': 'fitting'
            }, id)
            return buildSuccess( {
                'enqueued': True,
                'jobId': id,
                'message': 'Job "{}" has been added to queue successfully!'.format(parameters.get('jobName', 'PIMixture'))
            })
        else:
            fittingResult = fitting(parameters, outputCSVFileName)
            if fittingResult['status']:
                return buildSuccess(fittingResult['results'])
            else:
                return buildFailure(fittingResult)

    except Exception as e:
        exc_type, exc_obj, tb = sys.exc_info()
        f = tb.tb_frame
        lineno = tb.tb_lineno
        inputFileName = f.f_code.co_filename
        linecache.checkcache(inputFileName)
        line = linecache.getline(inputFileName, lineno, f.f_globals)
        log.exception("Exception occurred")
        return buildFailure({"status": False, "message":"An unknown error occurred"})

@app.route('/predict', methods=["POST"])
def runPredict():
    try:
        rOutput = None
        if request.form and request.form['jsonData']:
            parameters = json.loads(request.form['jsonData'])
        else:
            message = "Missing input jsonData!"
            log.error(message)
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
                log.error(message)
                return buildFailure(message, 410)
        elif 'uploadedFile' in parameters:
            rdsFile = parameters['uploadedFile']
            if os.path.isfile(rdsFile):
                # uploaded file exists
                parameters['rdsFile'] = rdsFile
                filesToRemoveWhenDone.append(rdsFile)
            else:
                message = "Uploaded file '{}' doesn't exit on server anymore!<br>Please upload model file you downloaded previousely.".format(rdsFile)
                log.error(message)
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
                log.error(message)
                return buildFailure(message, 500)
        else:
            message = "Missing model file!"
            log.error(message)
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
                parameters['testDataFile'] = inputTestDataFileName
            else:
                message = "Upload test data file failed!"
                log.error(message)
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
        r(IMPORT_R_WRAPPER)
        r.assign('parameters',json.dumps(parameters))
        rOutput = r('predictionResult = runPredict(parameters)')
        log.info(rOutput)
        rResults = r.get('predictionResult')
        if not rResults:
            return buildFailure(rOutput, 500)
        del r
        rOutput = None
        predictionResult = json.loads(rResults)
        results = predictionResult['predict']
        model = predictionResult['model']

        fieldNames = ['time', 'Subgroup', 'CR']
        if len(results) > 0:
            # Parametric model prediction result has 'times' instead of 'time'
            if 'times' in results[0]:
                for pred in results:
                    pred['time'] = pred['times']
                    del(pred['times'])
            if 'CR.se' in results[0]:
                fieldNames.append('CR.se')
            if 'LL95' in results[0]:
                fieldNames.append('LL95')
            if 'UL95' in results[0]:
                fieldNames.append('UL95')

        fieldNamesMapping = {'time': 'Time Point', 'Subgroup': 'Subgroup', 'CR.se': 'Standard Error', 'LL95': 'Lower Confidence Limit (95%)', 'UL95': 'Upper Confidence Limit (95%)', 'CR': 'CR'}

        id = str(uuid.uuid4())
        csvFileName = getOutputFilePath(id, '.csv')
        with open(csvFileName, 'w') as outputCSVFile:
            writer = csv.DictWriter(outputCSVFile, fieldnames=fieldNames, extrasaction='ignore')
            writer.writerow(fieldNamesMapping)
            writer.writerows(results)

        data = {
            'results': {
                'prediction': results,
                'model': model,
                'csvFile': csvFileName
            }
        }
        if 'jobName' in parameters:
            data['jobName'] = parameters['jobName']

        return buildSuccess(data)

    except Exception as e:
        if not rOutput:
            exc_type, exc_obj, tb = sys.exc_info()
            f = tb.tb_frame
            lineno = tb.tb_lineno
            errFileName = f.f_code.co_filename
            linecache.checkcache(errFileName)
            line = linecache.getline(errFileName, lineno, f.f_globals)
            log.exception("Exception occurred")
            return buildFailure({"status": False, "statusMessage":"An unknown error occurred"})
        else:
            log.error(rOutput)
            return buildFailure(rOutput, 500)


    finally:
        if filesToRemoveWhenDone:
            for filename in filesToRemoveWhenDone:
                if os.path.isfile(filename):
                    os.remove(filename)

@app.route('/uploadModel', methods=["POST"])
def uploadModelFile():
    try:
        rOutput = None
        if len(request.files) > 0 and 'rdsFile' in request.files:
            id = str(uuid.uuid4())
            modelFile = request.files['rdsFile']
            jobName, ext = os.path.splitext(modelFile.filename)
            inputModelFileName = getInputFilePath(id, ext)
            modelFile.save(inputModelFileName)
            if os.path.isfile(inputModelFileName):
                r = pr.R()
                r(IMPORT_R_WRAPPER)
                r.assign('params', json.dumps({'rdsFile': inputModelFileName}))
                rOutput = r('model <- readFromRDS(params)')
                log.info(rOutput)
                results = r.get('model')
                del r
                rOutput = None
                if results:
                    model = json.loads(results)
                    maxTimePoint = model['maxTimePoint'][0]
                    if (len(model['jobName'])):
                        jobName = model['jobName'][0]
                    return buildSuccess({
                        'jobName': jobName,
                        'maxTimePoint': maxTimePoint,
                        'uploadedFile': inputModelFileName
                        })
                else:
                    message = "Couldn't read Time Points from RDS file!"
                    log.error(message)
                    return buildFailure(message, 400)
            else:
                message = "Upload RDS file failed!"
                log.error(message)
                return buildFailure(message, 500)
        else:
            message = "No valid RDS file provided!"
            log.error(message)
            return buildFailure(message, 500)

    except Exception as e:
        if not rOutput:
            exc_type, exc_obj, tb = sys.exc_info()
            f = tb.tb_frame
            lineno = tb.tb_lineno
            errFileName = f.f_code.co_filename
            linecache.checkcache(errFileName)
            line = linecache.getline(errFileName, lineno, f.f_globals)
            log.exception("Exception occurred")
            return buildFailure({"status": False, "statusMessage":"An unknown error occurred"})
        else:
            log.error(rOutput)
            return buildFailure(rOutput, 500)

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
