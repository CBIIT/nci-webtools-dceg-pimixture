#!/usr/bin/env python
import boto3
import json
from pprint import pprint

BUCKET_NAME = 'pimixture'

class S3:
    def __init__(self, bucket=BUCKET_NAME):
        self.s3 = boto3.resource('s3')
        self.bucket = self.s3.create_bucket(Bucket=BUCKET_NAME)
        # self.bucket = self.s3.Bucket(BUCKET_NAME)

    def uploadFile(self, key, data):
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
