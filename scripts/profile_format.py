import csv,io,math,pathlib,re

def accession(path):
    value=pathlib.Path(path).stem.strip().upper()
    if not re.fullmatch(r'[A-Z0-9][A-Z0-9_-]{0,99}',value):raise ValueError(f'{path}: invalid accession filename')
    return value

def validate(raw):
    if len(raw)>1_000_000:raise ValueError('Profile exceeds 1 MB')
    text=raw.decode('utf-8-sig');lines=[line for line in text.splitlines() if line.strip()]
    if len(lines)<2:raise ValueError('Empty profile')
    reader=csv.DictReader(lines,delimiter='\t',quoting=csv.QUOTE_NONE)
    fields=reader.fieldnames;native=fields==['subtype','copy','abundance']
    if not native and fields not in (['type','subtype','abundance'],['type','subtype','copy','abundance']):raise ValueError('Unexpected tab-separated header')
    pairs=set();total=0;count=0
    for row in reader:
        if None in row or any(v is None for v in row.values()):raise ValueError('Incorrect column count')
        if native:
            if '|' not in row['subtype']:raise ValueError('Expected type|subtype')
            t,s=(v.strip() for v in row['subtype'].split('|',1))
        else:t,s=row['type'].strip(),row['subtype'].strip()
        if not t or not s:raise ValueError('Empty type or subtype')
        if (t,s) in pairs:raise ValueError('Duplicate type/subtype')
        pairs.add((t,s))
        for key in ['abundance']+(['copy'] if 'copy' in row else []):
            value=float(row[key])
            if not math.isfinite(value) or value<0:raise ValueError('Invalid '+key)
        total+=float(row['abundance']);count+=1
        if count>10000:raise ValueError('Too many rows')
    if not math.isfinite(total):raise ValueError('Non-finite abundance total')
    return count
