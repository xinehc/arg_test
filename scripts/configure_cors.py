#!/usr/bin/env python3
"""Merge a read-only website-origin rule into the bucket CORS configuration."""
import argparse,os,urllib.parse
from r2_client import client
p=argparse.ArgumentParser();p.add_argument('--origin',required=True,help='Website origin, e.g. https://username.github.io (no repository path)');p.add_argument('--bucket',default=os.environ.get('R2_BUCKET','argmap'));args=p.parse_args()
u=urllib.parse.urlsplit(args.origin)
if u.scheme not in ('http','https') or not u.hostname or u.path not in ('','/') or u.query or u.fragment or u.username:p.error('Origin must contain only scheme and host, without a repository path.')
origin=urllib.parse.urlunsplit((u.scheme,u.netloc,'','',''));s3=client()
try:rules=s3.get_bucket_cors(Bucket=args.bucket)['CORSRules']
except s3.exceptions.ClientError as e:
    if e.response['Error']['Code'] not in ('NoSuchCORSConfiguration','NoSuchCORS'):raise
    rules=[]
rule_id='arg-atlas-read-'+u.netloc.replace(':','-');rules=[r for r in rules if r.get('ID')!=rule_id]
rules.append({'ID':rule_id,'AllowedOrigins':[origin],'AllowedMethods':['GET','HEAD'],'ExposeHeaders':['Content-Length','ETag'],'MaxAgeSeconds':3600})
s3.put_bucket_cors(Bucket=args.bucket,CORSConfiguration={'CORSRules':rules});print('Added GET/HEAD access for '+origin+'. Public access must be enabled separately in R2.')
