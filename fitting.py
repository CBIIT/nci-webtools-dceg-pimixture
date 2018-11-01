import pyper as pr
import json
import os, sys
import linecache
import csv
from util import *

if SS_FILE_TYPE == EXCEL_FORMAT:
    from openpyxl import Workbook

def fitting(parameters, outputSSFileName, fileType=EXCEL_FORMAT):
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
        results['ssFile'] = outputSSFileName
        results['extension'] = extensionMap[fileType]
        results['fileType'] = fileType
        results['suffix'] = FITTING_SUFFIX

        if 'jobName' in parameters:
            results['jobName'] = parameters['jobName']

        if fileType == EXCEL_FORMAT:
            writeToXLSXFile(outputSSFileName, parameters, results)
        elif fileType == CSV_FORMAT:
            writeToCSVFile(outputSSFileName, parameters, results)
        else:
            log.error('Unknow output filetype: {}'.format(fileType))

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

def writeToCSVFile(filename, parameters, results):
    with open(filename, 'w') as outputCSVFile:
        writer = csv.writer(outputCSVFile, dialect='excel')
        writer.writerow(['Job Parameters'])
        writer.writerow(['Name', 'Value'])

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

def writeResults(writer, subtitle, results, fieldNames, fieldNamesMapping):
    if len(results) > 0:
        if 'SE' in results[0]:
            fieldNames.append('SE')
        if '95%LL' in results[0]:
            fieldNames.append('95%LL')
        if '95%UL' in results[0]:
            fieldNames.append('95%UL')

    writeRow = getattr(writer, 'writerow', None)
    if not callable(writeRow):
        writeRow = getattr(writer, 'append')
    if subtitle:
        writeRow([subtitle])
    writeRow([fieldNamesMapping[field] for field in fieldNames])
    for val in results:
        writeRow([val[field] for field in fieldNames])

def writeToXLSXFile(filename, parameters, results):
    wb = Workbook()
    ws = wb.active
    ws.title = 'Model Parameters'
    ws.append(['Name', 'Value'])

    for param in savedParameters:
        key = param['field']
        name = param['name']
        if key in parameters:
            val = parameters[key]
            if hasattr(val, 'filename'):
                ws.append([name, val.filename])
            elif key == 'covariatesArr':
                ws.append(['Covariate Configuaration'])
                ws.append(['', 'Covariate', 'Variable Type', 'Reference Level'])
                for cov in val:
                    ws.append(['', cov['text'], cov['type'], cov['category']])
            elif key == 'covariatesSelection':
                ws.append([name, ' + '.join(val)])
            elif key == 'design':
                val =  'Cohort (Weighted)' if val == 1 else 'Cohort (Unweighted)'
                ws.append([name, val])
            elif key == 'model':
                val = 'Parametric' if val == 'logistic-Weibull' else val
                ws.append([name, val])
            elif val:
                ws.append([name, val])

    ws2 = wb.create_sheet(title='Data Summary')
    ws2.append(['Label', 'Number of the cases'])
    for key, val in results['data.summary'].items():
        ws2.append([key, val])

    fieldNamesMapping = {'Model': 'Model', 'Label': 'Label', 'SE': 'Standard Error', '95%LL': 'Lower Confidence Limit (95%)', '95%UL': 'Upper Confidence Limit (95%)', 'Coef.': 'Coefficient', 'exp(Coef.)': 'OR'}
    ws3 = wb.create_sheet(title='Regression coefficients')
    writeResults(ws3, None, results['regression.coefficient'], ['Model', 'Label', 'Coef.'], fieldNamesMapping)

    ws4 = wb.create_sheet(title='Prevalence Odds Ratio (OR)')
    if parameters['model'] == 'logistic-Weibull':
        ws4.append(['Model', 'Label', 'OR', 'Standard Error', 'Lower Confidence Limit (95%)', 'Upper Confidence Limit (95%)'])
        for val in results['odds.ratio']:
            ws4.append(['', ''] + val)
    else:
        writeResults(ws4, None, results['odds.ratio'], ['Model', 'Label', 'exp(Coef.)'], fieldNamesMapping)

    ws5 = wb.create_sheet(title='Incidence Hazard Ration (HR)')
    if parameters['model'] == 'logistic-Weibull':
        ws5.append(['Model', 'Label', 'HR', 'Standard Error', 'Lower Confidence Limit (95%)', 'Upper Confidence Limit (95%)'])
        for val in results['hazard.ratio']:
            ws5.append(['', ''] + val)
    else:
        fieldNamesMapping['exp(Coef.)'] = 'HR'
        writeResults(ws5, None, results['hazard.ratio'], ['Model', 'Label', 'exp(Coef.)'], fieldNamesMapping)

    wb.save(filename)

