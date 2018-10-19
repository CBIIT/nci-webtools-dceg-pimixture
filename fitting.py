import pyper as pr
import json
import os, sys
import linecache
import csv

from util import *

def fitting(parameters, outputCSVFileName):
    try:
        rOutput = None
        r = pr.R()
        r(IMPORT_R_WRAPPER)
        r.assign('parameters',json.dumps(parameters))
        rOutput = r('returnFile = runCalculation(parameters)')
        log.info(rOutput)
        returnFile = r.get('returnFile')
        del r
        if not returnFile:
            return {'status': False, "message": 'R output:<br>{}'.format(rOutput)}
        rOutput = None
        with open(returnFile) as file:
            results = json.loads(file.read())
        os.remove(returnFile)
        os.remove(parameters['filename'])
        results['prediction.results'] = None
        results['csvFile'] = outputCSVFileName
        results['suffix'] = FITTING_SUFFIX

        if 'jobName' in parameters:
            results['jobName'] = parameters['jobName']

        writeToCSVFile(outputCSVFileName, parameters, results)
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
            log.exception('Exception happend!')
            return {"status": False, "message": message}
        else:
            log.error(rOutput)
            return {"status": False, "message": 'R output:<br>{}'.format(rOutput)}

def writeToCSVFile(filename, parameters, results):
    with open(filename, 'w') as outputCSVFile:
        writer = csv.writer(outputCSVFile, dialect='excel')
        writer.writerow(['Job Parameters'])
        writer.writerow(['Name', 'Value'])
        savedParameters = [ {'field': 'jobName', 'name': 'Job Name'},
                            {'field': 'inputCSVFile', 'name': 'Input File'},
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
                            {'field': 'email', 'name': 'Email'}
                            ]

        for param in savedParameters:
            key = param['field']
            name = param['name']
            if key in parameters:
                val = parameters[key]
                if hasattr(val, 'filename'):
                    writer.writerow([name, val.filename])
                elif key == 'covariatesArr':
                    writer.writerow(['Covariate Configuaration'])
                    writer.writerow(['', 'Covariate', 'Variable Type', 'Reference Level'])
                    for cov in val:
                        writer.writerow(['', cov['text'], cov['type'], cov['category']])
                elif key == 'covariatesSelection':
                    writer.writerow([name, ' + '.join(val)])
                elif key == 'design':
                    val =  'Cohort (Weighted)' if val == 1 else 'Cohort (Unweighted)'
                    writer.writerow([name, val])
                elif key == 'model':
                    val = 'Parametric' if val == 'logistic-Weibull' else val
                    writer.writerow([name, val])
                elif val:
                    writer.writerow([name, val])

        writer.writerow([])
        writer.writerow(['Data Summary'])
        writer.writerow(['Label', 'Number of the cases'])
        for key, val in results['data.summary'].items():
            writer.writerow([key, val])

        writer.writerow([])
        fieldNamesMapping = {'Model': 'Model', 'Label': 'Label', 'SE': 'Standard Error', '95%LL': 'Lower Confidence Limit (95%)', '95%UL': 'Upper Confidence Limit (95%)', 'Coef.': 'Coefficient', 'exp(Coef.)': 'OR'}
        writeResults(writer, 'Regression coefficient estimates', results['regression.coefficient'],
                     ['Model', 'Label', 'Coef.'], fieldNamesMapping)

        writer.writerow([])
        if parameters['model'] == 'logistic-Weibull':
            writer.writerow(['Prevalence Odds Ratio (OR)'])
            writer.writerow(['Model', 'Label', 'OR', 'Standard Error', 'Lower Confidence Limit (95%)', 'Upper Confidence Limit (95%)'])
            for val in results['odds.ratio']:
                writer.writerow(['', ''] + val)
        else:
            writeResults(writer, 'Prevalence Odds Ratio (OR)', results['odds.ratio'],
                         ['Model', 'Label', 'exp(Coef.)'], fieldNamesMapping)

        writer.writerow([])
        if parameters['model'] == 'logistic-Weibull':
            writer.writerow(['Incidence Hazard Ration (HR)'])
            writer.writerow(['Model', 'Label', 'HR', 'Standard Error', 'Lower Confidence Limit (95%)', 'Upper Confidence Limit (95%)'])
            for val in results['hazard.ratio']:
                writer.writerow(['', ''] + val)
        else:
            fieldNamesMapping['exp(Coef.)'] = 'HR'
            writeResults(writer, 'Incidence Hazard Ration (HR)', results['hazard.ratio'],
                         ['Model', 'Label', 'exp(Coef.)'], fieldNamesMapping)
    pass

def writeResults(writer, subtitle, results, fieldNames, fieldNamesMapping):
    if len(results) > 0:
        if 'SE' in results[0]:
            fieldNames.append('SE')
        if '95%LL' in results[0]:
            fieldNames.append('95%LL')
        if '95%UL' in results[0]:
            fieldNames.append('95%UL')

    writer.writerow([subtitle])
    writer.writerow([fieldNamesMapping[field] for field in fieldNames])
    for val in results:
        writer.writerow([val[field] for field in fieldNames])
