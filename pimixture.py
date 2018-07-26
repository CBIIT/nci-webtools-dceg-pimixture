import json, os, sys, time
import linecache
from flask import Flask, jsonify, request, Response, send_from_directory
import pyper as pr

app = Flask(__name__)

def buildFailure(message,statusCode = 500):
    response = jsonify(message)
    response.status_code = statusCode
    response.headers['Content-Type'] = 'application/json'
    return response

def buildSuccess(message):
    def generate():
        forOutput = ""
        for chunk in json.JSONEncoder().iterencode(message):
            forOutput += chunk
            if (len(forOutput) > 10000):
                yield forOutput
                forOutput = ""
        yield forOutput
    response = Response(generate(), status=200)
    response.headers['Content-Type'] = 'application/json'
    return response

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
        inputFileName = None
        if (len(request.files) > 0):
            userFile = request.files['csvFile']
            inputFileName = "pimixtureInput_" + time.strftime("%Y_%m_%d_%H_%M_%S") + os.path.splitext(userFile.filename)[1]
            outputFileName = "pimixtureOutput_" + time.strftime("%Y_%m_%d_%H_%M_%S") + os.path.splitext(userFile.filename)[1]
            saveFile = userFile.save(os.path.join('tmp',inputFileName))
            if os.path.isfile(os.path.join('tmp', inputFileName)):
                print("Successfully Uploaded")
        parameters = dict(request.form)
        for field in parameters:
            parameters[field] = parameters[field][0]
        parameters['filename'] = os.path.join('tmp',inputFileName)
        parameters['outputFilename'] = os.path.join('tmp',outputFileName)

        r = pr.R();
        r('source("./pimixtureWrapper.R")')
        r.assign('parameters',json.dumps(parameters));
        r('returnFile = runCalculation(parameters)')
        returnFile = r['returnFile']
        del r
        with open(returnFile) as file:
            results = json.loads(file.read())
        os.remove(returnFile)
        os.remove(parameters['filename'])
        results['prediction.results'] = None
        response = buildSuccess(results)
    except Exception as e:
        exc_type, exc_obj, tb = sys.exc_info()
        f = tb.tb_frame
        lineno = tb.tb_lineno
        inputFileName = f.f_code.co_filename
        linecache.checkcache(inputFileName)
        line = linecache.getline(inputFileName, lineno, f.f_globals)
        print('EXCEPTION IN ({}, LINE {} "{}"): {}'.format(inputFileName, lineno, line.strip(), exc_obj))
        response = buildFailure({"status": False, "statusMessage":"An unknown error occurred"})
    finally:
        return response

@app.route('/predict', methods=["POST"])
def runPredict():
    try:
        parameters = dict(request.json)
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
        response = buildSuccess(results)
    except Exception as e:
        exc_type, exc_obj, tb = sys.exc_info()
        f = tb.tb_frame
        lineno = tb.tb_lineno
        errFileName = f.f_code.co_filename
        linecache.checkcache(errFileName)
        line = linecache.getline(errFileName, lineno, f.f_globals)
        print('EXCEPTION IN ({}, LINE {} "{}"): {}'.format(errFileName, lineno, line.strip(), exc_obj))
        response = buildFailure({"status": False, "statusMessage":"An unknown error occurred"})
    finally:
        return response

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

    
    app.run(host = '0.0.0.0', port = args.port, debug = args.debug, use_evalex = False)
