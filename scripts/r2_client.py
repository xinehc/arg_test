import os

def client():
    import boto3
    from botocore.config import Config
    endpoint=os.environ.get('R2_ENDPOINT_URL','https://47bd4c09e8ac6457ef317324342bb09a.r2.cloudflarestorage.com')
    if not os.environ.get('AWS_ACCESS_KEY_ID') or not os.environ.get('AWS_SECRET_ACCESS_KEY'):
        raise ValueError('Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your local environment.')
    return boto3.client('s3',endpoint_url=endpoint,region_name='auto',config=Config(signature_version='s3v4',retries={'mode':'standard','max_attempts':5},max_pool_connections=32,request_checksum_calculation='when_required',response_checksum_validation='when_required'))
