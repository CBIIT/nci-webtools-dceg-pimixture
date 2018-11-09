#!/usr/bin/env python
from sqs import Queue, VisibilityExtender
from s3 import S3Bucket
from urllib import urlencode
import argparse
import os, sys

from util import *
import json
from fitting import *

def copyEssentialParameters(parameters):
    essential = [ obj['field'] for obj in savedParameters ]
    result = {}
    for field in parameters:
        if field in essential:
            result[field] = parameters[field]

    return result


def sendResults(jobName, parameters, results):
    email = parameters['email']
    hostURL = parameters['hostURL']
    subject = 'PIMixture Fitting results for job "{}"'.format(jobName)
    content = '<h4>Congratulations! You PIMixture Fitting job "{}" has finished!</h4>'.format(jobName)
    content += '<p>You\'ll have 14 days to download your result files. After that, your result files will be deleted from server!</p>'
    content += '<p><a href="{}" download="{}{}.rds">Download RDS file</a></p>'.format(results['Rfile'], jobName, FITTING_R_SUFFIX)
    content += '<p><a href="{}" download="{}{}{}">Download {} file</a></p>'.format(results['ssFile'], jobName, FITTING_SS_SUFFIX, extensionMap[SS_FILE_TYPE], SS_FILE_TYPE)

    query = copyEssentialParameters(parameters)
    query['remoteRFile'] = results['Rfile']
    query['fileName'] = '{}{}.rds'.format(jobName, FITTING_R_SUFFIX)
    queryString = urlencode({ 'parameters': json.dumps(query, separators=(',', ':')) })
    buttonStyle = 'background-image: linear-gradient(to bottom,#337ab7 0,#265a88 100%);'
    buttonStyle += 'background-repeat: repeat-x;border-color: #245580;'
    buttonStyle += 'text-shadow: 0 -1px 0 rgba(0,0,0,.2);'
    buttonStyle += 'box-shadow: inset 0 1px 0 rgba(255,255,255,.15), 0 1px 1px rgba(0,0,0,.075);'
    buttonStyle += 'color: #fff;'
    buttonStyle += 'display: inline-block; padding: 6px 12px; margin-bottom: 0; font-size: 14px; font-weight: 400; line-height: 1.42857143; text-align: center; white-space: nowrap; vertical-align: middle;'
    buttonStyle += 'border: 1px solid transparent; border-radius: 4px;'
    buttonStyle += 'text-decoration: none;'
    
    content += '<p><a href="{}#prediction?{}" style="{}">Run Prediction</a></p>'.format(hostURL, queryString, buttonStyle)
    return send_mail(SENDER, email, subject, content)

def sendErrors(jobName, email, errors):
    subject = 'PIMixture job "{}" FAILED'.format(jobName)
    content = '<h4>We are sorry to inform you, your PIMixture Fitting job "{}" has FAILED!</h4>'.format(jobName)
    content += '<p>Here is the error messages:</p>'
    content += str(errors)
    return send_mail(SENDER, email, subject, content)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-d', '--debug', action = 'store_true', help = 'Enables debugging')
    args = parser.parse_args()
    if (args.debug):
        addStreamHandler()
    try:
        sqs = Queue()
        while True:
            log.info("Receiving more messages...")
            for msg in sqs.receiveMsgs(VISIBILITY_TIMEOUT):
                extender = None
                try:
                    extender = VisibilityExtender(msg, VISIBILITY_TIMEOUT)
                    data = json.loads(msg.body)
                    if data and 'jobType' in data and data['jobType'] == 'fitting':
                        log.info('Got a job!')

                        parameters = data['parameters']
                        id = data['jobId']
                        ext = data['extension']
                        inputBucket = parameters['inputCSVFile']['bucket_name']
                        inputFileName = parameters['inputCSVFile']['key']

                        downloadFileName = getInputFilePath(id, ext)
                        inputBucket = S3Bucket(inputBucket)
                        inputBucket.downloadFile(inputFileName, downloadFileName)
                        parameters['remoteInputCSVFile'] = inputBucket.generateUrl(parameters['inputCSVFile'])
                        parameters['filename'] = downloadFileName
                        parameters['inputCSVFile'] = parameters['inputCSVFile']['originalName']

                        outputRdsFileName = getOutputFilePath(id, '.rds')
                        outputSSFileName = getOutputFilePath(id, extensionMap[SS_FILE_TYPE])
                        outputFileName = getOutputFilePath(id, '.out')
                        parameters['outputRdsFilename'] = outputRdsFileName
                        parameters['outputFilename'] = outputFileName
                        jobName = parameters.get('jobName', 'PIMixture')
                        jobName = jobName if jobName else 'PIMixture'

                        extender.start()
                        fittingResult = fitting(parameters, outputSSFileName, SS_FILE_TYPE)
                        if fittingResult['status']:
                            outputBucket = S3Bucket(OUTPUT_BUCKET)
                            outputRdsFileKey = getOutputFileKey(id, '.rds')
                            object = outputBucket.uploadFile(outputRdsFileKey, outputRdsFileName, '{}{}.rds'.format(jobName, FITTING_R_SUFFIX))
                            os.remove(outputRdsFileName)
                            if object:
                                fittingResult['results']['Rfile'] = object
                            else:
                                sendErrors(jobName, parameters['email'], 'Upload result RDS file failed!')
                                continue

                            object = outputBucket.uploadFile(getOutputFileKey(id, extensionMap[SS_FILE_TYPE]), outputSSFileName, '{}{}{}'.format(jobName, FITTING_SS_SUFFIX, extensionMap[SS_FILE_TYPE]))
                            os.remove(outputSSFileName)
                            if object:
                                fittingResult['results']['ssFile'] = object
                            else:
                                sendErrors(jobName, parameters['email'], 'Upload result {} file failed!'.format(SS_FILE_TYPE))
                                outputBucket.deleteFile(outputRdsFileKey)
                                continue

                            if not sendResults(jobName, parameters, fittingResult['results']):
                                log.error("An error happened when trying to send result email")
                                continue
                        else:
                            if not sendErrors(jobName, parameters['email'], fittingResult['message']):
                                log.error("An error happened when trying to send error email")
                                continue

                        msg.delete()
                    else:
                        log.debug(data)
                        log.error('Unknown message type!')
                        msg.delete()
                except Exception as e:
                    log.exception(e)

                finally:
                    if extender:
                        extender.stop()
    except KeyboardInterrupt:
        log.info("\nBye!")
        sys.exit()
