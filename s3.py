#!/usr/bin/env python
import boto3
import json
from pprint import pprint

class S3Bucket:
    def __init__(self, bucket):
        self.s3 = boto3.resource('s3')
        self.bucket = self.s3.create_bucket(Bucket=bucket)

    def uploadFileObj(self, key, data):
        return self.bucket.put_object(Key=key, Body=data)

    def downloadFile(self, key, filename):
        return self.bucket.download_file(key, filename)

    def deleteFile(self, key):
        response = self.bucket.delete_objects(
            Delete={
                'Objects': [
                    {
                        'Key': key
                    }
                ]
            }
        )
        if 'Errors' in response:
            print('S3: delete file {} failed!'.format(key))
            return False
        else:
            return True

    def uploadFile(self, key, fileName):
        with open(fileName, 'rb') as data:
            object = self.uploadFileObj(key, data)
            if object:
                return {
                    'bucket': object.bucket_name,
                    'key': object.key
                }
            else:
                message = "Upload file {} to S3 failed!".format(fileName)
                print(message)
                return None
