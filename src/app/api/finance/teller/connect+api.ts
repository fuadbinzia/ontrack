import {
  loadTellerSession,
  tellerEnvironment,
  TellerServerError,
} from '@/services/finance/teller-server';

function escapeHtmlJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session')?.trim();
  if (!sessionId) return new Response('Missing Teller session.', { status: 400 });
  try {
    const session = await loadTellerSession(sessionId);
    const config = {
      applicationId: process.env.TELLER_APPLICATION_ID?.trim(),
      environment: session.environment || tellerEnvironment(),
      nonce: session.nonce,
      products: ['transactions', 'balance'],
      selectAccount: 'multiple',
    };
    if (!config.applicationId) {
      throw new TellerServerError('Teller is not configured.', 'NOT_CONFIGURED', 503);
    }
    const completeUrl = `${new URL(request.url).origin}/api/finance/teller/complete`;
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect your bank to onTrack</title>
<style>html,body{height:100%;margin:0;background:#f2f0eb;color:#171713;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{display:grid;place-items:center}.card{max-width:28rem;padding:2rem;text-align:center}.mark{font-size:2rem}.muted{color:#68675f}button{min-height:3rem;border:0;border-radius:1.5rem;padding:0 1.5rem;background:#171713;color:white;font-size:1rem}button:disabled{opacity:.55}</style>
</head><body><main class="card"><div class="mark">✦</div><h1>Connect your bank</h1><p class="muted" id="status">Preparing Teller’s secure connection…</p><button id="open" disabled>Continue</button></main>
<script src="https://cdn.teller.io/connect/connect.js"></script><script>
(function(){
  const config=${escapeHtmlJson(config)};
  const sessionId=${escapeHtmlJson(sessionId)};
  const completeUrl=${escapeHtmlJson(completeUrl)};
  const status=document.getElementById('status');
  const button=document.getElementById('open');
  let settled=false;
  let completing=false;
  const finish=(state)=>{ if(settled)return; settled=true; window.location.href='ontrack://teller/complete?status='+encodeURIComponent(state); };
  const connect=TellerConnect.setup(Object.assign({},config,{
    onInit:function(){ status.textContent='Choose the accounts you want to share.'; button.disabled=false; connect.open(); },
    onSuccess:async function(result){
      if(settled)return;
      completing=true;
      status.textContent='Securing your connection…'; button.disabled=true;
      try {
        const response=await fetch(completeUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          session_id:sessionId,
          access_token:result.accessToken,
          teller_user_id:result.user && result.user.id,
          enrollment_id:result.enrollment && result.enrollment.id,
          institution_name:result.enrollment && result.enrollment.institution && result.enrollment.institution.name,
          signatures:result.signatures || []
        })});
        if(!response.ok) throw new Error('Teller enrollment could not be verified.');
        finish('success');
      } catch(error){ status.textContent=error.message || 'Connection failed.'; button.disabled=false; }
    },
    onExit:function(){ if(!completing)finish('cancelled'); }
  }));
  button.addEventListener('click',function(){ connect.open(); });
})();
</script></body></html>`;
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline' https://cdn.teller.io https://teller.io https://*.teller.io; style-src 'unsafe-inline'; connect-src 'self' https://teller.io https://*.teller.io; frame-src https://teller.io https://*.teller.io; img-src data: https://teller.io https://*.teller.io",
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    const status = error instanceof TellerServerError ? error.status : 503;
    return new Response(error instanceof Error ? error.message : 'Teller session unavailable.', {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
