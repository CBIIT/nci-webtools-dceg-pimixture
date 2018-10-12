#!/usr/bin/env python
import boto3
import json
from pprint import pprint
from sqs import Queue
from s3 import S3Bucket
import os, sys
from pprint import pprint

from util import *
from fitting import *

def sendResults(results):
    # Todo: send email to user
    print(results['Rfile'])
    print(results['csvFile'])
    return True

def sendErrors(errors):
    # Todo: send email to user
    pprint(errors)
    return True



if __name__ == '__main__':
    try:
        sqs = Queue()
        while True:
            print("Receiving more messages...")
            for msg in sqs.receiveMsgs():
                try:
                    data = json.loads(msg.body)
                    if data and 'jobType' in data and data['jobType'] == 'fitting':
                        print('Got a job!')

                        parameters = data['parameters']
                        id = data['jobId']
                        ext = data['extension']
                        inputBucket = parameters['inputCSVFile']['bucket']
                        inputFileName = parameters['inputCSVFile']['key']

                        downloadFileName = getInputFilePath(id, ext)
                        print('Download from {} to {}'.format(inputBucket , downloadFileName))
                        inputBucket = S3Bucket(inputBucket)
                        inputBucket.downloadFile(inputFileName, downloadFileName)
                        parameters['filename'] = downloadFileName

                        outputRdsFileName = getOutputFilePath(id, '.rds')
                        outputCSVFileName = getOutputFilePath(id, '.csv')
                        outputFileName = getOutputFilePath(id, '.out')
                        parameters['outputRdsFilename'] = outputRdsFileName
                        parameters['outputFilename'] = outputFileName

                        fittingResult = fitting(parameters, outputCSVFileName)
                        if fittingResult['status']:
                            outputBucket = S3Bucket(OUTPUT_BUCKET)
                            outputRdsFileKey = getOutputFileName(id, '.rds')
                            object = outputBucket.uploadFile(outputRdsFileKey, outputRdsFileName)
                            os.remove(outputRdsFileName)
                            if object:
                                fittingResult['results']['Rfile'] = object
                            else:
                                sendErrors('Upload result RDS file failed!')
                                continue

                            object = outputBucket.uploadFile(getOutputFileName(id, '.csv'), outputCSVFileName)
                            os.remove(outputCSVFileName)
                            if object:
                                fittingResult['results']['csvFile'] = object
                            else:
                                sendErrors('Upload result CSV file failed!')
                                outputBucket.deleteFile(outputRdsFileKey)
                                continue

                            if not sendResults(fittingResult['results']):
                                print("An error happened when trying to send result email")
                                continue
                        else:
                            if not sendErrors(fittingResult):
                                print("An error happened when trying to send error email")

                        inputBucket.deleteFile(inputFileName)
                        msg.delete()
                    else:
                        pprint(data)
                        print('Unknown message type!')
                        msg.delete()
                except Exception as e:
                    print(e)

                finally:
                    pass
    except KeyboardInterrupt:
        print("\nBye!")
        sys.exit()
