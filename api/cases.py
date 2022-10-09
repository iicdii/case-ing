import gspread
import io
import json


SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '1_CDB4m-BthVbpITxKjwEE82CrKkqu6go98nKCgG1hhw'

def read(event, context):
    gc = gspread.service_account(filename='./certification/service-account.json')
    doc = gc.open_by_key(SPREADSHEET_ID)
    worksheet = doc.get_worksheet(1)
    list_of_lists = worksheet.get_values()

    body = {
        "data": list_of_lists
    }

    response = {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }

    return response

def update(event, context):
    input = json.loads(event['body'])
    print(input)
    cell_range = input['range']
    update_values = input['values']

    gc = gspread.service_account(filename='./certification/service-account.json')
    doc = gc.open_by_key(SPREADSHEET_ID)
    worksheet = doc.get_worksheet(0)
    worksheet.update(cell_range, update_values, raw=False)

    body = {
        "messsage" : "success"
    }

    response = {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }

    return response

def clear(event, context):
    gc = gspread.service_account(filename='./certification/service-account.json')
    doc = gc.open_by_key(SPREADSHEET_ID)
    worksheet = doc.get_worksheet(0)
    worksheet.batch_clear(["A2:G3000"])

    body = {
        "messsage" : "success"
    }

    response = {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }

    return response
