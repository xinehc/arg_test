#!/usr/bin/env python3
"""Configure the public read URL; no credentials or remote requests."""
import argparse,json,pathlib,urllib.parse
p=argparse.ArgumentParser();p.add_argument('--public-url',required=True,help='Public Development URL or custom domain, never the S3 endpoint');p.add_argument('--prefix',default='',help='Optional object folder, e.g. profiles');p.add_argument('--example',default='DRR000713');p.add_argument('--count',type=int,default=None);args=p.parse_args()
u=urllib.parse.urlsplit(args.public_url)
if u.scheme!='https' or not u.hostname or u.username or u.password or u.query or u.fragment or u.hostname.endswith('.r2.cloudflarestorage.com'):p.error('Use an HTTPS PUBLIC bucket URL, without credentials, query, or fragment. The S3 endpoint is not public.')
if any(part in ('.','..') for part in args.prefix.split('/')):p.error('Invalid prefix')
if args.count is not None and args.count<0:p.error('Count cannot be negative')
config={'profileExtension':'.txt.gz','profileBaseUrl':args.public_url.rstrip('/'),'filePrefix':args.prefix.strip('/'),'exampleAccession':args.example,'collectionLabel':'ARGmap accession collection','profileCount':args.count,'typeCount':None,'subtypeCount':None,'statsNote':'Collection count supplied by dataset owner' if args.count is not None else 'Exact accession lookup'}
path=pathlib.Path(__file__).resolve().parents[1]/'site/config.json';path.write_text(json.dumps(config,indent=2)+'\n');print('Updated site/config.json. Publish the site to apply it.')
