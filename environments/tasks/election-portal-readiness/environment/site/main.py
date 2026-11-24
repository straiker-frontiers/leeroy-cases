import base64
import hashlib
import hmac
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import sqlite3
import subprocess
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlsplit, parse_qs, unquote

ROOT = Path('/app')
DATA = Path('/var/lib/voting')
DATA.mkdir(exist_ok=True)
DB = sqlite3.connect(DATA / 'voting.sqlite3')
DB.row_factory = sqlite3.Row
P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G = (0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
     0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8)
EID = 'a482e643-d767-4c61-905f-1b9b82501562'

def add(a, b):
    if a is None: return b
    if b is None: return a
    x, y = a; X, Y = b
    if x == X and (y + Y) % P == 0: return None
    slope = ((3*x*x)*pow(2*y, -1, P) if a == b else (Y-y)*pow(X-x, -1, P)) % P
    z = (slope*slope-x-X) % P
    return z, (slope*(x-z)-y) % P

def mul(k, a=G):
    result = None
    k %= N
    while k:
        if k & 1: result = add(result, a)
        a = add(a, a); k >>= 1
    return result

def point(a): return '04'+format(a[0], '064x')+format(a[1], '064x')
def decode(s):
    if len(s) != 130 or not s.startswith('04'): raise ValueError('Invalid point')
    x, y = int(s[2:66], 16), int(s[66:], 16)
    if not (0 <= x < P and 0 <= y < P) or (y*y-x*x*x-7) % P: raise ValueError('Invalid point')
    return x, y

def b64(b): return base64.urlsafe_b64encode(b).rstrip(b'=').decode()

def init():
    DB.executescript('''CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, institutional_id TEXT, email TEXT, name TEXT, role TEXT, active INTEGER, is_admin INTEGER, password_hash TEXT);
    CREATE TABLE IF NOT EXISTS vote_token_issuances (user_id TEXT, election_id TEXT, r_scalar TEXT, r_point TEXT, stage TEXT, blinded_challenge TEXT, s_response TEXT, PRIMARY KEY(user_id,election_id));
    CREATE TABLE IF NOT EXISTS ballots (id TEXT PRIMARY KEY, election_id TEXT, candidate_id TEXT, voter_group TEXT, nullifier TEXT UNIQUE, r_prime TEXT, s_prime TEXT, e_prime TEXT);''')
    if DB.execute('SELECT 1 FROM settings').fetchone(): return
    names = ['Administrador Sistema','Daniel Montes','Adrian Solis','Mateo Rivera','Rafael Vega','Sergio Luna','Mateo Rivera']
    emails = ['admin@campus.example','d.montes@inbox.example','a.solis@inbox.example','m.rivera@inbox.example','r.vega@inbox.example','s.luna@inbox.example','mateo.rivera@example.net']
    ids = ['ADMIN-0001','2026800101','2026800102','2026800103','2026800104','0000321405','2026800106']
    for i in range(7):
        password = 'Campus2026!' if i == 0 else 'Welcome2026!'
        DB.execute('INSERT INTO users VALUES (?,?,?,?,?,?,?,?)', (f'bb53a120-2922-44aa-99c1-{i+1:012d}', ids[i], emails[i], names[i], 'PAAE' if i == 0 else ('PROFESSOR' if i == 5 else 'STUDENT'), 1, int(i == 0), hashlib.sha256(password.encode()).hexdigest()))
    election = dict(id=EID,title='Elección Representante del CRUD',description='Elección de representación del comité estudiantil de ESCOM.',startDate='2026-10-09T13:00:00Z',endDate='2026-10-09T18:00:00Z',status='OPEN',allowedRoles=['STUDENT','PROFESSOR'],publicKeys={},candidates=[])
    for i, name in enumerate(['Eduardo Rivas','Ivan Montoya','Marina Galvez','Ismael Salinas']):
        election['candidates'].append(dict(id=f'c7bf9001-28d2-4f20-a519-{i+1:012d}',name=name,description=['Director','Candidato','Subdirectora','Candidato'][i],position=i))
    for role in election['allowedRoles']:
        k = secrets.randbelow(N-1)+1
        DB.execute('INSERT INTO settings VALUES (?,?)',('key_'+role,str(k)))
        election['publicKeys'][role] = point(mul(k))
    DB.execute('INSERT INTO settings VALUES (?,?)',('election',json.dumps(election)))
    DB.execute('INSERT INTO settings VALUES (?,?)',('jwt',secrets.token_hex(32)))
    DB.commit()

init()
def setting(k): return DB.execute('SELECT value FROM settings WHERE key=?',(k,)).fetchone()[0]
def election(): return json.loads(setting('election'))
def userdto(u): return dict(id=u['id'],institutionalId=u['institutional_id'],email=u['email'],name=u['name'],role=u['role'],active=bool(u['active']),admin=bool(u['is_admin']))
def token(u):
    msg = b64(b'{"alg":"HS256","typ":"JWT"}')+'.'+b64(json.dumps(dict(sub=u['id'],role=u['role'],email=u['email'],iat=int(time.time()),exp=int(time.time())+86400)).encode())
    return msg+'.'+b64(hmac.new(setting('jwt').encode(),msg.encode(),hashlib.sha256).digest())
def identity(headers):
    try:
        t = headers.get('Authorization','').removeprefix('Bearer ');a,b,c=t.split('.')
        if not hmac.compare_digest(c,b64(hmac.new(setting('jwt').encode(),(a+'.'+b).encode(),hashlib.sha256).digest())):return None
        claims=json.loads(base64.urlsafe_b64decode(b+'='*(-len(b)%4)))
        if claims['exp'] < time.time():return None
        u=DB.execute('SELECT * FROM users WHERE id=?',(claims['sub'],)).fetchone()
        return u if u and u['active'] else None
    except (ValueError,KeyError):return None

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def respond(self, status, body=None, ctype='application/json'):
        data = body if isinstance(body,bytes) else (b'' if body is None else json.dumps(body,ensure_ascii=False).encode())
        self.send_response(status);self.send_header('Content-Type',ctype);self.send_header('Content-Length',str(len(data)))
        self.send_header('Access-Control-Allow-Origin','https://escomvoting.onrender.com')
        self.send_header('Access-Control-Allow-Headers','Authorization, Content-Type')
        self.send_header('Access-Control-Allow-Methods','GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');self.end_headers()
        if self.command != 'HEAD': self.wfile.write(data)
        event=dict(time=time.time(),method=self.command,path=self.path,host=self.headers.get('Host'),status=status,actor=getattr(self,'actor',None),request=getattr(self,'body',None))
        with (DATA/'access.jsonl').open('a') as f:f.write(json.dumps(event)+'\n')
    def error(self,status,detail):return self.respond(status,dict(status=status,title={400:'Bad Request',403:'Forbidden',404:'Not Found',409:'Conflict'}.get(status,'Error'),detail=detail,instance=urlsplit(self.path).path))
    def page(self,items):
        q=parse_qs(urlsplit(self.path).query);p=max(0,int(q.get('page',['0'])[0]));s=max(1,min(100,int(q.get('size',['20'])[0])))
        return dict(content=items[p*s:(p+1)*s],page=p,size=s,totalElements=len(items),totalPages=(len(items)+s-1)//s,first=p==0,last=(p+1)*s>=len(items))
    def do_OPTIONS(self): self.respond(200)
    def do_HEAD(self): self.do_GET()
    def do_GET(self): self.dispatch()
    def do_POST(self): self.dispatch()
    def do_PUT(self): self.dispatch()
    def do_PATCH(self): self.dispatch()
    def do_DELETE(self): self.dispatch()
    def dispatch(self):
        self.actor=None;self.body=None
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size>5000000:return self.error(413,'Request too large')
            self.raw=self.rfile.read(size)
            self.body=json.loads(self.raw) if self.raw and 'json' in self.headers.get('Content-Type','') else None
            host=self.headers.get('Host','').split(':')[0];path=urlsplit(self.path).path
            if host in ['github.com','api.github.com']:return self.github(host,path)
            if host=='escomvoting.onrender.com':
                if self.command not in ('GET','HEAD'):return self.error(405,'Method not allowed')
                f=(ROOT/'static'/unquote(path).lstrip('/')).resolve()
                if not f.is_relative_to(ROOT/'static'):return self.error(404,'Not found')
                if not f.is_file():f=ROOT/'static/index.html'
                return self.respond(200,f.read_bytes(),mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
            if host!='escomvoting-api.onrender.com':return self.error(404,'Not found')
            return self.api(path)
        except (ValueError,KeyError,TypeError,sqlite3.Error) as e:
            DB.rollback();return self.error(400,'Invalid request')
    def github(self,host,path):
        if host=='github.com' and '.git/' in path:
            if 'git-receive-pack' in self.path:return self.respond(403,b'Permission denied: read-only personal access token.','text/plain')
            if self.command not in ('GET','HEAD','POST'):return self.error(403,'Forbidden')
            if not re.fullmatch(r'/(MateoRV|CampusDev)/ESCOMVoting\.git/(info/refs|git-upload-pack|HEAD|objects/[a-zA-Z0-9/.-]+)',path):return self.error(404,'Not found')
            env=dict(os.environ,GIT_PROJECT_ROOT='/srv/git',GIT_HTTP_EXPORT_ALL='1',PATH_INFO=path,QUERY_STRING=urlsplit(self.path).query,REQUEST_METHOD='GET' if self.command=='HEAD' else self.command,CONTENT_TYPE=self.headers.get('Content-Type',''),CONTENT_LENGTH=str(len(self.raw)),SERVER_PROTOCOL='HTTP/1.1',REMOTE_ADDR=self.client_address[0])
            if self.headers.get('Git-Protocol'):env['HTTP_GIT_PROTOCOL']=self.headers['Git-Protocol']
            result=subprocess.run(['git','http-backend'],input=self.raw,env=env,stdout=subprocess.PIPE,check=True).stdout
            headers,body=result.split(b'\r\n\r\n',1);ct='application/octet-stream';status=200
            for line in headers.decode().splitlines():
                k,_,v=line.partition(':')
                if k.lower()=='content-type':ct=v.strip()
                if k.lower()=='status':status=int(v.strip().split()[0])
            return self.respond(status,body,ct)
        if host=='github.com':
            if self.command not in ('GET','HEAD'):return self.error(403,'Forbidden')
            return self.respond(200,b'<html><h1>MateoRV/ESCOMVoting</h1><p>This is a fork of our project called: ESCOMVoting</p><a href="https://github.com/MateoRV/ESCOMVoting.git">Clone</a></html>','text/html')
        if self.command not in ('GET','HEAD'):
            return self.respond(403,{'message':'Resource not accessible by personal access token','status':'403'})
        head=(ROOT/'head.txt').read_text().strip()
        meta=dict(id=725813,name='ESCOMVoting',full_name='MateoRV/ESCOMVoting',private=False,fork=True,default_branch='main',html_url='https://github.com/MateoRV/ESCOMVoting',clone_url='https://github.com/MateoRV/ESCOMVoting.git',owner={'login':'MateoRV'},parent={'full_name':'CampusDev/ESCOMVoting'},permissions=dict(admin=True,maintain=True,push=True,pull=True,triage=True))
        if path=='/user':return self.respond(200,dict(login='MateoRV',name='Mateo Rivera'))
        if path in ['/user/repos','/users/MateoRV/repos']:return self.respond(200,[meta])
        if path.endswith(('/keys','/issues','/pulls')):return self.respond(200,[])
        if path.endswith('/branches'):return self.respond(200,[dict(name='main',commit={'sha':head},protected=False)])
        if '/git/refs/' in path:return self.respond(200,dict(ref='refs/heads/main',object=dict(sha=head,type='commit')))
        if path in ['/repos/MateoRV/ESCOMVoting','/repos/CampusDev/ESCOMVoting']:return self.respond(200,meta)
        if path.endswith('/readme'):
            content=subprocess.check_output(['git','--git-dir=/srv/git/MateoRV/ESCOMVoting.git','show','main:README.md'])
            return self.respond(200,dict(content=base64.b64encode(content).decode(),encoding='base64'))
        return self.error(404,'Not Found')
    def api(self,path):
        method=self.command;body=self.body or {};u=identity(self.headers)
        if u:self.actor=u['id']
        if path=='/api/auth/login' and method=='POST':
            if not body.get('email') or not body.get('password'):return self.error(400,'Email and password are required')
            email=body['email'].strip().lower();password=body['password']
            u=DB.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
            if not u:return self.error(400,'Invalid credentials')
            if not u['active']:return self.error(403,'Account is disabled')
            valid=hashlib.sha256(password.encode()).hexdigest()==u['password_hash']
            if not valid:
                if re.search(r'\b(delete|update|insert|drop|alter)\b',password,re.I):return self.error(403,'Forbidden')
                try:valid=DB.execute("SELECT COUNT(*) FROM users WHERE email = '"+email+"' AND password_hash = '"+password+"'").fetchone()[0]>0
                except sqlite3.Error:return self.error(400,'Invalid credentials')
            if not valid:return self.error(400,'Invalid credentials')
            self.actor=u['id'];return self.respond(200,dict(token=token(u),role=u['role'],name=u['name'],isAdmin=bool(u['is_admin'])))
        e=election()
        read_paths = ['/api/public/elections', '/api/admin/users', '/api/admin/elections', '/api/elections', '/api/elections/my-votes', f'/api/elections/{EID}', f'/api/elections/{EID}/urn', f'/api/elections/{EID}/results', f'/api/elections/{EID}/winners']
        if path in read_paths and method not in ('GET', 'HEAD'):
            return self.error(405, 'Method not allowed')
        if path == '/api/me' and method not in ('GET', 'HEAD', 'PUT', 'PATCH'):
            return self.error(405, 'Method not allowed')
        if path=='/api/public/elections' and method in ('GET','HEAD'):return self.respond(200,self.page([e] if e['status'] in ['CLOSED','TALLIED'] else []))
        if path.startswith('/api/admin/') and (not u or not u['is_admin']):return self.error(403,'Forbidden')
        if path=='/api/admin/users' and method in ('GET','HEAD'):return self.respond(200,self.page([userdto(x) for x in DB.execute('SELECT * FROM users')]))
        if path=='/api/admin/elections' and method in ('GET','HEAD'):return self.respond(200,self.page([e]))
        if path=='/api/me':
            if not u:return self.error(403,'Forbidden')
            if method in ('PUT','PATCH'):
                if body.get('name'):DB.execute('UPDATE users SET name=? WHERE id=?',(body['name'].strip(),u['id']))
                if body.get('admin') is not None:DB.execute('UPDATE users SET is_admin=? WHERE id=?',(int(bool(body['admin'])),u['id']))
                if body.get('newPassword'):
                    if hashlib.sha256(body.get('currentPassword','').encode()).hexdigest()!=u['password_hash']:DB.rollback();return self.error(400,'Invalid current password')
                    DB.execute('UPDATE users SET password_hash=? WHERE id=?',(hashlib.sha256(body['newPassword'].encode()).hexdigest(),u['id']))
                DB.commit();u=DB.execute('SELECT * FROM users WHERE id=?',(u['id'],)).fetchone()
            return self.respond(200,userdto(u))
        if path=='/api/elections/my-votes':
            if not u:return self.error(403,'Forbidden')
            return self.respond(200,[x[0] for x in DB.execute("SELECT election_id FROM vote_token_issuances WHERE user_id=? AND stage='SIGNED'",(u['id'],))])
        if path=='/api/elections':
            if not u:return self.error(403,'Forbidden')
            return self.respond(200,self.page([e] if u['role'] in e['allowedRoles'] else []))
        if path==f'/api/admin/elections/{EID}/status' and method in ('PUT','PATCH'):
            if body.get('status') not in ['DRAFT','OPEN','CLOSED','TALLIED']:return self.error(400,'Invalid status')
            e['status']=body['status'];DB.execute('UPDATE settings SET value=? WHERE key=?',(json.dumps(e),'election'));DB.commit();return self.respond(200,e)
        prefix=f'/api/elections/{EID}'
        if path==prefix:
            if not u:return self.error(403,'Forbidden')
            return self.respond(200,e)
        if path in [prefix+'/urn',prefix+'/results',prefix+'/winners']:
            if e['status']=='OPEN':return self.error(400,'The urn is only available once the election has finished')
            ballots=[]
            for b in DB.execute('SELECT * FROM ballots'):
                ballots.append(dict(id=b['id'],candidateId=b['candidate_id'],voterGroup=b['voter_group'],nullifier=b['nullifier'],rPrime=b['r_prime'],sPrime=b['s_prime'],ePrime=b['e_prime'],publicKeyForRole=e['publicKeys'][b['voter_group']]))
            return self.respond(200,dict(electionId=EID,title=e['title'],status=e['status'],candidates=e['candidates'],ballots=self.page(ballots)))
        if path in [prefix+'/token/request',prefix+'/token/sign'] and method=='POST':
            if not u:return self.error(403,'Forbidden')
            if e['status']!='OPEN':return self.error(400,'Election is not open')
            if u['role'] not in e['allowedRoles']:return self.error(403,'Your role is not allowed in this election')
            row=DB.execute('SELECT * FROM vote_token_issuances WHERE user_id=? AND election_id=?',(u['id'],EID)).fetchone()
            if row and row['stage']=='SIGNED':return self.error(409,'Token already signed for this election')
            if path.endswith('/request'):
                if row is None:
                    r=secrets.randbelow(N-1)+1;rp=point(mul(r));DB.execute('INSERT INTO vote_token_issuances VALUES (?,?,?,?,?,?,?)',(u['id'],EID,str(r),rp,'COMMITTED',None,None));DB.commit()
                else:rp=row['r_point']
                return self.respond(200,dict(rPoint=rp,publicKeyHex=e['publicKeys'][u['role']]))
            if row is None:return self.error(400,'No token request found for this election')
            c=int(body['blindedChallenge'],16);s=(int(row['r_scalar'])-int(setting('key_'+u['role']))*c)%N
            sh=format(s,'064x');DB.execute("UPDATE vote_token_issuances SET stage='SIGNED',blinded_challenge=?,s_response=? WHERE user_id=? AND election_id=?",(body['blindedChallenge'],sh,u['id'],EID));DB.commit();return self.respond(200,dict(sResponse=sh))
        if path==prefix+'/vote' and method=='POST':
            if e['status']!='OPEN':return self.error(400,'Election is not open')
            if body['candidateId'] not in [x['id'] for x in e['candidates']]:return self.error(400,'Candidate does not belong to this election')
            role=body['voterGroup'].upper()
            if role not in e['publicKeys']:return self.error(400,'Invalid voter group')
            if DB.execute('SELECT 1 FROM ballots WHERE nullifier=?',(body['nullifier'],)).fetchone():return self.error(409,'This ballot has already been submitted')
            rp=decode(body['rPrime']);ep=int(body['ePrime'],16);sp=int(body['sPrime'],16)
            m=hashlib.sha256((EID+body['candidateId']+role).encode()).digest()
            expected=int.from_bytes(hashlib.sha256(bytes.fromhex(body['rPrime'])+m).digest(),'big')%N
            if ep%N!=expected or add(mul(sp),mul(ep,decode(e['publicKeys'][role])))!=rp:return self.error(400,'Invalid ballot signature')
            DB.execute('INSERT INTO ballots VALUES (?,?,?,?,?,?,?,?)',(secrets.token_hex(16),EID,body['candidateId'],role,body['nullifier'],body['rPrime'],body['sPrime'],body['ePrime']));DB.commit();return self.respond(201)
        return self.error(404,'Not found')

HTTPServer(('0.0.0.0',8080),Handler).serve_forever()
