#!/usr/bin/env python
from __future__ import division
from sqs import Queue, VisibilityExtender
from s3 import S3Bucket
from urllib import urlencode
import argparse
import os, sys

from util import *
import json
from fitting import *

def copyEssentialParameters(parameters):
    essential = [ obj['field'] for obj in savedParameters ]
    result = {}
    for field in parameters:
        if field in emailExcludedFields:
            continue
        if field in essential:
            result[field] = parameters[field]

    return result

def sendResults(jobName, parameters, results):
    email = parameters['email']
    hostURL = parameters['hostURL']
    subject = 'PIMixture Fitting Results - Job: {}'.format(jobName)
    content = '<p>Dear User,</p>'
    content += '<p>We have processed your data using PIMixture R Package version {}.</p>'.format(PIMIXTURE_VERSION)

    content += '<h4 style="margin-top:20px;">Job Information</h4>'
    content += '<p>Job Name: {}</p>'.format(jobName)
    content += '<p>Data File: {}</p>'.format(parameters['inputCSVFile'])
    content += '<p>Execution Time: {}</p>'.format(formatTime(results['execTime']))

    content += '<h4 style="margin-top:20px;">Results</h4>'
    content += '<p>Fitting results can be downloaded through following links:</p>'
    content += '<p><a href="{}getS3Object?{}" download="{}{}.rds">Download RDS file</a></p>'.format(hostURL, urlencode(results['Rfile']), jobName, FITTING_R_SUFFIX)
    content += '<p><a href="{}getS3Object?{}" download="{}{}{}">Download {} file</a></p>'.format(hostURL, urlencode(results['ssFile']), jobName, FITTING_SS_SUFFIX, extensionMap[SS_FILE_TYPE], SS_FILE_TYPE)

    # query = copyEssentialParameters(parameters)
    content += '<h4 style="margin-top:20px;">Run Prediction</h4>'
    content += '<p>You can also run prediction using the .RDS result file, by clicking the button below</p>'
    query = {}
    query['id'] = results['id']
    query['jobName'] = jobName
    query['remoteRFile'] = results['Rfile']
    query['fileName'] = '{}{}.rds'.format(jobName, FITTING_R_SUFFIX)
    queryString = urlencode({ 'parameters': json.dumps(query, separators=(',', ':')) })
    buttonStyle = ''
    buttonStyle += 'text-shadow: 0 -1px 0 rgba(0,0,0,.2);'
    buttonStyle += 'color: #fff;'
    buttonStyle += 'display: inline-block; margin-bottom: 0; font-size: 14px; font-weight: 900; line-height: 1.42857143; text-align: center; white-space: nowrap; vertical-align: middle;'
    buttonStyle += 'text-decoration: none;'

    cellStyle = 'padding: 6px 12px; background-color: #2F71AA; border: 1px solid transparent; border-radius: 4px;'
    
    content += '<table><tr><td style="{0}"><a href="{1}#prediction?{2}" style="{3}">Run Prediction</a></td></tr></table>'.format(cellStyle, hostURL, queryString, buttonStyle)

    content += '<p style="margin-top:20px;">Please note that result links above will be available for the next 7 days.</p>'
    content += '<br><p>Respectfully,</p>'
    content += '<p>PIMixture Web Tool</p>'
    return send_mail(SENDER, email, subject, content, log)

def sendErrors(jobName, email, errors):
    subject = 'PIMixture Fitting FAILED - Job: {}'.format(jobName)
    content = '<p>Dear User,</p>'
    content += '<p>We are sorry to inform you, your PIMixture Fitting job "{}" has FAILED!</p>'.format(jobName)
    content += '<p>Here is the error messages:</p>'
    content += '<blockquote>{}</blockquote>'.format(errors)
    content += '<br><p>Respectfully,</p>'
    content += '<p>PIMixture Web Tool</p>'
    return send_mail(SENDER, email, subject, content, log)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-d', '--debug', action = 'store_true', help = 'Enables debugging')
    args = parser.parse_args()
    if (args.debug):
        log = getConsoleLogger(stdFormatter)
    else:
        log = getFileLogger(processorLogFileName)
    try:
        sqs = Queue(log)
        while True:
            log.info("Receiving more messages...")
            for msg in sqs.receiveMsgs(VISIBILITY_TIMEOUT):
                extender = None
                try:
                    data = json.loads(msg.body)
                    if data and 'jobType' in data and data['jobType'] == 'fitting':
                        parameters = data['parameters']
                        jobName = parameters.get('jobName', 'PIMixture')
                        id = data['jobId']
                        extender = VisibilityExtender(msg, jobName, id, VISIBILITY_TIMEOUT, log)
                        log.info('Start processing job name: "{}", id: {} ...'.format(jobName, id))

                        ext = data['extension']
                        inputBucket = parameters['inputCSVFile']['bucket_name']
                        inputFileName = parameters['inputCSVFile']['key']

                        downloadFileName = getInputFilePath(id, ext)
                        inputBucket = S3Bucket(inputBucket, log)
                        inputBucket.downloadFile(inputFileName, downloadFileName)
                        parameters['remoteInputCSVFile'] = inputBucket.generateUrl(parameters['inputCSVFile'])
                        parameters['filename'] = downloadFileName
                        parameters['inputCSVFile'] = parameters['inputCSVFile']['originalName']

                        outputRdsFileName = getOutputFilePath(id, '.rds')
                        outputSSFileName = getOutputFilePath(id, extensionMap[SS_FILE_TYPE])
                        outputFileName = getOutputFilePath(id, '.out')
                        parameters['outputRdsFilename'] = outputRdsFileName
                        parameters['outputFilename'] = outputFileName

                        extender.start()
                        fittingResult = fitting(parameters, outputSSFileName, SS_FILE_TYPE, log, timeout=FITTING_TIMEOUT)
                        if fittingResult['status']:
                            fittingResult['results']['id'] = id
                            outputBucket = S3Bucket(OUTPUT_BUCKET, log)
                            outputRdsFileKey = getOutputFileKey(id, '.rds')
                            object = outputBucket.uploadFile(outputRdsFileKey, outputRdsFileName)
                            if object:
                                object['filename'] = '{}{}.rds'.format(jobName, FITTING_R_SUFFIX)
                                fittingResult['results']['Rfile'] = object
                                os.remove(outputRdsFileName)
                            else:
                                sendErrors(jobName, parameters['email'], 'Upload result RDS file failed!')
                                continue

                            object = outputBucket.uploadFile(getOutputFileKey(id, extensionMap[SS_FILE_TYPE]), outputSSFileName)
                            if object:
                                object['filename'] = '{}{}{}'.format(jobName, FITTING_SS_SUFFIX, extensionMap[SS_FILE_TYPE])
                                fittingResult['results']['ssFile'] = object
                                os.remove(outputSSFileName)
                            else:
                                sendErrors(jobName, parameters['email'], 'Upload result {} file failed!'.format(SS_FILE_TYPE))
                                outputBucket.deleteFile(outputRdsFileKey)
                                continue

                            if not sendResults(jobName, parameters, fittingResult['results']):
                                log.error("An error happened when trying to send result email")
                                continue
                        else:
                            if not sendErrors(jobName, parameters['email'], fittingResult['message']):
                                log.error("An error happened when trying to send error email")
                                continue

                        msg.delete()

                        log.info('Finish processing job name: "{}", id: {} !'.format(jobName, id))
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
