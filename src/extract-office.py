"""Extract slide notes, text, table cells and cached chart/workbook data; no Office execution."""
import sys, zipfile, io, posixpath, json
import xml.etree.ElementTree as ET

source, output = sys.argv[1:]

def package(stream):
    z = zipfile.ZipFile(stream)
    info = z.infolist()
    if len(info) > 5000 or sum(i.file_size for i in info) > 100_000_000:
        raise ValueError('Office package is too large')
    return z

def local(tag):
    return tag.rsplit('}', 1)[-1]

def text_content(root):
    parts = []
    for paragraph in root.iter():
        if local(paragraph.tag) == 'p':
            text = ''.join(e.text or '' for e in paragraph.iter() if local(e.tag) == 't')
            if text.strip(): parts.append(text)
    return '\n'.join(parts)

z = package(source)
parts = []
if 'ppt/presentation.xml' in z.namelist():
    relations = {r.attrib['Id']: r.attrib.get('Target', '') for r in ET.fromstring(z.read('ppt/_rels/presentation.xml.rels'))}
    slides = ET.fromstring(z.read('ppt/presentation.xml')).findall('.//{*}sldId')
    for n, slide in enumerate(slides, 1):
        relation = next((v for k,v in slide.attrib.items() if local(k) == 'id' and '}' in k), '')
        target = posixpath.normpath(posixpath.join('ppt', relations[relation]))
        root = ET.fromstring(z.read(target)); hidden = root.attrib.get('show') == '0'
        parts.append(f'## Slide {n}' + (' (hidden)' if hidden else '') + '\n\n' + text_content(root))
        relfile = posixpath.join(posixpath.dirname(target), '_rels', posixpath.basename(target) + '.rels')
        if relfile in z.namelist():
            for r in ET.fromstring(z.read(relfile)):
                if r.attrib.get('Type','').endswith('/notesSlide') and r.attrib.get('TargetMode') != 'External':
                    notes = posixpath.normpath(posixpath.join(posixpath.dirname(target), r.attrib['Target']))
                    parts.append(f'### Speaker notes — slide {n}\n\n' + text_content(ET.fromstring(z.read(notes))))
elif 'word/document.xml' in z.namelist():
    parts.append('## Word document text and table cells\n\n' + text_content(ET.fromstring(z.read('word/document.xml'))))
    for name in sorted(z.namelist()):
        if name.startswith('word/') and name.endswith('.xml') and any(x in posixpath.basename(name) for x in ['footnotes','endnotes','comments','header','footer']):
            text = text_content(ET.fromstring(z.read(name)))
            if text.strip(): parts.append(f'## Additional content — {name}\n\n{text}')
else:
    raise ValueError('Expected a Word or PowerPoint package')

for name in sorted(z.namelist()):
    if '/charts/' in name and name.endswith('.xml') and '/_rels/' not in name:
        root = ET.fromstring(z.read(name)); values = [e.text for e in root.iter() if local(e.tag) in ['v','f','t'] and e.text]
        if values: parts.append(f'## Chart text and cached values — {name}\n\n' + '\n'.join(values))
    if '/embeddings/' in name and name.endswith('.xlsx'):
        book = package(io.BytesIO(z.read(name)))
        shared = []
        if 'xl/sharedStrings.xml' in book.namelist():
            shared = [''.join(e.text or '' for e in item.iter() if local(e.tag)=='t') for item in ET.fromstring(book.read('xl/sharedStrings.xml'))]
        for sheet in sorted(book.namelist()):
            if sheet.startswith('xl/worksheets/sheet') and sheet.endswith('.xml'):
                cells=[]
                for cell in ET.fromstring(book.read(sheet)).iter():
                    if local(cell.tag) != 'c': continue
                    value = cell.find('{*}v'); text = value.text if value is not None else ''.join(e.text or '' for e in cell.iter() if local(e.tag)=='t')
                    if cell.attrib.get('t') == 's' and text is not None: text = shared[int(text)]
                    if text: cells.append(cell.attrib.get('r','') + ': ' + text)
                parts.append(f'## Embedded workbook — {name} / {sheet}\n\n' + '\n'.join(cells))

result = '\n\n'.join(parts)
if len(result) > 2_000_000: raise ValueError('Extracted Office content is too large')
with open(output,'w',encoding='utf-8') as f: f.write(result)
