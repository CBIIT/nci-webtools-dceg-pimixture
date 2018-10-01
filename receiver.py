#!/usr/bin/env python
import boto3
import json
from pprint import pprint
from sqs import SQS
from s3 import S3



if __name__ == '__main__':
    sqs = SQS()
    while True:
        print("Receiving more messages...")
        for msg in sqs.receiveMsgs():
            data = json.loads(msg.body)
            if data and 'jobType' in data and data['jobType'] == 'fitting':
                print('Got a job!')
                msg.delete()

                parameters = data['parameters']
                bucket = parameters['inputCSVFile']['bucket']
                key = parameters['inputCSVFile']['key']
                downloadFileName = '/Users/yingm3/Downloads/' + key
                print('Download from {} to {}'.format(bucket, downloadFileName))
                s3 = S3(bucket=bucket)
                s3.downloadFile(key, downloadFileName)
                s3.deleteFile(key)
            else:
                pprint(data)
                print('Unknown message type!')
