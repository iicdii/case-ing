import numpy as np
import pickle
import base64
import io
from PIL import Image
from requests_toolbelt.multipart import decoder


def handler(event, context):
    # 이벤트에서 이미지 받아오기
    content_type = event["headers"]["content-type"]
    body_dec = base64.b64decode(event['body'])

    multipart_data = decoder.MultipartDecoder(body_dec, content_type)
    binary_content = []

    for part in multipart_data.parts:
        binary_content.append(part.content)

    imageStream = io.BytesIO(binary_content[0])
    img = Image.open(imageStream)

    # 캡챠 예측하기
    model = pickle.load(open('./model/model.pickle', 'rb'))
    edges = np.linspace(0, 120, 6+1)
    letters = []
    for start, end in zip(edges[:-1], edges[1:]):
        box = (start, 0, end, 40)
        cropped = img.crop(box)
        cropped.load()
        croppedArray = np.array(cropped)
        letters.append(croppedArray.flatten())

    pred = model.predict(letters)
    answer = ''.join(pred)

    response = {
        "statusCode": 200,
        "body": answer
    }

    return response
