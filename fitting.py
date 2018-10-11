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
        print(rOutput)
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

        if 'jobName' in parameters:
            results['jobName'] = parameters['jobName']
        with open(outputCSVFileName, 'w') as outputCSVFile:
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
            writer.writerow(['Regression coefficient estimates'])
            writer.writerow(['Model', 'Label', 'Coefficient'])
            for val in results['regression.coefficient']:
                writer.writerow([val['Model'], val['Label'], val['Coef.']])

            writer.writerow([])
            writer.writerow(['Odds Ratio (OR) for the prevalence'])
            writer.writerow(['Model', 'Label', 'OR'])
            for val in results['odds.ratio']:
                if parameters['model'] == 'logistic-Weibull':
                    writer.writerow(val)
                else:
                    writer.writerow([val['Model'], val['Label'], val['exp(Coef.)']])

            writer.writerow([])
            writer.writerow(['Hazard Ratio (HR) for the incidence'])
            writer.writerow(['Model', 'Label', 'HR'])
            for val in results['hazard.ratio']:
                if parameters['model'] == 'logistic-Weibull':
                    writer.writerow(val)
                else:
                    writer.writerow([val['Model'], val['Label'], val['exp(Coef.)']])
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
            print(message)
            return {"status": False, "message": message}
        else:
            print(rOutput)
            return {"status": False, "message": 'R output:<br>{}'.format(rOutput)}
