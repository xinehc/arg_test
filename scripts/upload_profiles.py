#!/usr/bin/env python3
"""Optional uploader for new TXT files. No conversions, deletions, or listing calls."""
import argparse,concurrent.futures,hashlib,os,pathlib,sqlite3,sys
from profile_format import accession,validate

def files(root):
    with os.scandir(root) as entries:
        for entry in entries:
            if entry.is_dir(follow_symlinks=False):yield from files(entry.path)
            elif entry.is_file(follow_symlinks=False) and entry.name.lower().endswith(('.txt','.txt.gz')):yield pathlib.Path(entry.path)

def run(args,s3=None):
    source=pathlib.Path(args.input).resolve();state=pathlib.Path(args.state).resolve()
    if not source.is_dir():raise ValueError('Input must be an existing directory')
    if state==source or source in state.parents:raise ValueError('Checkpoint must be outside the input directory')
    prefix=args.prefix.strip('/')
    if any(p in ('.','..') for p in prefix.split('/')):raise ValueError('Invalid prefix')
    state.parent.mkdir(parents=True,exist_ok=True);db=sqlite3.connect(state)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('CREATE TABLE IF NOT EXISTS uploaded(target TEXT,key TEXT,sha TEXT,PRIMARY KEY(target,key))')
    db.execute('DROP TABLE IF EXISTS plan');db.execute('CREATE TABLE plan(accession TEXT PRIMARY KEY,path TEXT,sha TEXT)')
    count=0
    try:
        # Complete validation before any remote write, including duplicate accessions.
        for path in files(source):
            if path.stat().st_size>5_000_000:raise ValueError(f'{path}: profile exceeds 5 MB')
            raw=path.read_bytes()
            try:validate(raw,accession(path))
            except Exception as e:raise ValueError(f'{path}: {e}') from e
            key=accession(path)
            try:db.execute('INSERT INTO plan VALUES (?,?,?)',(key,str(path),hashlib.sha256(raw).hexdigest()))
            except sqlite3.IntegrityError:raise ValueError(f'Duplicate accession: {key}')
            count+=1
            if count%1000==0:db.commit()
        db.commit();print(f'Validated {count:,} TXT profiles.',flush=True)
        if args.validate_only:return {'validated':count,'uploaded':0,'skipped':0}
        if s3 is None:
            from r2_client import client
            s3=client()
        target=os.environ.get('R2_ENDPOINT_URL','https://47bd4c09e8ac6457ef317324342bb09a.r2.cloudflarestorage.com')+'/'+args.bucket
        uploaded=skipped=0;errors=[]
        def put(item):
            key,path,digest=item;raw=pathlib.Path(path).read_bytes()
            if hashlib.sha256(raw).hexdigest()!=digest:raise ValueError(f'{path}: changed after validation; rerun')
            kwargs=dict(Bucket=args.bucket,Key=key,Body=raw,ContentType='application/gzip' if key.endswith('.gz') else 'text/plain; charset=utf-8',CacheControl='public, max-age=300',Metadata={'sha256':digest})
            if not args.overwrite:kwargs['IfNoneMatch']='*'
            try:s3.put_object(**kwargs)
            except Exception as e:
                code=getattr(e,'response',{}).get('Error',{}).get('Code','')
                if code in ('PreconditionFailed','412'):
                    # Recover a successful PUT whose response/checkpoint was lost.
                    existing=s3.head_object(Bucket=args.bucket,Key=key)
                    if existing.get('Metadata',{}).get('sha256')==digest:return key,digest
                raise RuntimeError(f'Upload failed for {key}. If the object already exists, use --overwrite only when replacement is intended. Original error: {type(e).__name__}') from e
            return key,digest
        def record(pending):
            nonlocal uploaded
            done,_=concurrent.futures.wait(pending,return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                try:
                    key,digest=future.result();db.execute('INSERT OR REPLACE INTO uploaded VALUES (?,?,?)',(target,key,digest));uploaded+=1
                except Exception as e:errors.append(e)
                pending.remove(future)
            db.commit()
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            pending=set()
            for key,path,digest in db.execute('SELECT accession,path,sha FROM plan ORDER BY accession'):
                object_key=(prefix+'/' if prefix else '')+key+('.txt.gz' if path.lower().endswith('.txt.gz') else '.txt')
                old=db.execute('SELECT sha FROM uploaded WHERE target=? AND key=?',(target,object_key)).fetchone()
                if old and old[0]==digest:skipped+=1;continue
                pending.add(pool.submit(put,(object_key,path,digest)))
                if len(pending)>=args.workers*2:
                    record(pending)
                    if errors:break
            while pending:record(pending)
        if errors:raise errors[0]
        print(f'Uploaded {uploaded:,}; skipped {skipped:,} unchanged checkpointed profiles.',flush=True)
        return {'validated':count,'uploaded':uploaded,'skipped':skipped}
    finally:db.close()

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',required=True);p.add_argument('--bucket',default=os.environ.get('R2_BUCKET','argmap'));p.add_argument('--prefix',default='');p.add_argument('--state',default='.state/uploads.sqlite');p.add_argument('--workers',type=int,default=8);p.add_argument('--validate-only',action='store_true');p.add_argument('--overwrite',action='store_true');args=p.parse_args()
    if not 1<=args.workers<=32:p.error('Use 1–32 workers')
    try:run(args)
    except Exception as e:print(str(e),file=sys.stderr);return 1
    return 0
if __name__=='__main__':sys.exit(main())
