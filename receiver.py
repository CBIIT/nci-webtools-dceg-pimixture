#!/usr/bin/env python
import boto3
import json
from pprint import pprint
from sqs import SQS
from s3 import S3
import os, sys
from pprint import pprint

from util import *
from fitting import *

def sendResults(results):
    # Todo: send email to user
    pprint(results)
    return True

def sendErrors(errors):
    # Todo: send email to user
    pprint(errors)
    return True

if __name__ == '__main__':
    try:
        sqs = SQS()
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
                        bucket = parameters['inputCSVFile']['bucket']
                        key = parameters['inputCSVFile']['key']

                        downloadFileName = getInputFilePath(id, ext)
                        print('Download from {} to {}'.format(bucket, downloadFileName))
                        s3 = S3(bucket)
                        s3.downloadFile(key, downloadFileName)
                        parameters['filename'] = downloadFileName

                        outputRdsFileName = getOutputFilePath(id, '.rds')
                        outputCSVFileName = getOutputFilePath(id, '.csv')
                        outputFileName = getOutputFilePath(id, '.out')
                        parameters['outputRdsFilename'] = outputRdsFileName
                        parameters['outputFilename'] = outputFileName

                        fittingResult = fitting(parameters, outputCSVFileName)
                        if fittingResult['status']:
                            if not sendResults(fittingResult['results']):
                                print("An error happened when trying to send result email")
                        else:
                            if not sendErrors(fittingResult):
                                print("An error happened when trying to send error email")

                        s3.deleteFile(key)
                        msg.delete()
                    else:
                        pprint(data)
                        print('Unknown message type!')
                except Exception as e:
                    print(e)

                finally:
                    pass
    except KeyboardInterrupt:
        print("\nBye!")
        sys.exit()
