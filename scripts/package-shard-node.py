"""Reempacota o runtime Linux compilado para o ambiente Node da ShardCloud."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from shutil import copyfileobj
import hashlib
import json
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
runtime_links = {}
if source.resolve() == target.resolve():
    raise ValueError('Origem e destino devem ser diferentes.')
with ZipFile(source) as original, ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=6) as output:
    for item in original.infolist():
        if not item.filename.startswith('runtime/'):
            continue
        if item.filename.startswith('runtime/node_modules/'):
            continue
        original_name = item.filename
        item.filename = item.filename[len('runtime/'):]
        # O formulário da hospedagem ignora diretórios ocultos no ZIP.
        if item.filename == '.next/' or item.filename.startswith('.next/'):
            item.filename = 'build' + item.filename[len('.next'):]
        # O upload também remove node_modules aninhados. Preserve os módulos
        # externos do Turbopack em vendor e restaure os caminhos ao iniciar.
        if item.filename.startswith('build/'):
            converted = []
            for part in item.filename.split('/'):
                if part == 'node_modules':
                    runtime_links['/'.join(converted + ['node_modules'])] = '/'.join(converted + ['vendor'])
                    converted.append('vendor')
                else:
                    converted.append(part)
            item.filename = '/'.join(converted)
        if not item.filename:
            continue
        # A classe ZipInfo é reutilizada, preservando permissões Linux do runtime.
        with original.open(original_name) as incoming, output.open(item, 'w') as outgoing:
            copyfileobj(incoming, outgoing)
    output.writestr('runtime-links.json', json.dumps(runtime_links))
    output.writestr('start.js', """import {existsSync,readFileSync,writeFileSync,mkdirSync,renameSync,symlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
// Uploads merge files. Next's route-cache uses route identities across builds;
// archive that generated cache when the compiled release changes.
const release=JSON.parse(readFileSync('release.json','utf8')).sha;
const stamp='.cache/elares-beauty-release';
if(!existsSync(stamp)||readFileSync(stamp,'utf8')!==release) {
  mkdirSync('.cache/elares-beauty-previous-caches',{recursive:true});
  if(existsSync('build/server/route-cache'))renameSync('build/server/route-cache',`.cache/elares-beauty-previous-caches/${Date.now()}-${release}`);
  writeFileSync(stamp,release);
}
if (!existsSync('node_modules/next/package.json')) {
  const install=spawnSync('npm',['ci','--omit=dev','--no-audit','--no-fund'],{stdio:'inherit'});
  if(install.status!==0)process.exit(install.status||1);
}
const links=JSON.parse(readFileSync('runtime-links.json','utf8'));
for(const [link,target] of Object.entries(links)) {
  if(!existsSync(link))symlinkSync(resolve(target),resolve(link),process.platform==='win32'?'junction':'dir');
}
await import('./scripts/start.mjs');
""")
    output.writestr('next.config.mjs', """export default {
  distDir:'build', poweredByHeader:false, serverExternalPackages:['pdfkit'],
  async headers() { return [
    {source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'X-Frame-Options',value:'SAMEORIGIN'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
    ]},
    {source:'/sw.js',headers:[
      {key:'Cache-Control',value:'no-cache, no-store, must-revalidate'},
      {key:'Service-Worker-Allowed',value:'/'}
    ]}
  ]; }
};
""")
    output.writestr('.shardcloud', '\n'.join([
        'DISPLAY_NAME=elares-beauty',
        'DESCRIPTION=Elares Beauty - demonstracao ficticia para saloes de beleza',
        'LANGUAGE=node', 'MAIN=start.js', 'MEMORY=512', 'VERSION=recommended',
        'SUBDOMAIN=elares-beauty', 'CUSTOM_COMMAND=node start.js', ''
    ]))
with ZipFile(target) as archive:
    assert archive.testzip() is None
    assert not any(Path(n).name.startswith('.env') for n in archive.namelist())
    release=json.loads(archive.read('release.json'))
print('Pacote Node pronto:', target.name)
print('Release compilada:', release['sha'])
print('SHA256:', hashlib.file_digest(target.open('rb'), 'sha256').hexdigest())
