#!/usr/bin/env python
import boto3
import json
from pprint import pprint
from threading import Timer

from util import *

class Queue:
    def __init__(self, log, queName=QUEUE_NAME):
        self.log = log
        self.sqs = boto3.resource('sqs')
        self.queue = self.sqs.create_queue(
            QueueName=queName,
            Attributes={
                'FifoQueue': 'true'
            })

    def sendMsgToQueue(self, msg, id):
        response = self.queue.send_message(MessageBody=json.dumps(msg),
                                           MessageGroupId=id,
                                           MessageDeduplicationId=id)
        self.log.debug(response.get('MessageId'))

    def receiveMsgs(self, visibilityTimeOut):
        return self.queue.receive_messages(VisibilityTimeout = visibilityTimeOut,
                                           WaitTimeSeconds = QUEUE_LONG_PULL_TIME,
                                           MaxNumberOfMessages = 1)

    def getApproximateNumberOfMessages(self):
        return self.queue.attributes.get('ApproximateNumberOfMessages', -1)

# Automatically extend visibility timeout every timeOutValue/2 seconds
class VisibilityExtender:
    def __init__(self, msg, jobName, jobId, timeOutValue, log):
        self._timeOutValue = timeOutValue if timeOutValue > 2 else 2
        self._currentTimeOut = self._timeOutValue
        self._interval = timeOutValue / 2 if timeOutValue > 2 else 1
        self._msg = msg
        self.jobName = jobName
        self.jobId = jobId
        self._timer = None
        self.is_running = False
        self.log = log
        self.start()

    def _run(self):
        if self._msg:
            self.is_running = False
            self.start()
            self._currentTimeOut += self._interval
            self.log.info('Processing job name: "{}", id: {} ...'.format(self.jobName, self.jobId))
            self._msg.change_visibility(VisibilityTimeout = self._currentTimeOut)


    def start(self):
        if not self.is_running:
            self._timer = Timer(self._interval, self._run)
            self._timer.start()
            self.is_running = True

    def stop(self):
        self._timer.cancel()
        self.is_running = False
