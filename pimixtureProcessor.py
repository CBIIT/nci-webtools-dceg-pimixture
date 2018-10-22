#!/usr/bin/env python
import boto3
import json
from pprint import pprint
from sqs import Queue, VisibilityExtender
from s3 import S3Bucket
import os, sys

from util import *
from fitting import *

def sendResults(jobName, email, results):
    subject = 'PIMixture Fitting results for job "{}"'.format(jobName)
    content = '<h4>Congratulations! You PIMixture Fitting job "{}" has finished!</h4>'.format(jobName)
    content += '<p>You\'ll have 14 days to download your result files. After that, your result files will be deleted from server!</p>'
    content += '<p><a href="{}" download="{}{}.rds">Download RDS file</a></p>'.format(results['Rfile'], jobName, FITTING_SUFFIX)
    content += '<p><a href="{}" download="{}{}.csv">Download CSV file</a></p>'.format(results['csvFile'], jobName, FITTING_SUFFIX)
    return send_mail(SENDER, email, subject, content)

def sendErrors(jobName, email, errors):
    subject = 'PIMixture job "{}" FAILED'.format(jobName)
    content = '<h4>We are sorry to inform you, your PIMixture Fitting job "{}" has FAILED!</h4>'.format(jobName)
    content += '<p>Here is the error messages:</p>'
    content += str(errors)
    return send_mail(SENDER, email, subject, content)



if __name__ == '__main__':
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
                        inputBucket = parameters['inputCSVFile']['bucket']
                        inputFileName = parameters['inputCSVFile']['key']

                        downloadFileName = getInputFilePath(id, ext)
                        inputBucket = S3Bucket(inputBucket)
                        inputBucket.downloadFile(inputFileName, downloadFileName)
                        parameters['filename'] = downloadFileName
                        parameters['inputCSVFile'] = parameters['inputCSVFile']['originalName']

                        outputRdsFileName = getOutputFilePath(id, '.rds')
                        outputCSVFileName = getOutputFilePath(id, '.csv')
                        outputFileName = getOutputFilePath(id, '.out')
                        parameters['outputRdsFilename'] = outputRdsFileName
                        parameters['outputFilename'] = outputFileName
                        jobName = parameters.get('jobName', 'PIMixture')
                        jobName = jobName if jobName else 'PIMixture'

                        extender.start()
                        fittingResult = fitting(parameters, outputCSVFileName, CSV_FORMAT)
                        if fittingResult['status']:
                            outputBucket = S3Bucket(OUTPUT_BUCKET)
                            outputRdsFileKey = getOutputFileName(id, '.rds')
                            object = outputBucket.uploadFile(outputRdsFileKey, outputRdsFileName, '{}{}.rds'.format(jobName, FITTING_SUFFIX))
                            os.remove(outputRdsFileName)
                            if object:
                                fittingResult['results']['Rfile'] = object
                            else:
                                sendErrors(jobName, parameters['email'], 'Upload result RDS file failed!')
                                continue

                            object = outputBucket.uploadFile(getOutputFileName(id, '.csv'), outputCSVFileName, '{}{}.csv'.format(jobName, FITTING_SUFFIX))
                            os.remove(outputCSVFileName)
                            if object:
                                fittingResult['results']['csvFile'] = object
                            else:
                                sendErrors(jobName, parameters['email'], 'Upload result CSV file failed!')
                                outputBucket.deleteFile(outputRdsFileKey)
                                continue

                            if not sendResults(jobName, parameters['email'], fittingResult['results']):
                                log.error("An error happened when trying to send result email")
                                continue
                        else:
                            if not sendErrors(jobName, parameters['email'], fittingResult['message']):
                                log.error("An error happened when trying to send error email")
                                continue

                        msg.delete()
                        inputBucket.deleteFile(inputFileName)
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
