#!/usr/bin/env python
import boto3
import json
from pprint import pprint
from sqs import SQS
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

def uploadFileToS3(s3, key, fileName):
    with open(fileName, 'rb') as data:
        object = s3.uploadFile(key, data)
        if object:
           return {
                    'bucket': object.bucket_name,
                    'key': object.key
                  }
        else:
            message = "Upload file {} to S3 failed!".format(fileName)
            print(message)
            return None


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
                        inputBucket = S3Bucket(bucket)
                        inputBucket.downloadFile(key, downloadFileName)
                        parameters['filename'] = downloadFileName

                        outputRdsFileName = getOutputFilePath(id, '.rds')
                        outputCSVFileName = getOutputFilePath(id, '.csv')
                        outputFileName = getOutputFilePath(id, '.out')
                        parameters['outputRdsFilename'] = outputRdsFileName
                        parameters['outputFilename'] = outputFileName

                        fittingResult = fitting(parameters, outputCSVFileName)
                        if fittingResult['status']:
                            outputBucket = S3Bucket(OUTPUT_BUCKET)
                            object = uploadFileToS3(outputBucket, getOutputFileName(id, '.rds'), outputRdsFileName)
                            if object:
                                fittingResult['results']['Rfile'] = object
                                os.remove(outputRdsFileName)
                            else:
                                sys.exit(1)

                            object = uploadFileToS3(outputBucket, getOutputFileName(id, '.csv'), outputCSVFileName)
                            if object:
                                fittingResult['results']['csvFile'] = object
                                os.remove(outputCSVFileName)
                            else:
                                sys.exit(1)

                            if not sendResults(fittingResult['results']):
                                print("An error happened when trying to send result email")
                        else:
                            if not sendErrors(fittingResult):
                                print("An error happened when trying to send error email")

                        inputBucket.deleteFile(key)
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
