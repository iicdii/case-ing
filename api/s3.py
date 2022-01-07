import base64
import boto3
import json

s3 = boto3.client("s3")


def upload(event, context):
    data = json.loads(event["body"])
    name = data["name"]
    image = data["file"]
    image = image[image.find(",") + 1 :]
    dec = base64.b64decode(image + "===")
    s3.put_object(
        Bucket="case-ing-assets",
        Key=name,
        Body=dec,
        ContentType="image/png",
        ContentEncoding="base64",
    )

    body = {"messsage": "success"}

    response = {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }

    return response
