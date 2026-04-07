"use client";
import React, { useState, useEffect, useRef } from 'react';

const globalStyles = `
  :root {
      --bg-base: #06070a; --bg-panel: #0d1117; --bg-darker: #010409; --border-color: #30363d;
      --text-main: #c9d1d9; --text-muted: #8b949e;
      --accent-cyan: #00e5ff; --accent-blue: #2979ff; --accent-green: #00e676; --accent-red: #ff1744;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg-base); color: var(--text-main); font-family: system-ui, sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }

  /* Plan Animations */
  .plan-icon { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid currentColor; flex-shrink: 0; }
  .step-pending .plan-icon { opacity: 0.3; }
  .step-loading { color: var(--accent-cyan); text-shadow: 0 0 8px rgba(0,229,255,0.4);}
  .step-loading .plan-icon { border-color: var(--accent-cyan); border-top-color: transparent; animation: spin 1s linear infinite; box-shadow: 0 0 10px rgba(0,229,255,0.2);}
  .step-done { color: var(--accent-green); }
  .step-done .plan-icon { background: var(--accent-green); border-color: var(--accent-green); color: #000; box-shadow: 0 0 8px rgba(0,230,118,0.3);}
  .step-done .plan-icon::before { content: '✓'; font-size: 10px; font-weight: 900;}
  .step-error { color: var(--accent-red); text-shadow: 0 0 8px rgba(255,23,68,0.4);}
  .step-error .plan-icon { background: var(--accent-red); border-color: var(--accent-red); color: #fff;}
  .step-error .plan-icon::before { content: '!'; font-size: 10px; font-weight: 900;}
  @keyframes spin { 100% { transform: rotate(360deg); } }

  /* Cables Animation */
  .dynamic-cable { stroke-width: 3; fill: none; stroke-linejoin: round; }
  .cable-flow { stroke-dasharray: 8 8; animation: dataFlowAnim 0.4s linear infinite; }
  .cable-flow-reverse { stroke-dasharray: 8 8; animation: dataFlowReverseAnim 0.4s linear infinite; }
  @keyframes dataFlowAnim { to { stroke-dashoffset: -16; } }
  @keyframes dataFlowReverseAnim { to { stroke-dashoffset: 16; } }

  /* Robot Animations */
  @keyframes scanEye { 0% { transform: scaleX(1); } 100% { transform: scaleX(0.4); } }
  @keyframes typing { 0% { width: 20%; } 100% { width: 80%; } }
  @keyframes floatAlert { 0% { transform: translateY(0); } 100% { transform: translateY(-3px); } }
  @keyframes slideUp { from { transform: translateY(5px); opacity: 0; } to { transform: translateY(0); opacity: 0.8; } }
`;

const getTime = () => { const d = new Date(); return `[${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}]`; };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function NexusSwarmDashboard() {
    const [activeTab, setActiveTab] = useState('chat');
    const [messages, setMessages] = useState<any[]>([{ sender: 'Manager (Nexus-Core)', text: 'Routing sirkuit Manhattan aktif. Kabel disembunyikan di bawah meja. Siap menerima instruksi.', isUser: false }]);
    const [logs, setLogs] = useState<any[]>([{ time: getTime(), type: 'SUCC', source: 'SYS', text: 'Sirkuit Manhattan aktif. Node siap.' }]);
    const [terminalMsg, setTerminalMsg] = useState('> Kernel Idle... Waiting for I/O');
    const [isProcessing, setIsProcessing] = useState(false);
    const [plan, setPlan] = useState<any[]>([]);
    const [robots, setRobots] = useState<any>({});
    const [cables, setCables] = useState<any[]>([]);
    const [device, setDevice] = useState('mobile');
    const [inputVal, setInputVal] = useState('');
    const [iframeContent, setIframeContent] = useState("<html style='background:#0d1117; color:#00e5ff; display:flex; align-items:center; justify-content:center; font-family:monospace;'><body><p>> RENDER ENGINE READY</p></body></html>");

    const robotRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const logEndRef = useRef<HTMLDivElement>(null);
    const devWrapperRef = useRef<HTMLDivElement>(null);
    const previewContRef = useRef<HTMLDivElement>(null);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, plan]);
    useEffect(() => { logEndRef.current?.scrollIntoView(); }, [logs]);

    const updateScale = () => {
        if (!previewContRef.current || !devWrapperRef.current) return;
        let tW = 375, tH = 812; 
        if (device === 'tablet') { tW = 768; tH = 1024; }
        else if (device === 'desktop') { tW = 1280; tH = 720; } 
        let scale = Math.min((previewContRef.current.clientWidth * 0.85) / tW, (previewContRef.current.clientHeight * 0.85) / tH);
        if (scale > 1) scale = 1; 
        devWrapperRef.current.style.transform = `scale(${scale})`;
    };
    useEffect(() => { updateScale(); window.addEventListener('resize', updateScale); return () => window.removeEventListener('resize', updateScale); }, [device, activeTab]);

    const setRobotRefs = (id: string, el: HTMLDivElement | null) => { robotRefs.current[id] = el; };
    const addLog = (type: string, source: string, text: string) => setLogs(prev => [...prev, { time: getTime(), type, source, text }]);
    const updatePlan = (idx: number, status: string) => setPlan(prev => { const n = [...prev]; if(n[idx]) n[idx].status = status; return n; });

    const calculateOrthogonalPath = (fromId: string, toId: string) => {
        const fromEl = robotRefs.current[fromId];
        const toEl = robotRefs.current[toId];
        const container = containerRef.current;
        if (!fromEl || !toEl || !container) return "";
        const r1 = fromEl.getBoundingClientRect();
        const r2 = toEl.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        const x1 = (r1.left + r1.width / 2) - cRect.left;
        const y1 = r1.bottom - cRect.top - 5; 
        const x2 = (r2.left + r2.width / 2) - cRect.left;
        const y2 = r2.bottom - cRect.top - 5;
        const isSameRow = Math.abs(y1 - y2) < 20;
        if (isSameRow) {
            const dropY = Math.max(y1, y2) + 25; 
            return `M ${x1} ${y1} L ${x1} ${dropY} L ${x2} ${dropY} L ${x2} ${y2}`;
        } else {
            const midY = y1 + (y2 - y1) / 2; 
            return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
        }
    };

    const fireDataCable = async (fromId: string, toId: string, alertType: string, duration: number) => {
        const pathData = calculateOrthogonalPath(fromId, toId);
        if(!pathData) return;
        let strokeColor = '#00e5ff'; let animClass = 'cable-flow';
        if(alertType === 'error') { strokeColor = '#ff1744'; animClass = 'cable-flow-reverse'; } 
        else if(alertType === 'success') { strokeColor = '#00e676'; }
        const newCable = { id: Date.now() + Math.random(), d: pathData, color: strokeColor, animClass };
        setCables(prev => [...prev, newCable]);
        setRobots(prev => ({...prev, [toId]: { active: true, alert: alertType }}));
        await sleep(duration);
        setCables(prev => prev.filter(c => c.id !== newCable.id));
    };

    const handleCommand = async () => {
        if (!inputVal.trim() || isProcessing) return;
        setIsProcessing(true);
        setMessages(prev => [...prev, { text: inputVal, isUser: true }]);
        setInputVal('');
        if (window.innerWidth <= 1024) setActiveTab('office');

        const initialPlan = [
            { label: '[UI] Generate Layout & Assets', status: 'pending' },
            { label: '[Front] Build Responsive HTML/CSS', status: 'pending' },
            { label: '[Back] Create Logic & DB Simulation', status: 'pending' },
            { label: '[QA] Security Loop Injection Test', status: 'pending' },
            { label: '[DevOps] Containerize & Deploy', status: 'pending' }
        ];
        setPlan(initialPlan);
        setTerminalMsg('> Parsing Instructions... Pipeline Start.');
        await sleep(1000);

        // 1. UI
        updatePlan(0, 'loading'); setRobots({ ui: { active: true } }); setTerminalMsg('> UI: Designing structure...');
        addLog('INFO', 'NODE-UI', 'Mendesain layout dasar.');
        await sleep(1500);
        updatePlan(0, 'done'); setTerminalMsg('> Pipeline: UI -> Frontend');
        await fireDataCable('ui', 'front', 'normal', 1000); setRobots({ ui: { active: false } });

        // 2. Frontend
        updatePlan(1, 'loading'); setRobots({ front: { active: true } }); setTerminalMsg('> Frontend: Applying Flexbox...');
        addLog('INFO', 'NODE-FR', 'Menerapkan gaya responsif penuh.');
        await sleep(1500);
        updatePlan(1, 'done'); setTerminalMsg('> Pipeline: Frontend -> Backend');
        await fireDataCable('front', 'back', 'normal', 1000); setRobots({ front: { active: false } });

        // 3. Backend
        updatePlan(2, 'loading'); setRobots({ back: { active: true } }); setTerminalMsg('> Backend: Writing Handlers...');
        addLog('INFO', 'NODE-BK', 'Membuat modul Autentikasi.');
        await sleep(1500); updatePlan(2, 'done');

        // 4. QA Loop
        updatePlan(3, 'loading'); setTerminalMsg('> Testing: Backend -> QA');
        await fireDataCable('back', 'qa', 'normal', 800); 
        setRobots({ back: { active: false }, qa: { active: true, alert: 'error' } }); updatePlan(3, 'error');
        setTerminalMsg('> QA: Security Flaw (XSS Detected)!'); addLog('ERR', 'NODE-QA', 'Celah keamanan script ditemukan.');
        await sleep(1000);
        setTerminalMsg('> Reject: QA -> Backend');
        await fireDataCable('qa', 'back', 'error', 800); 
        setRobots({ qa: { active: false }, back: { active: true, alert: 'error' } }); updatePlan(3, 'loading');
        setTerminalMsg('> Backend: Patching with Regex/Escape...'); addLog('WARN', 'NODE-BK', 'Memperbaiki kode input HTML Entities.');
        await sleep(1500);
        setRobots({ back: { active: true } }); setTerminalMsg('> Re-Test: Backend -> QA');
        await fireDataCable('back', 'qa', 'success', 800); 
        setRobots({ back: { active: false }, qa: { active: true, alert: 'success' } }); updatePlan(3, 'done');
        setTerminalMsg('> QA: Approved. Fully Secure.'); addLog('SUCC', 'NODE-QA', 'Validasi berhasil. Sistem 100% aman.');
        await sleep(1000);

        // 5. DevOps
        setTerminalMsg('> Pipeline: QA -> DevOps');
        await fireDataCable('qa', 'dev', 'normal', 1000); setRobots({ qa: { active: false } });
        updatePlan(4, 'loading'); setRobots({ dev: { active: true } }); setTerminalMsg('> DevOps: Deploying...');
        addLog('INFO', 'NODE-DV', 'Mengeksekusi build final ke Vercel Preview.');
        await sleep(1500); setRobots({ dev: { active: false } }); updatePlan(4, 'done');

        setTerminalMsg('> System Idle. Pipeline completed.');
        setMessages(prev => [...prev, { sender: 'Manager (Nexus)', text: `<b>Pipeline Selesai!</b><br>Render tersedia di panel Result.`, isUser: false }]);
        setIframeContent(`<!DOCTYPE html><html lang="id"><head><meta charset="viewport" content="width=device-width, initial-scale=1.0"><style>:root { --pr: #00e5ff; --bg: #0d1117; --txt: #c9d1d9; --card: #161b22; } * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, sans-serif; } body { background: var(--bg); color: var(--txt); } nav { display: flex; justify-content: space-between; padding: 1.5rem 5%; background: var(--card); border-bottom: 1px solid #30363d; align-items:center;} .logo { font-size: 1.2rem; font-weight: bold; color: var(--pr); display: flex; gap: 10px; align-items: center;} .hero { text-align: center; padding: 4rem 1rem; } .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; color: #fff;} .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; padding: 2rem 5%; } .card { background: var(--card); padding: 2rem; border-radius: 12px; border: 1px solid #30363d; text-align: left; } .card h3 { color: #fff; margin-bottom: 10px;} .badge { display: inline-block; padding: 4px 8px; background: rgba(0, 230, 118, 0.15); color: #00e676; border: 1px solid rgba(0, 230, 118, 0.4); border-radius: 12px; font-size: 0.8rem; margin-bottom: 1rem;} .input { width: 100%; padding: 0.8rem; margin: 0.5rem 0 1rem; background: #010409; border: 1px solid #30363d; color: #fff; border-radius: 6px; outline: none;} .btn { width: 100%; background: var(--pr); color: #000; padding: 0.8rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;}</style></head><body><nav><div class="logo">NEXUS APP</div><div style="font-size:0.9rem; color:#00e676;">Status: Connected</div></nav><div class="hero"><h1>E-Commerce Landing Page</h1><p style="color:#8b949e; max-width: 600px; margin: auto;">Tampilan Flexbox sejajar berhasil diterapkan oleh Frontend.</p></div><div class="grid"><div class="card"><div class="badge">QA Sec-Approved</div><h3>Form Test</h3><p style="font-size:0.9rem; color:#8b949e; margin-bottom: 1rem;">Diuji oleh QA Node. Coba eksekusi script ini.</p><input type="text" class="input" value="&lt;script&gt;alert('hack')&lt;/script&gt;"><button class="btn" onclick="alert('Input aman! Component React melakukan escape.')">Kirim Data</button></div><div class="card" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;"><h1 style="font-size:3rem; color: #00e676;">OK</h1><p style="color:#8b949e;">Lolos Rendering Vercel</p></div></div></body></html>`);
        if (window.innerWidth <= 1024) setActiveTab('preview');
        setIsProcessing(false);
    };

    const renderRobot = (id: string, label: string) => {
        const state = robots[id] || { active: false, alert: null };
        const isActive = state.active; const isErr = state.alert === 'error'; const isSucc = state.alert === 'success';
        return (
            <div id={`bot-${id}`} ref={el => setRobotRefs(id, el)} className={`w-[75px] h-[95px] relative flex flex-col items-center justify-end opacity-60 transition-all duration-300 grayscale-[40%] flex-shrink-0 ${isActive ? 'opacity-100 grayscale-0 -translate-y-1' : ''} ${isErr ? 'opacity-100 grayscale-0 animate-[floatAlert_0.5s_infinite_alternate]' : ''}`}>
                <div className={`text-[0.55rem] font-mono px-2 py-0.5 rounded-xl absolute -top-3 z-20 transition-colors font-bold whitespace-nowrap ${isActive ? (isErr ? 'bg-red-500/10 text-red-500 border border-red-500 shadow-[0_0_8px_#ff1744]' : isSucc ? 'bg-green-500/10 text-green-500 border border-green-500 shadow-[0_0_8px_#00e676]' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-400 shadow-[0_0_8px_#00e5ff]') : 'bg-[#010409] text-gray-400 border border-[#30363d]'}`}>{label}</div>
                <div className={`w-[22px] h-[18px] bg-[#0f172a] border border-[#334155] rounded absolute bottom-[45px] z-[6] flex justify-center items-center transition-all ${isActive ? '-translate-y-0.5 border-cyan-400' : ''} ${isErr ? 'border-red-500' : ''}`}><div className={`w-[12px] h-[4px] rounded-[2px] transition-all opacity-50 ${isActive ? (isErr ? 'bg-red-500 shadow-[0_0_6px_#ff1744] opacity-100 animate-[blink_0.1s_infinite]' : isSucc ? 'bg-green-500 shadow-[0_0_6px_#00e676] opacity-100' : 'bg-cyan-400 shadow-[0_0_6px_#00e5ff] opacity-100 animate-[scanEye_2s_infinite_alternate]') : 'bg-blue-500'}`}></div></div>
                <div className="w-[28px] h-[35px] bg-[#1e293b] rounded-t-lg absolute bottom-2 z-[5] border border-[#334155]"></div>
                <div className={`w-[44px] h-[30px] bg-[#0a0a0a] border-2 border-[#333] rounded absolute bottom-[18px] z-[11] flex justify-center items-center overflow-hidden shadow-[0_5px_10px_rgba(0,0,0,0.6)] transition-colors ${isActive ? (isErr ? 'border-red-500' : 'border-cyan-400') : ''}`}><div className={`w-full h-full relative ${isActive ? (isErr ? 'bg-red-500/20' : 'bg-cyan-400/15') : 'bg-black'}`}>{isActive && !isErr && <div className="absolute top-[2px] left-[2px] h-[2px] bg-cyan-400 animate-[typing_1s_infinite_alternate] shadow-[0_4px_0_#00e5ff,0_8px_0_#00e5ff]"></div>}{isErr && <div className="absolute top-[2px] left-[2px] text-red-500 font-mono text-[8px] animate-[blink_0.2s_infinite]">ERR</div>}</div></div>
                <div className="w-[70px] h-[20px] bg-gradient-to-b from-[#475569] to-[#1e293b] rounded absolute bottom-0 z-[10] border-t-2 border-[#94a3b8] border-b-4 border-[#0f172a] flex justify-center shadow-[0_10px_10px_rgba(0,0,0,0.5)]"><div className={`w-[30px] h-[4px] bg-[#111] rounded-[1px] mt-1 border-b border-[#333] ${isActive ? 'bg-cyan-400 shadow-[0_0_5px_#00e5ff]' : ''}`}></div></div>
            </div>
        );
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
            <div className="lg:hidden bg-[#0d1117] border-b border-[#30363d] relative z-[100] flex w-full">
                {['chat', 'office', 'preview'].map((t, i) => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 px-1 text-xs font-bold uppercase transition-all ${activeTab === t ? 'text-[#00e5ff]' : 'text-[#8b949e]'}`}>{t}</button>
                ))}
                <div className="absolute bottom-0 h-[3px] bg-[#00e5ff] transition-transform duration-300" style={{ width: '33.33%', transform: `translateX(${['chat', 'office', 'preview'].indexOf(activeTab) * 100}%)` }} />
            </div>
            
            <div className="flex flex-col lg:flex-row h-[calc(100vh-45px)] lg:h-screen w-full relative bg-black">
                {/* CHAT PANEL */}
                <div className={`absolute lg:relative top-0 left-0 w-full h-full lg:w-[28%] bg-[#0d1117] flex flex-col border-r border-[#30363d] transition-all duration-300 z-10 ${activeTab === 'chat' ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-4 pointer-events-none lg:opacity-100 lg:translate-x-0 lg:pointer-events-auto'}`}>
                    <div className="p-3 border-b border-[#30363d] bg-gradient-to-r from-[#0d1117] to-[#010409] flex justify-between items-center text-xs font-semibold uppercase shrink-0"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_10px_#00e5ff]"/> Commander</div></div>
                    <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                        {messages.map((m, i) => (<div key={i} className={`max-w-[90%] p-3 rounded-lg text-[0.85rem] ${m.isUser ? 'self-end bg-[#2979ff] text-white rounded-br-none' : 'self-start bg-[#010409] border border-[#30363d] rounded-bl-none'}`}>{!m.isUser && <div className="text-[0.7rem] text-[#00e5ff] mb-1 font-bold uppercase">{m.sender}</div>}<div dangerouslySetInnerHTML={{ __html: m.text }} /></div>))}
                        {plan.length > 0 && (<div className="bg-black/30 border border-[#30363d] rounded-md p-3 mt-2"><div className="text-[0.75rem] text-[#8b949e] uppercase mb-2 font-bold">Execution Tracker</div>{plan.map((p, i) => (<div key={i} className={`flex items-center gap-2 mb-2 font-mono text-[0.75rem] ${p.status === 'loading' ? 'step-loading' : p.status === 'done' ? 'step-done' : p.status === 'error' ? 'step-error' : 'step-pending text-[#64748b]'}`}><div className="plan-icon"></div> {p.label}</div>))}</div>)}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="p-3 border-t border-[#30363d] flex gap-2 shrink-0 bg-[#010409]">
                        <input type="text" value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key==='Enter' && handleCommand()} placeholder="Instruksi..." className="flex-1 bg-[#0d1117] border border-[#30363d] text-white p-2 rounded outline-none focus:border-[#00e5ff]" disabled={isProcessing} />
                        <button onClick={handleCommand} disabled={isProcessing} className="bg-[#2979ff] text-white px-4 rounded font-bold hover:bg-[#1c54b2]">Kirim</button>
                    </div>
                </div>

                {/* OFFICE PANEL */}
                <div className={`absolute lg:relative top-0 left-0 w-full h-full lg:w-[42%] bg-[#0d1117] flex flex-col border-r border-[#30363d] transition-all duration-300 z-10 ${activeTab === 'office' ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-4 pointer-events-none lg:opacity-100 lg:translate-x-0 lg:pointer-events-auto'}`}>
                    <div className="flex-1 border-b border-[#30363d] relative flex flex-col overflow-hidden bg-gradient-to-b from-[#0a0c10] to-[#111827]">
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[85%] h-[55px] bg-black/80 border border-[#30363d] rounded p-2 font-mono text-[0.75rem] text-[#00e676] flex flex-col justify-end z-[30]"><div className="animate-[slideUp_0.2s_ease-out] whitespace-nowrap opacity-80">{terminalMsg}</div></div>
                        <svg className="absolute top-0 left-0 w-full h-full z-[5] pointer-events-none overflow-visible">{cables.map(c => (<path key={c.id} d={c.d} stroke={c.color} className={`dynamic-cable ${c.animClass}`} style={{ filter: `drop-shadow(0 0 6px ${c.color})` }} />))}</svg>
                        <div ref={containerRef} className="absolute top-0 left-0 w-full h-full pt-[80px] pb-5 px-[10px] flex items-center justify-center z-[10]"><div className="flex flex-wrap justify-center gap-[30px] w-full max-w-[500px]">{renderRobot('ui','UI/UX')}{renderRobot('front','Frontend')}{renderRobot('back','Backend')}{renderRobot('qa','QA/Sec')}{renderRobot('dev','DevOps')}</div></div>
                    </div>
                    <div className="h-[35%] bg-[#010409] p-4 overflow-y-auto font-mono text-[0.75rem]">{logs.map((l, i) => (<div key={i} className="flex gap-2 mb-1.5 border-b border-white/5 pb-1"><span className="text-[#8b949e] shrink-0">{l.time}</span><span className={`shrink-0 font-bold ${l.type==='SUCC'?'text-[#00e676]':l.type==='ERR'?'text-[#ff1744]':'text-[#00e5ff]'}`}>{l.source}:</span><span className="text-[#c9d1d9]">{l.text}</span></div>))}<div ref={logEndRef} /></div>
                </div>

                {/* PREVIEW PANEL */}
                <div className={`absolute lg:relative top-0 left-0 w-full h-full lg:w-[30%] bg-black flex flex-col transition-all duration-300 z-10 ${activeTab === 'preview' ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-4 pointer-events-none lg:opacity-100 lg:translate-x-0 lg:pointer-events-auto'}`}>
                    <div className="w-full p-3 flex justify-center gap-2 bg-[#0d1117] border-b border-[#30363d] z-20 shrink-0">{['mobile', 'tablet', 'desktop'].map(d => (<button key={d} onClick={() => setDevice(d)} className={`px-4 py-1.5 rounded-full text-xs ${device === d ? 'bg-[#00e5ff] text-black font-bold shadow-[0_0_10px_#00e5ff]' : 'bg-[#21262d] border border-[#30363d] text-[#8b949e]'}`}>{d}</button>))}</div>
                    <div ref={previewContRef} className="flex-1 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle,#161b22_0%,#010409_100%)]">
                        <div ref={devWrapperRef} className="relative flex flex-col items-center origin-center transition-all duration-500">
                            <div className={`bg-white relative overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-all duration-500 ${device === 'mobile' ? 'w-[375px] h-[812px] rounded-[40px] border-[14px] border-[#010409]' : device === 'tablet' ? 'w-[768px] h-[1024px] rounded-[30px] border-[20px] border-[#010409]' : 'w-[1280px] h-[720px] rounded-t-xl border-[16px] border-b-[25px] border-[#010409]'}`}><iframe srcDoc={iframeContent} className="w-full h-full border-none bg-[#f8fafc]" /></div>
                            <div className={`w-[120%] h-[30px] bg-gradient-to-b from-[#8b949e] to-[#484f58] rounded-b-[15px] absolute bottom-[-30px] flex justify-center items-center transition-opacity duration-500 ${device === 'desktop' ? 'opacity-100' : 'opacity-0'}`} style={{ transform: 'perspective(300px) rotateX(40deg)', transformOrigin: 'top' }}><div className="w-[30%] h-[5px] bg-[#30363d] rounded-[5px] -mt-[15px]"></div></div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
