import pyper as pr
import json
import linecache
import csv
import time
import sys
from util import *
from threading import Timer

from SSWriter import *

if SS_FILE_TYPE == EXCEL_FORMAT:
    from openpyxl import Workbook


def killR(r, log):
    log.info('Timeout reached, killing R process ...')
    r.prog.kill()
    r.prog = None
    log.info('R process killed.')

def fitting(parameters, outputSSFileName, fileType, log, timeout):
    try:
        rOutput = None
        r = pr.R()
        timer = None
        if timeout:
            timer = Timer(timeout, killR, [r, log])
            timer.start()
        startTime = time.time()
        r(IMPORT_R_WRAPPER)
        r.assign('parameters',json.dumps(parameters))
        rOutput = r('returnFile = runCalculation(parameters)')
        if not r.prog:
            del(r)
            return {'status': False, 'canceled': True,
                    'message': '{} timeout reached, calculation has been canceled!'.format(formatTime(timeout))}
        elif timer:
            log.info('Canceling the timer')
            timer.cancel()
        log.info(rOutput)
        returnFile = r.get('returnFile')
        del(r)
        if not returnFile:
            return {'status': False, "message": 'R output:<br>{}'.format(rOutput)}
        rOutput = None
        with open(returnFile) as file:
            results = json.loads(file.read())
        os.remove(returnFile)
        os.remove(parameters['filename'])
        results['prediction.results'] = None
        results['ssFile'] = outputSSFileName
        results['extension'] = extensionMap[fileType]
        results['fileType'] = fileType
        results['rSuffix'] = FITTING_R_SUFFIX
        results['ssSuffix'] = FITTING_SS_SUFFIX
        results['execTime'] = time.time() - startTime

        if 'jobName' in parameters:
            results['jobName'] = parameters['jobName']

        writeToSSFile(fileType, outputSSFileName, parameters, results, log)

        return {'status': True, 'results': results}
    except Exception as e:
        if not rOutput:
            exc_type, exc_obj, tb = sys.exc_info()
            f = tb.tb_frame
            lineno = tb.tb_lineno
            inputFileName = f.f_code.co_filename
            linecache.checkcache(inputFileName)
            line = linecache.getline(inputFileName, lineno, f.f_globals)
            message = 'EXCEPTION IN ({}, LINE {} "{}"): {}'.format(inputFileName, lineno, line.strip(), exc_obj)
            # print(message)
            log.exception('Exception happened!')
            return {"status": False, "message": message}
        else:
            log.error(rOutput)
            return {"status": False, "message": 'R output:<br>{}'.format(rOutput)}

covariateTypeMap = { 'nominal': 'Categorical',
                     'continuous': 'Continuous'}

def getResultData(results, fieldNames, fieldNamesMapping):
    data = []
    if len(results) > 0:
        if 'SE' in results[0]:
            fieldNames.append('SE')
        if '95%LL' in results[0]:
            fieldNames.append('95%LL')
        if '95%UL' in results[0]:
            fieldNames.append('95%UL')

    data.append([fieldNamesMapping[field] for field in fieldNames])
    for val in results:
        data.append([val[field] for field in fieldNames])

    return data

def writeToSSFile(type, filename, parameters, results, log):
    writer = SSWriter(filename, type, log)
    writer.setTitle('Model Parameters')
    data = []
    data.append(['Name', 'Value'])

    for param in savedParameters:
        key = param['field']
        name = param['name']
        if key in parameters:
            val = parameters[key]
            if key in ssExcludedFields:
                continue
            elif hasattr(val, 'filename'):
                data.append([name, val.filename])
            elif key == 'covariatesArr':
                data.append(['Covariate Configuaration'])
                for cov in val:
                    data.append(['', '{}: {} = {}'.format(cov['text'], covariateTypeMap[cov['type']], cov['category'])])
            elif key == 'covariatesSelection':
                data.append([name, ' + '.join(val)])
            elif key == 'design':
                val =  'Cohort (Weighted)' if val == 1 else 'Cohort (Unweighted)'
                data.append([name, val])
            elif key == 'model':
                val = 'Parametric' if val == 'logistic-Weibull' else val
                data.append([name, val])
            elif val:
                data.append([name, val])

    writer.writeData(data)

    writer.newSheet('Data Summary')
    data = []
    data.append(['Label', 'Number of the cases'])
    for key, val in results['data.summary'].items():
        data.append([key, val])
    writer.writeData(data)

    writer.newSheet('Regression coefficients')
    fieldNamesMapping = {'Model': 'Model', 'Label': 'Label', 'SE': 'Standard Error', '95%LL': 'Lower Confidence Limit (95%)', '95%UL': 'Upper Confidence Limit (95%)', 'Coef.': 'Coefficient', 'OR': 'OR', 'HR': 'HR'}
    data = getResultData(results['regression.coefficient'], ['Model', 'Label', 'Coef.'], fieldNamesMapping)
    writer.writeData(data)


    writer.newSheet('Prevalence Odds Ratio (OR)')
    data = getResultData(results['odds.ratio'], ['Model', 'Label', 'OR'], fieldNamesMapping)
    writer.writeData(data)

    writer.newSheet('Incidence Hazard Ration (HR)')
    data = getResultData(results['hazard.ratio'], ['Model', 'Label', 'HR'], fieldNamesMapping)
    writer.writeData(data)

    writer.save()
