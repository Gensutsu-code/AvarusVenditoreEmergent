import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

// Mini truck runner game
const TruckGame = ({ isDark }) => {
  const canvasRef = useRef(null);
  const gameRef = useRef({
    truck: { y: 0, vy: 0, jumping: false },
    obstacles: [],
    score: 0,
    speed: 3.5,
    running: false,
    frame: 0,
    roadY: 230,       // top edge of road
    gameOver: false,
  });
  const animRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('truckHS') || '0'));

  const startGame = useCallback(() => {
    const g = gameRef.current;
    g.truck = { y: g.roadY, vy: 0, jumping: false };
    g.obstacles = [];
    g.score = 0;
    g.speed = 3.5;
    g.running = true;
    g.frame = 0;
    g.gameOver = false;
    setScore(0);
    setGameStarted(true);
    setGameOver(false);
  }, []);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (!g.running) { startGame(); return; }
    if (!g.truck.jumping) {
      g.truck.vy = -10;
      g.truck.jumping = true;
    }
  }, [startGame]);

  useEffect(() => {
    const handleKey = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); } };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [jump]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const draw = () => {
      const g = gameRef.current;
      ctx.clearRect(0, 0, W, H);

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      if (isDark) {
        skyGrad.addColorStop(0, '#0a0a0a');
        skyGrad.addColorStop(1, '#1a1a2e');
      } else {
        skyGrad.addColorStop(0, '#e0f2fe');
        skyGrad.addColorStop(1, '#f0fdf4');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Stars in dark mode
      if (isDark) {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 20; i++) {
          const sx = (i * 37 + g.frame * 0.1) % W;
          const sy = (i * 23) % (H * 0.6);
          ctx.globalAlpha = 0.3 + Math.sin(g.frame * 0.02 + i) * 0.3;
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
        ctx.globalAlpha = 1;
      }

      // Road — truck drives ON this
      const roadTop = g.roadY;
      const roadH = 40;
      ctx.fillStyle = isDark ? '#333' : '#94a3b8';
      ctx.fillRect(0, roadTop, W, roadH);
      // Road center line
      ctx.strokeStyle = isDark ? '#555' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 15]);
      ctx.lineDashOffset = -g.frame * g.speed;
      ctx.beginPath();
      ctx.moveTo(0, roadTop + roadH / 2);
      ctx.lineTo(W, roadTop + roadH / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ground below road
      ctx.fillStyle = isDark ? '#1a1a1a' : '#d4d4d8';
      ctx.fillRect(0, roadTop + roadH, W, H - roadTop - roadH);

      // Truck dimensions
      const TRUCK_W = 38;
      const TRUCK_BODY_H = 16;
      const TRUCK_CABIN_H = 10;
      const TRUCK_TOTAL_H = TRUCK_BODY_H + TRUCK_CABIN_H;
      const TRUCK_X = 45;
      const WHEEL_R = 5;

      if (g.running) {
        // Physics — truck.y is bottom of truck body (sits on road surface)
        g.truck.vy += 0.6;
        g.truck.y += g.truck.vy;
        if (g.truck.y >= roadTop) {
          g.truck.y = roadTop;
          g.truck.vy = 0;
          g.truck.jumping = false;
        }

        // Spawn obstacles on the road
        g.frame++;
        if (g.frame % Math.max(55, 95 - g.score) === 0) {
          const h = 18 + Math.random() * 20;
          g.obstacles.push({ x: W + 10, w: 20 + Math.random() * 10, h, type: Math.random() > 0.5 ? 'box' : 'cone' });
        }

        // Move obstacles
        g.obstacles.forEach(o => { o.x -= g.speed; });
        g.obstacles = g.obstacles.filter(o => o.x > -50);

        // Score — obstacle passed the truck
        g.obstacles.forEach(o => {
          if (!o.scored && o.x + o.w < TRUCK_X) { o.scored = true; g.score++; setScore(g.score); }
        });

        // Speed ramp
        g.speed = 3.5 + g.score * 0.15;

        // Collision detection — both truck and obstacles sit ON roadTop
        // Truck hitbox: body area
        const tx = TRUCK_X;
        const tw = TRUCK_W;
        const truckTop = g.truck.y - TRUCK_BODY_H;
        const truckBottom = g.truck.y;

        for (const o of g.obstacles) {
          // Obstacle sits on road: bottom at roadTop, top at roadTop - o.h
          const obsTop = roadTop - o.h;
          const obsBottom = roadTop;

          // AABB collision
          if (tx < o.x + o.w && tx + tw > o.x && truckBottom > obsTop && truckTop < obsBottom) {
            g.running = false;
            g.gameOver = true;
            setGameOver(true);
            if (g.score > highScore) {
              setHighScore(g.score);
              localStorage.setItem('truckHS', String(g.score));
            }
          }
        }
      }

      // Draw truck — ty is bottom of body (sits on road)
      const ty = g.truck.y;
      // Body
      ctx.fillStyle = isDark ? '#f97316' : '#14b8a6';
      ctx.fillRect(TRUCK_X, ty - TRUCK_BODY_H, TRUCK_W, TRUCK_BODY_H);
      // Cabin (above body, toward front)
      ctx.fillStyle = isDark ? '#ea580c' : '#0d9488';
      ctx.fillRect(TRUCK_X + TRUCK_W - 16, ty - TRUCK_TOTAL_H, 16, TRUCK_CABIN_H);
      // Window
      ctx.fillStyle = isDark ? '#fbbf24' : '#a7f3d0';
      ctx.fillRect(TRUCK_X + TRUCK_W - 13, ty - TRUCK_TOTAL_H + 2, 10, 6);
      // Wheels — sit at road level
      ctx.fillStyle = isDark ? '#fff' : '#1e293b';
      ctx.beginPath(); ctx.arc(TRUCK_X + 8, ty + 1, WHEEL_R, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(TRUCK_X + TRUCK_W - 8, ty + 1, WHEEL_R, 0, Math.PI * 2); ctx.fill();
      // Exhaust
      if (g.running && !g.truck.jumping) {
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
          ctx.beginPath();
          ctx.arc(TRUCK_X - 5 - i * 7 - Math.random() * 4, ty - 8 + Math.random() * 6, 2 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw obstacles — sit ON road (bottom at roadTop)
      g.obstacles.forEach(o => {
        const obsTop = roadTop - o.h;
        if (o.type === 'box') {
          ctx.fillStyle = isDark ? '#dc2626' : '#ef4444';
          ctx.fillRect(o.x, obsTop, o.w, o.h);
          ctx.fillStyle = isDark ? '#fca5a5' : '#fecaca';
          ctx.fillRect(o.x + 2, obsTop + 2, o.w - 4, 3);
        } else {
          ctx.fillStyle = isDark ? '#f59e0b' : '#f97316';
          ctx.beginPath();
          ctx.moveTo(o.x + o.w / 2, obsTop);
          ctx.lineTo(o.x + o.w, obsTop + o.h);
          ctx.lineTo(o.x, obsTop + o.h);
          ctx.closePath();
          ctx.fill();
        }
      });

      // Score display
      ctx.fillStyle = isDark ? '#e4e4e7' : '#18181b';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${g.score}`, W - 10, 20);

      // Game over overlay
      if (g.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
        ctx.font = '13px sans-serif';
        ctx.fillText('Нажмите пробел или тапните', W / 2, H / 2 + 15);
      }

      // Start screen
      if (!g.running && !g.gameOver) {
        ctx.fillStyle = isDark ? '#a1a1aa' : '#71717a';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Пробел / Тап — играть', W / 2, g.roadY - 50);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isDark, highScore]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        onClick={jump}
        onTouchStart={(e) => { e.preventDefault(); jump(); }}
        className={`rounded-2xl cursor-pointer w-full max-w-[400px] ${isDark ? 'border border-zinc-700/50' : 'border border-zinc-200/80 shadow-lg'}`}
        style={{ touchAction: 'none' }}
        data-testid="truck-game-canvas"
      />
      <div className="flex justify-between mt-3 px-1">
        <span className={`text-xs font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Счёт: {score}
        </span>
        <span className={`text-xs font-mono ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`}>
          Рекорд: {highScore}
        </span>
      </div>
    </div>
  );
};


export default function MaintenancePage({ message }) {
  const [isDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Floating gear particles
  const gears = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 16 + Math.random() * 32,
    speed: 8 + Math.random() * 20,
    delay: Math.random() * 3,
  }));

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden ${
        isDark ? 'bg-zinc-950' : 'bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100'
      }`}
      data-testid="maintenance-page"
    >
      {/* Animated background gears */}
      {gears.map((g) => (
        <motion.div
          key={g.id}
          className={`absolute pointer-events-none ${isDark ? 'text-zinc-800/30' : 'text-zinc-200/60'}`}
          style={{ left: `${g.x}%`, top: `${g.y}%` }}
          animate={{ rotate: 360 }}
          transition={{ duration: g.speed, repeat: Infinity, ease: 'linear', delay: g.delay }}
        >
          <svg width={g.size} height={g.size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64L19.43 12.97Z"/>
          </svg>
        </motion.div>
      ))}

      {/* Pulsing ring */}
      <motion.div
        className={`absolute w-[500px] h-[500px] rounded-full border ${isDark ? 'border-orange-500/10' : 'border-teal-400/15'}`}
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className={`absolute w-[350px] h-[350px] rounded-full border ${isDark ? 'border-orange-500/10' : 'border-teal-400/15'}`}
        animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
        {/* Animated wrench icon */}
        <motion.div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-8 ${
            isDark ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-teal-500/10 border border-teal-500/20'
          }`}
          animate={{ rotate: [0, -15, 15, -15, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg className={`w-10 h-10 ${isDark ? 'text-orange-400' : 'text-teal-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"/>
          </svg>
        </motion.div>

        {/* Title */}
        <motion.h1
          className={`text-3xl sm:text-4xl font-black tracking-tight text-center mb-3 ${
            isDark ? 'text-zinc-100' : 'text-zinc-800'
          }`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Технические работы
        </motion.h1>

        {/* Progress bar animation */}
        <motion.div
          className={`w-48 h-1 rounded-full overflow-hidden mb-5 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className={`h-full rounded-full ${isDark ? 'bg-orange-500' : 'bg-teal-500'}`}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '40%' }}
          />
        </motion.div>

        {/* Message */}
        <motion.p
          className={`text-center text-base mb-10 max-w-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {message || 'Мы обновляем сайт, чтобы сделать его ещё лучше. Скоро вернёмся!'}
        </motion.p>

        {/* Live clock */}
        <motion.div
          className={`font-mono text-sm mb-10 px-4 py-2 rounded-xl ${
            isDark ? 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50' : 'bg-white/70 text-zinc-500 border border-zinc-200/50 shadow-sm'
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {time.toLocaleTimeString('ru-RU')} MSK
        </motion.div>

        {/* Mini game */}
        <motion.div
          className="w-full flex flex-col items-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <p className={`text-xs uppercase tracking-widest font-bold mb-4 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`}>
            Пока ждёте — поиграйте
          </p>
          <TruckGame isDark={isDark} />
        </motion.div>
      </div>

      {/* Brand footer with hidden admin access */}
      <div className="absolute bottom-6 flex flex-col items-center gap-2">
        <motion.p
          className={`text-xs font-bold uppercase tracking-[0.2em] ${isDark ? 'text-zinc-800' : 'text-zinc-200'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          avopt.store
        </motion.p>
        <a
          href="/login"
          className={`text-[10px] opacity-20 hover:opacity-60 transition-opacity ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`}
          data-testid="maintenance-admin-link"
        >
          Панель управления
        </a>
      </div>
    </div>
  );
}
