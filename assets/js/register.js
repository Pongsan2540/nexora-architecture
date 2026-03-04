/* register.js — Page-specific logic */
/* Shared utilities: ../js/glassui.js */

(function(){
  const veil = document.getElementById('pageVeil');
  function navigateTo(url){ veil.classList.add('in'); setTimeout(()=>location.href=url,430); }
  window.navigateTo = navigateTo;
  veil.classList.add('in');
  requestAnimationFrame(()=>requestAnimationFrame(()=>veil.classList.remove('in')));

  const root = document.documentElement;
  let dark = root.getAttribute('data-theme') !== 'light';
  document.getElementById('themeBtn').addEventListener('click', ()=>{
    dark=!dark; root.setAttribute('data-theme',dark?'dark':'light');
  });

  // Grid
  const canvas=document.getElementById('bgCanvas'), ctx=canvas.getContext('2d');
  const DPR=Math.min(window.devicePixelRatio||1,2), T0=Date.now(), GS=64;
  let W,H,GCOLS,GROWS,CELLS;
  function resize(){
    W=window.innerWidth;H=window.innerHeight;
    canvas.width=W*DPR;canvas.height=H*DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0);
    GCOLS=Math.ceil(W/GS)+1;GROWS=Math.ceil(H/GS)+1;CELLS=[];
    for(let r=0;r<GROWS;r++)for(let c=0;c<GCOLS;c++)CELLS.push({row:r,col:c,delay:Math.random()*3000});
  }
  resize();window.addEventListener('resize',resize);
  function gl(){
    const a=dark?0.045:0.06;ctx.save();
    ctx.strokeStyle=dark?`rgba(200,196,188,${a})`:`rgba(30,28,22,${a})`;ctx.lineWidth=0.4;
    for(let x=0;x<=W;x+=GS){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<=H;y+=GS){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.restore();
  }
  function gc(){
    const now=Date.now()-T0;ctx.save();
    CELLS.forEach(cell=>{
      const age=now-cell.delay;if(age<0)return;
      const cyc=(age%4200)/4200;
      const f=cyc<0.05?cyc/0.05:cyc<0.18?1-(cyc-0.05)/0.13:0;
      if(f<0.01)return;
      const x=cell.col*GS,y=cell.row*GS;
      ctx.fillStyle=dark?`rgba(210,205,195,${f*0.025})`:`rgba(30,28,24,${f*0.02})`;
      ctx.fillRect(x,y,GS,GS);
      ctx.fillStyle=dark?`rgba(210,205,195,${f*0.12})`:`rgba(30,28,24,${f*0.12})`;
      [[x,y],[x+GS,y],[x,y+GS],[x+GS,y+GS]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,1.1,0,Math.PI*2);ctx.fill();});
    });ctx.restore();
  }
  (function loop(){ctx.clearRect(0,0,W,H);gl();gc();requestAnimationFrame(loop);})();
})();

/* ─── DATA ─── */
const COLORS=['#8a7e6e','#6a7a68','#7a8a6e','#7e6e8a','#6e8a7a','#8a7a6e'];
let users=[
  {id:1,firstName:'Arisa',    lastName:'Tanaka',  email:'arisa@example.com',  phone:'+66 81 111 2222',role:'Administrator',dept:'Management',status:'Active', date:'2026-01-05',photo:null},
  {id:2,firstName:'Prawit',   lastName:'Suwanna', email:'prawit@example.com', phone:'+66 89 222 3333',role:'Editor',       dept:'Content',   status:'Active', date:'2026-01-18',photo:null},
  {id:3,firstName:'Sirilak',  lastName:'Panya',   email:'sirilak@example.com',phone:'+66 82 333 4444',role:'User',         dept:'Marketing', status:'Pending',date:'2026-02-03',photo:null},
  {id:4,firstName:'Nattawut', lastName:'Korn',    email:'natt@example.com',   phone:'+66 83 444 5555',role:'Editor',       dept:'Analytics', status:'Active', date:'2026-02-14',photo:null},
  {id:5,firstName:'Pimchanok',lastName:'Ruang',   email:'pim@example.com',    phone:'+66 84 555 6666',role:'User',         dept:'Support',   status:'Pending',date:'2026-02-28',photo:null},
];
let nextId=6, detailUserId=null, pendingPhoto=null;

const ac=i=>COLORS[i%COLORS.length];
const ini=u=>(u.firstName[0]+u.lastName[0]).toUpperCase();

function avHTML(u,i,cls){
  return u.photo
    ? `<div class="${cls}" style="background:#111"><img src="${u.photo}" alt="${u.firstName}"></div>`
    : `<div class="${cls}" style="background:${ac(i)}">${ini(u)}</div>`;
}

function badge(s){
  if(s==='Active')  return '<span class="badge on">Active</span>';
  if(s==='Pending') return '<span class="badge pend">Pending</span>';
  return '<span class="badge off">Inactive</span>';
}

function updateStats(){
  document.getElementById('statTotal').textContent  = users.length;
  document.getElementById('statActive').textContent = users.filter(u=>u.status==='Active').length;
  document.getElementById('statPending').textContent= users.filter(u=>u.status==='Pending').length;
  document.getElementById('sbPill').textContent     = users.length;
}

function renderTable(list){
  const tb=document.getElementById('userTableBody');
  if(!list.length){tb.innerHTML='<tr class="empty-row"><td colspan="6">No users found</td></tr>';return;}
  tb.innerHTML=list.map((u,i)=>`
    <tr onclick="openDetail(${u.id})">
      <td><div class="td-main">${avHTML(u,i,'av')}<span>${u.firstName} ${u.lastName}</span></div></td>
      <td>${u.email}</td><td>${u.role}</td><td>${u.phone}</td><td>${u.date}</td>
      <td>${badge(u.status)}</td>
    </tr>`).join('');
}

function filterUsers(){
  const q=document.getElementById('searchInput').value.toLowerCase();
  renderTable(users.filter(u=>
    (u.firstName+' '+u.lastName).toLowerCase().includes(q)||
    u.email.toLowerCase().includes(q)||u.role.toLowerCase().includes(q)||u.dept.toLowerCase().includes(q)));
}

/* ─── PHOTO HANDLERS ─── */
function readFile(file,cb){
  const r=new FileReader();r.onload=e=>cb(e.target.result);r.readAsDataURL(file);
}

function onFileModal(e){
  const f=e.target.files[0];if(!f)return;
  readFile(f,b64=>{
    pendingPhoto=b64;
    const c=document.getElementById('mPhotoCircle');
    c.innerHTML=`<img src="${b64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" alt="preview">`;
    document.getElementById('mRemoveBtn').style.display='inline-flex';
  });
  e.target.value='';
}

function clearModalPhoto(){
  pendingPhoto=null;
  syncModalInitials();
  document.getElementById('mRemoveBtn').style.display='none';
}

function syncModalInitials(){
  if(pendingPhoto)return;
  const fn=document.getElementById('fFirstName').value;
  const ln=document.getElementById('fLastName').value;
  const txt=((fn[0]||'?')+(ln[0]||'')).toUpperCase();
  document.getElementById('mPhotoCircle').innerHTML=`<span id="mPhotoIni" style="pointer-events:none">${txt}</span>`;
}

function onFileDetail(e){
  const f=e.target.files[0];if(!f||detailUserId===null)return;
  readFile(f,b64=>{
    const u=users.find(x=>x.id===detailUserId);
    if(u){u.photo=b64;renderTable(users);openDetail(detailUserId);}
  });
  e.target.value='';
}

/* ─── MODAL ─── */
function openModal(){
  pendingPhoto=null;
  ['fFirstName','fLastName','fEmail','fPhone','fDept'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fRole').value='User';
  document.getElementById('fStatus').value='Active';
  document.getElementById('mPhotoCircle').innerHTML='<span id="mPhotoIni" style="pointer-events:none">?</span>';
  document.getElementById('mRemoveBtn').style.display='none';
  document.getElementById('addModal').classList.add('show');
  setTimeout(()=>document.getElementById('fFirstName').focus(),260);
}
function closeModal(){document.getElementById('addModal').classList.remove('show');}
function closeModalOutside(e){if(e.target===document.getElementById('addModal'))closeModal();}

function submitUser(){
  const fn=document.getElementById('fFirstName').value.trim();
  const ln=document.getElementById('fLastName').value.trim();
  const em=document.getElementById('fEmail').value.trim();
  if(!fn||!ln||!em){alert('Please fill in First Name, Last Name, and Email.');return;}
  users.unshift({
    id:nextId++,firstName:fn,lastName:ln,email:em,
    phone:document.getElementById('fPhone').value.trim()||'—',
    role:document.getElementById('fRole').value,
    dept:document.getElementById('fDept').value.trim()||'—',
    status:document.getElementById('fStatus').value,
    date:new Date().toISOString().slice(0,10),
    photo:pendingPhoto
  });
  closeModal();renderTable(users);updateStats();
}

/* ─── DETAIL ─── */
function openDetail(id){
  detailUserId=id;
  const u=users.find(x=>x.id===id);if(!u)return;
  const idx=users.indexOf(u);
  const panel=document.getElementById('detailPanel');
  panel.innerHTML=`
    <div class="dp-hd">
      <div style="flex:1"></div>
      <button class="dp-close" onclick="closeDetail()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="dp-profile-block">
      <div class="dp-photo-wrap">
        ${avHTML(u,idx,'av-lg')}
        <div class="dp-cam" onclick="document.getElementById('fileDetail').click()" title="Change photo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
      </div>
      <div>
        <div class="dp-name">${u.firstName} ${u.lastName}</div>
        <div class="dp-email">${u.email}</div>
        <div class="dp-photo-actions">
          <label class="btn-pick" for="fileDetail" style="font-size:10px;padding:4px 10px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:10px;height:10px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            ${u.photo?'Change Photo':'Upload Photo'}
          </label>
          ${u.photo?`<button class="btn-rm" style="font-size:10px;padding:4px 10px;" onclick="removeUserPhoto(${u.id})">Remove</button>`:''}
        </div>
      </div>
    </div>
    <div class="dp-divider"></div>
    <div>
      <div class="dp-section">Account Info</div>
      <div class="dp-fields">
        <div class="dp-field"><div class="dp-field-label">Full Name</div><div class="dp-field-val">${u.firstName} ${u.lastName}</div></div>
        <div class="dp-field"><div class="dp-field-label">Email</div><div class="dp-field-val">${u.email}</div></div>
        <div class="dp-field"><div class="dp-field-label">Phone</div><div class="dp-field-val">${u.phone}</div></div>
      </div>
    </div>
    <div class="dp-divider"></div>
    <div>
      <div class="dp-section">Role & Access</div>
      <div class="dp-fields">
        <div class="dp-field"><div class="dp-field-label">Role</div><div class="dp-field-val">${u.role}</div></div>
        <div class="dp-field"><div class="dp-field-label">Department</div><div class="dp-field-val">${u.dept}</div></div>
        <div class="dp-field"><div class="dp-field-label">Status</div><div class="dp-field-val">${badge(u.status)}</div></div>
      </div>
    </div>
    <div class="dp-divider"></div>
    <div>
      <div class="dp-section">Registration</div>
      <div class="dp-fields">
        <div class="dp-field"><div class="dp-field-label">Date Registered</div><div class="dp-field-val">${u.date}</div></div>
        <div class="dp-field"><div class="dp-field-label">User ID</div><div class="dp-field-val">#${String(u.id).padStart(4,'0')}</div></div>
      </div>
    </div>
    <div class="dp-divider"></div>
    <div class="dp-actions">
      <button class="dp-btn" onclick="toggleStatus(${u.id})">${u.status==='Active'?'Deactivate':'Activate'}</button>
      <button class="dp-btn danger" onclick="deleteUser(${u.id})">Delete</button>
    </div>`;
  document.getElementById('detailOverlay').classList.add('show');
}

function removeUserPhoto(id){
  const u=users.find(x=>x.id===id);if(u){u.photo=null;renderTable(users);openDetail(id);}
}
function closeDetail(){document.getElementById('detailOverlay').classList.remove('show');detailUserId=null;}
function closeDetailOutside(e){if(e.target===document.getElementById('detailOverlay'))closeDetail();}

function toggleStatus(id){
  const u=users.find(x=>x.id===id);if(!u)return;
  u.status=u.status==='Active'?'Inactive':'Active';
  closeDetail();renderTable(users);updateStats();
}
function deleteUser(id){
  if(!confirm('Remove this user?'))return;
  users=users.filter(x=>x.id!==id);
  closeDetail();renderTable(users);updateStats();
}

renderTable(users);updateStats();