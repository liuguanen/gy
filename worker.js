// 简化的 API 代理 Worker
let logs = [];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    
    // ==================== 日志查看器 ====================
    if (url.pathname === '/_logs') {
      return new Response(generateLogPage(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }
    
    if (url.pathname === '/_logs/api') {
      return new Response(JSON.stringify({
        success: true,
        data: logs.slice(0, 100),
        total: logs.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/_logs/clear' && request.method === 'POST') {
      logs = [];
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/_health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        logs: logs.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // ==================== 代理逻辑 ====================
    const log = (msg, data = null) => {
      const logEntry = {
        time: new Date().toISOString(),
        msg: msg,
        data: data,
        url: request.url,
        ip: clientIP
      };
      logs.unshift(logEntry);
      if (logs.length > 1000) logs = logs.slice(0, 1000);
      console.log(JSON.stringify(logEntry));
    };
    
    try {
      log('收到请求', { url: url.pathname, method: request.method });
      
      // 代理到目标服务器
      const targetUrl = `http://api1.123h.top:5000${url.pathname}${url.search}`;
      
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      
      log('请求完成', { status: response.status, url: targetUrl });
      
      return response;
      
    } catch (error) {
      log('请求失败', { error: error.message });
      return new Response(JSON.stringify({ error: 'Proxy error' }), { status: 500 });
    }
  }
};

function generateLogPage() {
  return `<!DOCTYPE html>
<html>
<head><title>日志查看器</title><meta charset="UTF-8"><style>
body{font-family:sans-serif;margin:20px;background:#f5f5f5}
.container{max-width:1200px;margin:auto;background:white;padding:20px;border-radius:10px}
.header{background:#4a6fa5;color:white;padding:20px;border-radius:8px;margin-bottom:20px}
.controls{margin-bottom:20px;display:flex;gap:10px}
select,button{padding:10px;border:1px solid #ddd;border-radius:5px}
button{background:#4a6fa5;color:white;border:none;cursor:pointer}
.logs{max-height:500px;overflow-y:auto}
.log-entry{padding:15px;margin-bottom:10px;background:#f8f9fa;border-left:4px solid #4a6fa5;border-radius:5px}
</style></head>
<body>
<div class="container">
<div class="header"><h1>📊 API 代理日志查看器</h1></div>
<div class="controls">
<select id="limit"><option value="50">50条</option><option value="100">100条</option></select>
<button onclick="loadLogs()">刷新</button>
<button onclick="clearLogs()">清空</button>
<label><input type="checkbox" id="autoRefresh" checked> 自动刷新(5秒)</label>
</div>
<div class="logs" id="logs">加载中...</div>
</div>
<script>
async function loadLogs(){
  const res=await fetch('/_logs/api');
  const data=await res.json();
  if(data.success){
    document.getElementById('logs').innerHTML=data.data.map(log=>
      \`<div class="log-entry">
        <strong>\${log.time}</strong><br>
        <strong>IP:</strong> \${log.ip}<br>
        <strong>消息:</strong> \${log.msg}<br>
        \${log.data?JSON.stringify(log.data):''}
      </div>\`
    ).join('');
  }
}
async function clearLogs(){
  await fetch('/_logs/clear',{method:'POST'});
  loadLogs();
}
let interval;
function setupAutoRefresh(){
  if(interval)clearInterval(interval);
  if(document.getElementById('autoRefresh').checked){
    interval=setInterval(loadLogs,5000);
  }
}
document.getElementById('autoRefresh').onchange=setupAutoRefresh;
loadLogs();
setupAutoRefresh();
</script>
</body>
</html>`;
}
