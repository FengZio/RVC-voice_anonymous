import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import styles from './WebRTCCall.module.css';
function createWavHeader(e,t){var n=new ArrayBuffer(44),r=new DataView(n);return writeWStr(r,0,'RIFF'),r.setUint32(4,36+2*t,!0),writeWStr(r,8,'WAVE'),writeWStr(r,12,'fmt '),r.setUint32(16,16,!0),r.setUint16(20,1,!0),r.setUint16(22,1,!0),r.setUint32(24,e,!0),r.setUint32(28,2*e,!0),r.setUint16(32,2,!0),r.setUint16(34,16,!0),writeWStr(r,36,'data'),r.setUint32(40,2*t,!0),n}function writeWStr(e,t,n){for(var r=0;r<n.length;r++)e.setUint8(t+r,n.charCodeAt(r))}function floatTo16BitPcm(e){var t=new Int16Array(e.length);for(var n=0;n<e.length;n++){var r=Math.max(-1,Math.min(1,e[n]));t[n]=r<0?32768*r:32767*r}return t}function int16ToFloatPcm(e){var t=new Float32Array(e.length);for(var n=0;n<e.length;n++)t[n]=e[n]/(e[n]<0?32768:32767);return t}

const ICE_SERVERS = [
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
];

function getInitialStatus(autoConnect, initiateCall, rvcModel, role) {
  if (autoConnect && initiateCall) return 'calling';
  if (autoConnect) return 'idle';
  if (role === 'patient') return 'calling';
  return 'ringing';
}

export const WebRTCCall = forwardRef(function WebRTCCall({ chatId, token, role, peerName, onEnd, onLocalStream, incomingOffer, autoConnect, initiateCall, rvcModel }, ref) {
  const [status, setStatus] = useState(() => getInitialStatus(autoConnect, initiateCall, rvcModel, role));
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const mountedRef = useRef(true);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const timerRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const statusRef = useRef(status);
  const rvcEnabledRef = useRef(!!rvcModel);
  const rawStreamRef = useRef(null);
  const rvcCtxRef = useRef(null);
  const rvcDestRef = useRef(null);
  const rvcWsRef = useRef(null);
  const rvcProcRef = useRef(null);
  const rvcChunkIdxRef = useRef(0);
  const initiatingRef = useRef(false);
  const [rvcEnabled, setRvcEnabled] = useState(!!rvcModel);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { rvcEnabledRef.current = rvcEnabled; }, [rvcEnabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (rvcWsRef.current) { rvcWsRef.current.onclose = null; try { rvcWsRef.current.close(); } catch (_) {} rvcWsRef.current = null; }
    if (rvcProcRef.current) { try { rvcProcRef.current.disconnect(); } catch (_) {} rvcProcRef.current = null; }
    if (rvcCtxRef.current) { try { rvcCtxRef.current.close(); } catch (_) {} rvcCtxRef.current = null; }
    if (rawStreamRef.current) { try { rawStreamRef.current.getTracks().forEach(function(t) { t.stop(); }); } catch (_) {} rawStreamRef.current = null; }
  }, []);

  const getMic = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    var localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (!mountedRef.current) return null;
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('未检测到麦克风设备，无法发起通话');
      } else if (err.name === 'NotAllowedError') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许');
      } else {
        setError('获取麦克风失败：' + err.message);
      }
      return null;
    }
    if (!mountedRef.current) { localStream.getTracks().forEach(function(t) { t.stop(); }); return null; }
    if (onLocalStream) { try { localStream = await onLocalStream(localStream); } catch (_) {} }
    rawStreamRef.current = localStream;
    if (rvcModel) {
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        var rvcCtx = new AudioCtx({ sampleRate: 16000 });
        rvcCtxRef.current = rvcCtx;
        await rvcCtx.resume();
        console.log('[RVC] AudioContext state after resume:', rvcCtx.state);
        if (rvcCtx.state !== 'running') {
          console.warn('[RVC] AudioContext not running, will retry on user gesture');
          rvcCtx.onstatechange = function() {
            console.log('[RVC] AudioContext state changed to:', rvcCtx.state);
          };
        }
        var rvcDest = rvcCtx.createMediaStreamDestination();
        rvcDestRef.current = rvcDest;
        var rvcSource = rvcCtx.createMediaStreamSource(localStream);
        var rvcProcessor = rvcCtx.createScriptProcessor(4096, 1, 1);
        rvcProcRef.current = rvcProcessor;
        rvcSource.connect(rvcProcessor);
        // Must connect processor to destination, otherwise Web Audio API optimizes it away
        // and onaudioprocess never fires. Use a GainNode at 0 to mute raw passthrough.
        var muteGain = rvcCtx.createGain();
        muteGain.gain.value = 0;
        rvcProcessor.connect(muteGain);
        muteGain.connect(rvcDest);
        // Set onaudioprocess immediately - do NOT wait for WebSocket onopen
        rvcProcessor.onaudioprocess = function(event) {
          if (!mountedRef.current) return;
          if (!rvcEnabledRef.current) return;
          var ws = rvcWsRef.current;
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.log('[RVC] onaudioprocess skip, ws:', ws ? 'readyState=' + ws.readyState : 'null');
            return;
          }
          var floatData = event.inputBuffer.getChannelData(0);
          var hasSignal = false;
          for (var i = 0; i < floatData.length; i++) { if (Math.abs(floatData[i]) > 0.005) { hasSignal = true; break; } }
          if (!hasSignal) return;
          var int16Data = floatTo16BitPcm(floatData);
          var header = createWavHeader(rvcCtx.sampleRate, int16Data.length);
          var wav = new Uint8Array(header.byteLength + int16Data.byteLength);
          wav.set(new Uint8Array(header), 0);
          wav.set(new Uint8Array(int16Data.buffer), header.byteLength);
          var binary = '';
          for (var j = 0; j < wav.length; j++) { binary += String.fromCharCode(wav[j]); }
          var chunkIdx = rvcChunkIdxRef.current++;
          ws.send(JSON.stringify({ type: 'chunk', index: chunkIdx, data: btoa(binary) }));
          if (chunkIdx % 20 === 0) console.log('[RVC] Sent chunk #' + chunkIdx + ', size=' + wav.length + ' bytes');
        };
        var sid = chatId + '-' + role;
        var wsUrl = 'ws://127.0.0.1:7860/api/rvc/stream/' + sid + '?model=' + encodeURIComponent(rvcModel) + '&transpose=0&f0_method=rmvpe';
        var rvcWs = new WebSocket(wsUrl);
        rvcWsRef.current = rvcWs;
        console.log('[RVC] WebSocket created, url:', wsUrl);
        rvcWs.onopen = function() { console.log('[RVC] WebSocket OPEN'); };
        rvcWs.onmessage = function(event) {
          if (!mountedRef.current) return;
          if (!rvcEnabledRef.current) return;
          try {
            var msg = JSON.parse(event.data);
            if (msg.type === 'ready') { console.log('[RVC] Backend ready ack received'); return; }
            if (msg.type !== 'chunk' || msg.status !== 'ok' || !msg.data) {
              if (msg.type === 'error') console.error('[RVC] Backend error:', msg.message);
              return;
            }
            if (msg.index % 20 === 0) console.log('[RVC] Received chunk #' + msg.index);
            var binary = atob(msg.data);
            var bytes = new Uint8Array(binary.length);
            for (var j = 0; j < binary.length; j++) { bytes[j] = binary.charCodeAt(j); }
            var pcmLen = (bytes.length - 44) / 2;
            if (pcmLen <= 0) return;
            var int16 = new Int16Array(pcmLen);
            var view = new DataView(bytes.buffer.slice(44));
            for (var j = 0; j < pcmLen; j++) { int16[j] = view.getInt16(j * 2, true); }
            var floatOut = int16ToFloatPcm(int16);
            var buf = rvcCtxRef.current.createBuffer(1, floatOut.length, 16000);
            buf.getChannelData(0).set(floatOut);
            var bufSrc = rvcCtxRef.current.createBufferSource();
            bufSrc.buffer = buf;
            bufSrc.connect(rvcDestRef.current);
            bufSrc.start();
          } catch (_) {}
        };
        rvcWs.onerror = function() {
          if (!mountedRef.current) return;
          setError('RVC 匿名化服务暂不可用，已切换为原声');
          if (rvcEnabledRef.current) toggleRvc();
        };
        rvcWs.onclose = function() {
          if (!mountedRef.current) return;
          if (rvcEnabledRef.current && statusRef.current !== 'ended' && statusRef.current !== 'idle') {
            setError('RVC 连接断开，已恢复原声');
            toggleRvc();
          }
        };
        if (rvcEnabled) {
          localStreamRef.current = rvcDest.stream;
          rvcDest.stream.getAudioTracks().forEach(function(track) {
            if (pcRef.current) pcRef.current.addTrack(track, rvcDest.stream);
          });
          return rvcDest.stream;
        }
        localStreamRef.current = localStream;
        localStream.getTracks().forEach(function(track) {
          if (pcRef.current) pcRef.current.addTrack(track, localStream);
        });
        return localStream;
      } catch (_) {}
    }
    localStreamRef.current = localStream;
    localStream.getTracks().forEach(function(track) {
      if (pcRef.current) pcRef.current.addTrack(track, localStream);
    });
    return localStream;
  }, [onLocalStream, rvcModel, chatId, role, rvcEnabled]);
  const hangup = useCallback(() => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'hangup' }));
      }
    } catch (_) {}
    cleanup();
    if (mountedRef.current) setStatus('ended');
    onEnd?.();
  }, [onEnd, cleanup]);

  const sendOffer = useCallback(async () => {
    const pc = pcRef.current;
    const ws = wsRef.current;
    if (!pc || !ws) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));
  }, []);

  const acceptCall = useCallback(async () => {
    const pc = pcRef.current;
    const ws = wsRef.current;
    const offer = pendingOfferRef.current;
    if (!pc || !ws || !offer) return;
    pendingOfferRef.current = null;
    const stream = await getMic();
    if (!stream) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription }));
    } catch (_) {}
  }, [getMic]);

  const triggerCall = useCallback(async () => {
    if (statusRef.current !== 'idle') return;
    setStatus('calling');
    const stream = await getMic();
    if (!stream) return;
    await sendOffer();
  }, [getMic, sendOffer]);

  useImperativeHandle(ref, () => ({ triggerCall }), [triggerCall]);
  const toggleRvc = useCallback(() => { const next = !rvcEnabled; setRvcEnabled(next); rvcEnabledRef.current = next; const senders = pcRef.current && pcRef.current.getSenders ? pcRef.current.getSenders() : []; const audioSender = senders.find(function(s) { return s.track && s.track.kind === 'audio'; }); if (audioSender) { var newTrack = next ? (rvcDestRef.current && rvcDestRef.current.stream && rvcDestRef.current.stream.getAudioTracks()[0]) : (rawStreamRef.current && rawStreamRef.current.getAudioTracks()[0]); if (newTrack) { audioSender.replaceTrack(newTrack).catch(function(){}); } } }, [rvcEnabled]);

  useEffect(() => {
    if (!chatId || !token || !role) return;
    if (statusRef.current === 'ended') return;

    const wsUrl = 'ws://127.0.0.1:7860/api/webrtc/signal/' + chatId + '?token=' + encodeURIComponent(token) + '&role=' + role;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    if (incomingOffer && role === 'doctor') {
      pendingOfferRef.current = { sdp: incomingOffer };
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ice', candidate: event.candidate }));
      }
    };

    pc.ontrack = (event) => {
      if (!mountedRef.current) return;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
      if (mountedRef.current) {
        setStatus('connected');
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          if (!mountedRef.current) return;
          setElapsed(prev => prev + 1);
        }, 1000);
      }
    };

    ws.onopen = async () => {
      if (!mountedRef.current) return;
      const s = statusRef.current;
      if (s === 'idle') return;
      if (s === 'calling') {
        if (initiatingRef.current) {
          // Already handled by triggerCall
          initiatingRef.current = false;
          return;
        }
        // Legacy: calling mode from mount (initiateCall prop)
        const stream = await getMic();
        if (!stream) return;
        await sendOffer();
      }
    };

    ws.onmessage = async (event) => {
      if (!mountedRef.current) return;
      let data;
      try { data = JSON.parse(event.data); } catch (_) { return; }

      if (data.type === 'hangup') { hangup(); return; }

      if (data.type === 'error') {
        setError(data.message || '连接错误');
        setTimeout(() => hangup(), 2000);
        return;
      }

      if (data.type === 'offer') {
        pendingOfferRef.current = data;
        if (statusRef.current === 'idle') {
          setStatus('ringing');
        }
        return;
      }

      if (data.type === 'answer') {
        try { await pc.setRemoteDescription(new RTCSessionDescription(data.sdp)); } catch (_) {}
        return;
      }

      if (data.type === 'ice') {
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (_) {}
      }
    };

    ws.onerror = () => {
      if (mountedRef.current) setError('信令连接失败');
    };

    ws.onclose = () => {
      if (mountedRef.current && statusRef.current !== 'ended') {
        if (statusRef.current !== 'idle') {
          hangup();
        } else {
          cleanup();
        }
      }
    };

    return () => { cleanup(); };
  }, [chatId, token, role, incomingOffer]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const statusLabel = { calling: '呼叫中…', ringing: '来电…', connected: '通话中', ended: '通话结束', idle: '' }[status] || '';
  const isActive = status === 'calling' || status === 'ringing' || status === 'connected';

  if (status === 'idle') return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        {error ? (
          <div className={styles.errorBox}>
            <MicOff size={32} />
            <p>{error}</p>
            <button className={styles.closeBtn} onClick={onEnd}>关闭</button>
          </div>
        ) : (
          <>
            <div className={styles.statusRow}>
              <span className={`${styles.dot} ${isActive ? styles.dotPulse : ''}`} />
              <span className={styles.statusText}>{statusLabel}</span>
            </div>
            <div className={styles.avatarRing}>
              <div className={styles.avatarInner}>{peerName ? peerName.charAt(0) : '?'}</div>
            </div>
            <h3 className={styles.peerName}>{peerName}</h3>
            <div className={styles.timer}>{mm}:{ss}</div>
            {status === 'ringing' && (
              <div className={styles.actionRow}>
                <button className={styles.acceptBtn} onClick={acceptCall}><Phone size={16} /> 接听</button>
                <button className={styles.rejectBtn} onClick={hangup}><PhoneOff size={16} /> 拒绝</button>
              </div>
            )}
            <audio ref={remoteAudioRef} autoPlay playsInline />
            {rvcModel && React.createElement('button', { onClick: toggleRvc, className: styles.rvcToggle, type: 'button' }, rvcEnabled ? '变声 ON' : '变声 OFF')}
            <button className={styles.hangupBtn} onClick={hangup} title="挂断"><PhoneOff size={24} /></button>
          </>
        )}
      </div>
    </div>
  );
});
