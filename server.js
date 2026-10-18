const express=require('express');
const cors=require('cors');
const helmet=require('helmet');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');
const path=require('path');
require('dotenv').config();

const app=express();
const PORT=process.env.PORT||5000;
const JWT_SECRET=process.env.JWT_SECRET||'change-this-secret-in-production';
const db=new DatabaseSync(path.join(__dirname,'collegeai.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notes(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 title TEXT NOT NULL,
 content TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS quiz_scores(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 subject TEXT NOT NULL,
 score INTEGER NOT NULL,
 total INTEGER NOT NULL,
 percentage INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chat_history(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER,
 role TEXT NOT NULL,
 message TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS plans(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 subject TEXT NOT NULL,
 days INTEGER NOT NULL,
 hours INTEGER NOT NULL,
 plan_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

app.use(helmet({contentSecurityPolicy:false}));
app.use(cors({origin:true,credentials:true}));
app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'public')));

function sign(user){return jwt.sign({id:user.id,email:user.email,name:user.name},JWT_SECRET,{expiresIn:'7d'});}
function auth(req,res,next){
 const h=req.headers.authorization||'';
 if(!h.startsWith('Bearer ')) return res.status(401).json({error:'Login required'});
 try{req.user=jwt.verify(h.slice(7),JWT_SECRET);next()}catch(e){return res.status(401).json({error:'Session expired. Please login again.'});}
}
function validEmail(e){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);}
function localAnswer(q){
 const x=q.toLowerCase();
 if(x.includes('tcp')||x.includes('network')) return 'Computer Networking: TCP is connection-oriented and reliable; UDP is connectionless and lightweight. The OSI model has seven layers: Physical, Data Link, Network, Transport, Session, Presentation and Application.';
 if(x.includes('cyber')||x.includes('security')) return 'Cybersecurity basics: protect Confidentiality, Integrity and Availability. Common threats include phishing, SQL injection, XSS, malware and denial-of-service attacks. Use strong authentication, least privilege, secure coding and regular updates.';
 if(x.includes('dbms')||x.includes('sql')) return 'DBMS: ACID means Atomicity, Consistency, Isolation and Durability. Normalization reduces redundancy; 1NF requires atomic values, 2NF removes partial dependency and 3NF removes transitive dependency.';
 if(x.includes('operating system')||x.includes('process')||x.match(/\bos\b/)) return 'Operating Systems: a process is a program in execution and a thread is a lightweight execution unit. Common scheduling algorithms include FCFS, SJF, Priority and Round Robin.';
 if(x.includes('python')||x.includes('oop')) return 'Python/OOP: the four pillars are encapsulation, abstraction, inheritance and polymorphism. Python provides lists, tuples, sets and dictionaries plus automatic memory management.';
 if(x.includes('resume')||x.includes('cv')) return 'Resume tip: keep Education, Technical Skills, Projects, Experience/Internships and Certifications clear. Quantify results where possible and tailor skills to the role.';
 return `CollegeAI Pro study assistant: I can help with Networking, Cybersecurity, DBMS, Operating Systems, Python, projects, interview preparation and exam revision. Your question was: ${q}`;
}

app.get('/api/health',(req,res)=>res.json({ok:true,service:'CollegeAI Pro Backend',time:new Date().toISOString()}));

app.post('/api/auth/register',async(req,res)=>{
 try{
  const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
  if(name.length<2)return res.status(400).json({error:'Enter your full name'});
  if(!validEmail(email))return res.status(400).json({error:'Enter a valid email'});
  if(password.length<6)return res.status(400).json({error:'Password must be at least 6 characters'});
  if(db.prepare('SELECT id FROM users WHERE email=?').get(email))return res.status(409).json({error:'An account with this email already exists'});
  const hash=await bcrypt.hash(password,12);
  const r=db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name,email,hash);
  const user={id:r.lastInsertRowid,name,email};
  res.status(201).json({token:sign(user),user});
 }catch(e){res.status(500).json({error:'Registration failed'})}
});
app.post('/api/auth/login',async(req,res)=>{
 try{
  const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
  const row=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(!row||!(await bcrypt.compare(password,row.password_hash)))return res.status(401).json({error:'Invalid email or password'});
  const user={id:row.id,name:row.name,email:row.email};
  res.json({token:sign(user),user});
 }catch(e){res.status(500).json({error:'Login failed'})}
});

app.get('/api/me',auth,(req,res)=>res.json({user:req.user}));

app.get('/api/notes',auth,(req,res)=>{
 const notes=db.prepare('SELECT id,title,content,created_at,updated_at FROM notes WHERE user_id=? ORDER BY id DESC').all(req.user.id);
 res.json({notes});
});
app.post('/api/notes',auth,(req,res)=>{
 const title=String(req.body.title||'').trim(),content=String(req.body.content||'').trim();
 if(!title||!content)return res.status(400).json({error:'Title and content are required'});
 const r=db.prepare('INSERT INTO notes(user_id,title,content) VALUES(?,?,?)').run(req.user.id,title,content);
 res.status(201).json({id:r.lastInsertRowid});
});
app.put('/api/notes/:id',auth,(req,res)=>{
 const r=db.prepare('UPDATE notes SET title=?,content=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?')
 .run(String(req.body.title||'').trim(),String(req.body.content||'').trim(),req.params.id,req.user.id);
 if(!r.changes)return res.status(404).json({error:'Note not found'});res.json({ok:true});
});
app.delete('/api/notes/:id',auth,(req,res)=>{
 const r=db.prepare('DELETE FROM notes WHERE id=? AND user_id=?').run(req.params.id,req.user.id);
 if(!r.changes)return res.status(404).json({error:'Note not found'});res.json({ok:true});
});

app.post('/api/quiz/score',auth,(req,res)=>{
 const subject=String(req.body.subject||'All'),score=Number(req.body.score),total=Number(req.body.total),percentage=Number(req.body.percentage);
 if(!Number.isFinite(score)||!Number.isFinite(total)||total<=0)return res.status(400).json({error:'Invalid score'});
 const r=db.prepare('INSERT INTO quiz_scores(user_id,subject,score,total,percentage) VALUES(?,?,?,?,?)').run(req.user.id,subject,score,total,percentage);
 res.status(201).json({id:r.lastInsertRowid});
});
app.get('/api/quiz/history',auth,(req,res)=>res.json({scores:db.prepare('SELECT * FROM quiz_scores WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id)}));

app.get('/api/stats',auth,(req,res)=>{
 const notes=db.prepare('SELECT COUNT(*) c FROM notes WHERE user_id=?').get(req.user.id).c;
 const best=db.prepare('SELECT COALESCE(MAX(percentage),0) best FROM quiz_scores WHERE user_id=?').get(req.user.id).best;
 res.json({notes,bestQuiz:best});
});

app.post('/api/planner',auth,(req,res)=>{
 const subject=String(req.body.subject||'Computer Science Core').trim();
 const days=Math.min(30,Math.max(1,Number(req.body.days)||7));
 const hours=Math.min(12,Math.max(1,Number(req.body.hours)||2));
 const topics=['Fundamentals & terminology','Core concepts','Architecture / models','Important algorithms','Practical examples','Problem solving','Revision & MCQs'];
 const plan=Array.from({length:days},(_,i)=>({day:i+1,topic:topics[i%topics.length],hours}));
 db.prepare('INSERT INTO plans(user_id,subject,days,hours,plan_json) VALUES(?,?,?,?,?)').run(req.user.id,subject,days,hours,JSON.stringify(plan));
 res.json({subject,days,hours,plan});
});
app.get('/api/planner/history',auth,(req,res)=>res.json({plans:db.prepare('SELECT id,subject,days,hours,plan_json,created_at FROM plans WHERE user_id=? ORDER BY id DESC LIMIT 20').all(req.user.id)}));

app.post('/api/chat',async(req,res)=>{
 const message=String(req.body.message||'').trim();
 if(!message)return res.status(400).json({error:'Message is required'});
 db.prepare('INSERT INTO chat_history(user_id,role,message) VALUES(?,?,?)').run(req.user?.id||null,'user',message);
 let reply;
 if(process.env.OPENAI_API_KEY){
  try{
   const model=process.env.OPENAI_MODEL||'gpt-5-mini';
   const rr=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},body:JSON.stringify({model,messages:[{role:'system',content:'You are CollegeAI Pro, a concise and accurate academic assistant for college students. Explain concepts clearly, use examples when useful, and help with programming, cybersecurity, networking, DBMS, operating systems and Python.'},{role:'user',content:message}],temperature:.3})});
   if(!rr.ok)throw new Error('AI provider error');
   const data=await rr.json();reply=data.choices?.[0]?.message?.content||localAnswer(message);
  }catch(e){reply=localAnswer(message)}
 }else reply=localAnswer(message);
 db.prepare('INSERT INTO chat_history(user_id,role,message) VALUES(?,?,?)').run(req.user?.id||null,'assistant',reply);
 res.json({reply});
});

app.get('*',(req,res)=>{
 if(req.path.startsWith('/api/'))return res.status(404).json({error:'API route not found'});
 res.sendFile(path.join(__dirname,'public','index.html'));
});

app.listen(PORT,()=>console.log(`CollegeAI Pro running at http://localhost:${PORT}`));
