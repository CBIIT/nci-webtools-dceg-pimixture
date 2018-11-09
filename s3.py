#!/usr/bin/env python
import boto3
from util import *

class S3Bucket:
    def __init__(self, bucket):
        self.client = boto3.client('s3')
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
            log.error('S3: delete file {} failed!'.format(key))
            return False
        else:
            return True

    def uploadFile(self, key, fileName, downloadFileName):
        with open(fileName, 'rb') as data:
            object = self.uploadFileObj(key, data)
            if object:
                return  self.generateUrl(object, downloadFileName)
            else:
                message = "Upload file {} to S3 failed!".format(fileName)
                log.error(message)
                return None


    def generateUrl(self, object, fileName=None):
        bucket_name = object.bucket_name if hasattr(object, 'bucket_name') else object['bucket_name']
        key = object.key if hasattr(object, 'key') else object['key']
        fileName = fileName if fileName else object['originalName']
        url = self.client.generate_presigned_url(
            'get_object',
            Params = {
                'Bucket': bucket_name,
                'Key': key,
                'ResponseContentDisposition': "attachment;filename={}".format(fileName)
            },
            ExpiresIn = URL_EXPIRE_TIME)
        return(url)
