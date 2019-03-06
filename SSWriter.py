from util import *
import csv
if SS_FILE_TYPE == EXCEL_FORMAT:
    from openpyxl import Workbook

class SSWriter:
    def __init__(self, filename, type, log):
        self.type = type
        self.log = log
        self.filename = filename
        if self.type == CSV_FORMAT:
            try:
                self.file = open(self.filename, 'w')
                self.writer = csv.writer(self.file, dialect='excel')
            except Exception as e:
                self.log.exception("Can't open file: {}".format(self.filename))

        elif self.type == EXCEL_FORMAT:
            self.wb = Workbook()
            self.ws = self.wb.active

    def __del__(self):
        if hasattr(self, 'file'):
            self.file.close()

    def setTitle(self, title):
        if  self.type == CSV_FORMAT:
            self.writer.writerow([title])
        elif self.type == EXCEL_FORMAT:
            self.ws.title = title

    def writeData(self, data):
        for val in data:
            if self.type == CSV_FORMAT:
                self.writer.writerow(val)
            elif self.type == EXCEL_FORMAT:
                self.ws.append(val)

    def newSheet(self, title):
        if self.type == CSV_FORMAT:
            self.writer.writerow([])
            self.setTitle(title)
        elif self.type == EXCEL_FORMAT:
            self.ws = self.wb.create_sheet(title=title)

    def save(self):
        if self.type == CSV_FORMAT:
            self.file.close()
            self.writer = None
            self.file = None
        elif self.type == EXCEL_FORMAT:
            self.wb.save(self.filename)
            self.wb = None
            self.ws = None

