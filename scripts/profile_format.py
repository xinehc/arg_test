import csv,io,math,pathlib,re,gzip

def accession(path):
    name=pathlib.Path(path).name
    value=(name[:-7] if name.lower().endswith('.txt.gz') else pathlib.Path(path).stem).strip().upper()
    if not re.fullmatch(r'[A-Z0-9][A-Z0-9_-]{0,99}',value):raise ValueError(f'{path}: invalid accession filename')
    return value

def validate(raw,expected_accession=None):
    if len(raw)>5_000_000:raise ValueError('Profile exceeds 5 MB')
    if raw[:2]==b'\x1f\x8b':
        with gzip.GzipFile(fileobj=io.BytesIO(raw)) as f:raw=f.read(5_000_001)
        if len(raw)>5_000_000:raise ValueError('Expanded profile exceeds 5 MB')
    text=raw.decode('utf-8-sig');lines=[line for line in text.splitlines() if line.strip()]
    if lines and lines[0].startswith('['):
        sections={};active=None
        for line in lines:
            if line.strip().startswith('[') and line.strip().endswith(']'):
                key=line.strip().lower()
                if key not in ('[metadata]','[abundance]') or key in sections:raise ValueError('Invalid or duplicate section')
                active=[];sections[key]=active
            else:
                if active is None:raise ValueError('Content before section')
                active.append(line)
        if set(sections)!=set(('[metadata]','[abundance]')):raise ValueError('Missing section')
        seen=set()
        for i,line in enumerate(sections['[metadata]']):
            cells=line.split('\t')
            if i==0 and cells==['field','value']:continue
            if len(cells)!=2 or not cells[0].strip():raise ValueError('Invalid metadata field/value pair')
            key,value=cells[0].strip(),cells[1]
            if key in seen:raise ValueError('Duplicate metadata field')
            seen.add(key)
            if key=='accession' and expected_accession and value.strip().upper()!=expected_accession:raise ValueError('Accession mismatch')
        lines=sections['[abundance]']
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
