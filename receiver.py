#!/usr/bin/env python
import boto3
import json
from pprint import pprint
from sqs import Queue, VisibilityExtender
from s3 import S3Bucket
import os, sys
from pprint import pprint

from util import *
from fitting import *

def sendResults(jobName, email, results):
    subject = 'PIMixture Fitting results for job "{}"'.format(jobName)
    content = '<h4>Congratulations! You PIMixture Fitting job "{}" has finished!</h4>'.format(jobName)
    content += '<p>You\'ll have 14 days to download your result files. After that, your result files will be deleted from server!</p>'
    content += '<p><a href="{}" download="{}.rds">Download RDS file</a></p>'.format(results['Rfile'], jobName)
    content += '<p><a href="{}" download="{}.csv">Download CSV file</a></p>'.format(results['csvFile'], jobName)
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
            print("Receiving more messages...")
            for msg in sqs.receiveMsgs(VISIBILITY_TIMEOUT):
                extender = None
                try:
                    extender = VisibilityExtender(msg, VISIBILITY_TIMEOUT)
                    data = json.loads(msg.body)
                    if data and 'jobType' in data and data['jobType'] == 'fitting':
                        print('Got a job!')

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
                        fittingResult = fitting(parameters, outputCSVFileName)
                        if fittingResult['status']:
                            outputBucket = S3Bucket(OUTPUT_BUCKET)
                            outputRdsFileKey = getOutputFileName(id, '.rds')
                            object = outputBucket.uploadFile(outputRdsFileKey, outputRdsFileName, '{}.rds'.format(jobName))
                            os.remove(outputRdsFileName)
                            if object:
                                fittingResult['results']['Rfile'] = object
                            else:
                                sendErrors(jobName, parameters['email'], 'Upload result RDS file failed!')
                                continue

                            object = outputBucket.uploadFile(getOutputFileName(id, '.csv'), outputCSVFileName, '{}.csv'.format(jobName))
                            os.remove(outputCSVFileName)
                            if object:
                                fittingResult['results']['csvFile'] = object
                            else:
                                sendErrors(jobName, parameters['email'], 'Upload result CSV file failed!')
                                outputBucket.deleteFile(outputRdsFileKey)
                                continue

                            if not sendResults(jobName, parameters['email'], fittingResult['results']):
                                print("An error happened when trying to send result email")
                                continue
                        else:
                            if not sendErrors(jobName, parameters['email'], fittingResult['message']):
                                print("An error happened when trying to send error email")
                                continue

                        msg.delete()
                        inputBucket.deleteFile(inputFileName)
                    else:
                        pprint(data)
                        print('Unknown message type!')
                        msg.delete()
                except Exception as e:
                    print(e)

                finally:
                    if extender:
                        extender.stop()
    except KeyboardInterrupt:
        print("\nBye!")
        sys.exit()
