import argparse,pathlib,sys,tempfile,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from upload_profiles import run
SAMPLE=pathlib.Path(__file__).resolve().parents[1]/'examples/DRR000713.txt'
class FakeS3:
    def __init__(self):self.calls=[]
    def put_object(self,**kw):self.calls.append(kw)
class UploadTests(unittest.TestCase):
    def test_resume_and_duplicate_preflight(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);source=root/'input';source.mkdir();(source/'DRR000713.txt').write_bytes(SAMPLE.read_bytes())
            args=argparse.Namespace(input=str(source),state=str(root/'state.sqlite'),prefix='',bucket='argmap',workers=2,validate_only=False,overwrite=False)
            fake=FakeS3();self.assertEqual(run(args,fake)['uploaded'],1);self.assertEqual(fake.calls[0]['Key'],'DRR000713.txt');self.assertEqual(fake.calls[0]['IfNoneMatch'],'*');self.assertEqual(run(args,fake)['skipped'],1)
            (source/'nested').mkdir();(source/'nested/drr000713.txt').write_bytes(SAMPLE.read_bytes())
            with self.assertRaisesRegex(ValueError,'Duplicate accession'):run(args,fake)
            self.assertEqual(len(fake.calls),1)
if __name__=='__main__':unittest.main()
