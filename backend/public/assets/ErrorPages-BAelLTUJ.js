import{j as e,B as i,C as P,e as p,b as L,d as N,b0 as A,b3 as F,b4 as O,aa as C,S as W,A as R,as as B,x as H,f as U,g as w}from"./vendor-mui-Bl3n88_x.js";import{r as a}from"./vendor-react-HwFqvWhf.js";import{D as I}from"./layout-4J-IGExX.js";import{d as $}from"./domains-4ztY9vh8.js";import"./index-BMAWticC.js";const S="/api/error-pages";async function E(r,n){const s=await fetch(r,{...n,credentials:"include"});if(!s.ok){const o=await s.json().catch(()=>({error:`HTTP ${s.status}`}));throw new Error(o.error||o.message||`Request failed: ${s.status}`)}return s.json()}const k={list:r=>E(`${S}?domain=${encodeURIComponent(r)}`),save:r=>E(S,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)}),remove:r=>E(`${S}/${r}`,{method:"DELETE"})},z=[{code:"404",label:"404 Not Found",desc:"When the requested file or path does not exist."},{code:"500",label:"500 Internal Server Error",desc:"When a script crashes or backend fails."},{code:"503",label:"503 Service Unavailable",desc:"When the server is temporarily overloaded or down for maintenance."}],T={404:`<!DOCTYPE html>
<html>
<head>
  <title>404 Not Found</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 50px; }
    h1 { font-size: 50px; }
  </style>
</head>
<body>
  <h1>404</h1>
  <h2>Page Not Found</h2>
  <p>The requested URL was not found on this server.</p>
</body>
</html>`,500:`<!DOCTYPE html>
<html>
<head>
  <title>500 Internal Server Error</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 50px; }
    h1 { font-size: 50px; }
  </style>
</head>
<body>
  <h1>500</h1>
  <h2>Internal Server Error</h2>
  <p>The server encountered an internal error or misconfiguration.</p>
</body>
</html>`,503:`<!DOCTYPE html>
<html>
<head>
  <title>503 Service Unavailable</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 50px; }
    h1 { font-size: 50px; }
  </style>
</head>
<body>
  <h1>503</h1>
  <h2>Service Unavailable</h2>
  <p>The server is temporarily unable to service your request.</p>
</body>
</html>`};function q({domain:r,codeConfig:n,initialData:s,onSave:o}){const[f,c]=a.useState((s==null?void 0:s.html)||T[n.code]),[y,h]=a.useState((s==null?void 0:s.enabled)??!0),[g,u]=a.useState(!1),[m,x]=a.useState("");a.useEffect(()=>{s?(c(s.html),h(s.enabled)):(c(T[n.code]),h(!0))},[s,n.code]);const v=async()=>{u(!0),x("");try{await k.save({domain:r,code:n.code,html:f,enabled:y}),o()}catch(l){x(l.message)}finally{u(!1)}},b=()=>{c(T[n.code])};return e.jsx(L,{sx:{mb:3},children:e.jsxs(N,{sx:{p:3},children:[e.jsxs(i,{sx:{display:"flex",alignItems:"center",justifyContent:"space-between",mb:2},children:[e.jsxs(i,{children:[e.jsxs(p,{variant:"h6",fontWeight:600,children:["Error ",n.code]}),e.jsx(p,{variant:"body2",color:"text.secondary",children:n.desc})]}),e.jsxs(i,{sx:{display:"flex",alignItems:"center",gap:1},children:[e.jsx(p,{variant:"body2",color:"text.secondary",children:"Enabled"}),e.jsx(H,{checked:y,onChange:l=>h(l.target.checked),color:"primary"})]})]}),m&&e.jsx(R,{severity:"error",sx:{mb:2},children:m}),e.jsx(U,{multiline:!0,fullWidth:!0,variant:"outlined",rows:12,value:f,onChange:l=>c(l.target.value),sx:{mb:2,fontFamily:"monospace","& .MuiInputBase-input":{fontFamily:"monospace",fontSize:"13px"}}}),e.jsxs(i,{sx:{display:"flex",gap:2},children:[e.jsx(w,{variant:"contained",onClick:v,disabled:g||!r,children:g?"Saving...":"Save Changes"}),e.jsx(w,{variant:"outlined",color:"inherit",onClick:b,children:"Restore Default"})]})]})})}function G(){const[r,n]=a.useState([]),[s,o]=a.useState(""),[f,c]=a.useState(!0),[y,h]=a.useState(!1),[g,u]=a.useState([]),[m,x]=a.useState("");a.useEffect(()=>{v()},[]),a.useEffect(()=>{s&&b(s)},[s]);const v=async()=>{try{const t=await $.list(),d=Array.isArray(t)?t.map(j=>j.name):[];n(d),d.length>0&&!s&&o(d[0])}catch{}finally{c(!1)}},b=async t=>{h(!0);try{const d=await k.list(t);u(d.pages||[])}catch{u([])}finally{h(!1)}},l=()=>{x("Error page updated and Nginx reloaded successfully"),b(s)};return f?e.jsx(I,{children:e.jsx(i,{display:"flex",justifyContent:"center",mt:4,children:e.jsx(P,{})})}):e.jsxs(I,{children:[e.jsxs(i,{sx:{maxWidth:900,mx:"auto"},children:[e.jsxs(i,{sx:{mb:4},children:[e.jsx(p,{variant:"h4",fontWeight:700,gutterBottom:!0,children:"Custom Error Pages"}),e.jsx(p,{variant:"body1",color:"text.secondary",children:"Customize the HTML served for common HTTP error codes. These overrides are injected directly into your Nginx configuration."})]}),e.jsx(L,{sx:{mb:4},children:e.jsx(N,{sx:{p:3},children:e.jsxs(A,{fullWidth:!0,children:[e.jsx(F,{children:"Select Domain"}),e.jsx(O,{value:s,label:"Select Domain",onChange:t=>o(t.target.value),children:r.length===0?e.jsx(C,{disabled:!0,value:"",children:"No domains found"}):r.map(t=>e.jsx(C,{value:t,children:t},t))})]})})}),s?y?e.jsx(P,{}):e.jsx(W,{spacing:0,children:z.map(t=>{const d=g.find(j=>j.code===t.code);return e.jsx(q,{domain:s,codeConfig:t,initialData:d,onSave:l},t.code)})}):e.jsx(R,{severity:"info",children:"Please select a domain to manage error pages."})]}),e.jsx(B,{open:!!m,autoHideDuration:4e3,onClose:()=>x(""),message:m})]})}export{G as default};
