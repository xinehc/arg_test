import gzip
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_subtypes import build, COLUMNS


def source(type_name, name, value='1'):
    return ('[metadata]\ntype\t'+type_name+'\nsubtype\t'+name+'\nmatched\t1234\nshown\t1\n\n[data]\n'+
            '\t'.join(COLUMNS)+'\n'+type_name+'|'+name+'\t0.123456789\t'+value+'\tSRR000713\tname\tbiome\tplace\t2020\tna\n')


class SubtypeBuildTests(unittest.TestCase):
    def test_metadata_identity_and_actual_filename(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for filename,type_name,name in [('a_gene_x.txt.gz','A','gene/x'),('a_gene_x_2.txt.gz','A','gene_x'),('b_gene_x.txt.gz','B','gene/x')]:
                (root/filename).write_bytes(gzip.compress(source(type_name,name).encode()))
            self.assertEqual(build(root),(3,3))
            entries=json.loads((root/'index.json').read_text())['entries']
            self.assertEqual({(e['type'],e['subtype']) for e in entries},{('A','gene/x'),('A','gene_x'),('B','gene/x')})
            self.assertEqual(next(e['file'] for e in entries if e['type']=='A' and e['subtype']=='gene/x'),'a_gene_x.txt.gz')

    def test_duplicate_pair_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for filename in ['one.txt.gz','two.txt.gz']:(root/filename).write_bytes(gzip.compress(source('A','gene').encode()))
            with self.assertRaisesRegex(ValueError,'Duplicate type/subtype'):build(root)
            self.assertFalse((root/'index.json').exists())

    def test_missing_abundance_is_preserved_but_infinity_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);p=root/'gene.txt.gz';p.write_bytes(gzip.compress(source('A','gene','nan').encode()));self.assertEqual(build(root),(1,1))
            p.write_bytes(gzip.compress(source('A','gene','Infinity').encode()))
            with self.assertRaisesRegex(ValueError,'invalid numeric'):build(root)

if __name__=='__main__':unittest.main()
