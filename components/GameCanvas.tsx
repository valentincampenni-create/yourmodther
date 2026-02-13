
import React, { useEffect, useRef } from 'react';
import { TileType, Direction, Entity, GameState } from '../types';
import { TILE_SIZE, MAZE_LAYOUT, BASE_SPEED, POLICE_SPEED_NORMAL, POLICE_SPEED_SCARED, TURBO_DURATION } from '../constants';
import { getHeistCommentary } from '../services/geminiService';

interface GameCanvasProps {
  onScoreUpdate: (score: number) => void;
  onLivesUpdate: (lives: number) => void;
  onLevelUpdate: (level: number) => void;
  onMessage: (msg: string, sender: 'DJ_GEMINI' | 'POLICE_DISPATCH') => void;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  onScoreUpdate, onLivesUpdate, onLevelUpdate, onMessage, gameState, setGameState 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mazeRef = useRef<number[][]>(MAZE_LAYOUT.map(row => [...row]));
  const lastTimeRef = useRef<number>(0);
  
  const stateRef = useRef(gameState);
  useEffect(() => { 
    stateRef.current = gameState;
    if (gameState.status === 'START') {
      mazeRef.current = MAZE_LAYOUT.map(row => [...row]);
      resetEntities();
    }
  }, [gameState.status]);

  const playerRef = useRef<Entity>({
    pos: { x: 12, y: 18 },
    dir: 'NONE',
    nextDir: 'NONE',
    speed: BASE_SPEED,
    type: 'PLAYER',
    id: 'player'
  });

  const policeRef = useRef<Entity[]>([
    { pos: { x: 12, y: 7 }, dir: 'LEFT', nextDir: 'LEFT', speed: POLICE_SPEED_NORMAL, type: 'POLICE', id: 'cop_1' },
    { pos: { x: 11, y: 10 }, dir: 'RIGHT', nextDir: 'RIGHT', speed: POLICE_SPEED_NORMAL, type: 'POLICE', id: 'cop_2' },
    { pos: { x: 13, y: 10 }, dir: 'UP', nextDir: 'UP', speed: POLICE_SPEED_NORMAL, type: 'POLICE', id: 'cop_3' },
  ]);

  const resetEntities = () => {
    playerRef.current.pos = { x: 12, y: 18 };
    playerRef.current.dir = 'NONE';
    playerRef.current.nextDir = 'NONE';
    policeRef.current[0].pos = { x: 12, y: 7 };
    policeRef.current[1].pos = { x: 11, y: 10 };
    policeRef.current[2].pos = { x: 13, y: 10 };
    policeRef.current.forEach(c => { c.dir = 'LEFT'; c.nextDir = 'LEFT'; });
  };

  const isWall = (x: number, y: number) => {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const maze = mazeRef.current;
    if (ry < 0 || ry >= maze.length || rx < 0 || rx >= maze[0].length) return false; // Permitir túneles
    return maze[ry][rx] === TileType.WALL;
  };

  const moveEntity = (entity: Entity, dt: number) => {
    const speed = entity.speed * dt;
    const oldPos = { ...entity.pos };
    
    let nextX = oldPos.x;
    let nextY = oldPos.y;

    if (entity.dir === 'UP') nextY -= speed;
    else if (entity.dir === 'DOWN') nextY += speed;
    else if (entity.dir === 'LEFT') nextX -= speed;
    else if (entity.dir === 'RIGHT') nextX += speed;

    const cx = Math.round(oldPos.x);
    const cy = Math.round(oldPos.y);

    // Detectar si cruzamos el centro exacto de la baldosa
    const crossedCenterX = (oldPos.x <= cx && nextX >= cx) || (oldPos.x >= cx && nextX <= cx);
    const crossedCenterY = (oldPos.y <= cy && nextY >= cy) || (oldPos.y >= cy && nextY <= cy);

    // Lógica de decisión en intersecciones
    if ((entity.dir === 'LEFT' || entity.dir === 'RIGHT' || entity.dir === 'NONE') && crossedCenterX) {
      handleIntersection(entity, cx, cy, nextX, nextY);
    } else if ((entity.dir === 'UP' || entity.dir === 'DOWN' || entity.dir === 'NONE') && crossedCenterY) {
      handleIntersection(entity, cx, cy, nextX, nextY);
    } else {
      entity.pos.x = nextX;
      entity.pos.y = nextY;
    }

    // Teletransporte lateral
    if (entity.pos.x < -0.5) entity.pos.x = mazeRef.current[0].length - 0.5;
    if (entity.pos.x > mazeRef.current[0].length - 0.5) entity.pos.x = -0.5;
  };

  const handleIntersection = (entity: Entity, cx: number, cy: number, nextX: number, nextY: number) => {
    // 1. Intentar girar a la dirección deseada (nextDir)
    if (entity.nextDir !== 'NONE' && entity.nextDir !== entity.dir) {
      let canTurn = false;
      if (entity.nextDir === 'UP' && !isWall(cx, cy - 1)) canTurn = true;
      if (entity.nextDir === 'DOWN' && !isWall(cx, cy + 1)) canTurn = true;
      if (entity.nextDir === 'LEFT' && !isWall(cx - 1, cy)) canTurn = true;
      if (entity.nextDir === 'RIGHT' && !isWall(cx + 1, cy)) canTurn = true;

      if (canTurn) {
        entity.pos.x = cx;
        entity.pos.y = cy;
        entity.dir = entity.nextDir;
        if (entity.type === 'PLAYER') entity.nextDir = 'NONE';
        return;
      }
    }

    // 2. Si no puede girar, verificar si el camino actual está bloqueado
    let blocked = false;
    if (entity.dir === 'UP' && isWall(cx, cy - 1)) blocked = true;
    if (entity.dir === 'DOWN' && isWall(cx, cy + 1)) blocked = true;
    if (entity.dir === 'LEFT' && isWall(cx - 1, cy)) blocked = true;
    if (entity.dir === 'RIGHT' && isWall(cx + 1, cy)) blocked = true;

    if (blocked) {
      entity.pos.x = cx;
      entity.pos.y = cy;
      entity.dir = 'NONE';
    } else {
      entity.pos.x = nextX;
      entity.pos.y = nextY;
    }
  };

  const updatePoliceAI = (cop: Entity, playerPos: {x: number, y: number}, scared: boolean, dt: number) => {
    const rx = Math.round(cop.pos.x);
    const ry = Math.round(cop.pos.y);
    
    // IA de Decisión: solo cuando está cerca del centro de una baldosa
    if (Math.abs(cop.pos.x - rx) < 0.1 && Math.abs(cop.pos.y - ry) < 0.1) {
      const options: Direction[] = [];
      if (!isWall(rx, ry - 1)) options.push('UP');
      if (!isWall(rx, ry + 1)) options.push('DOWN');
      if (!isWall(rx - 1, ry)) options.push('LEFT');
      if (!isWall(rx + 1, ry)) options.push('RIGHT');

      const opposites: Record<string, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT', NONE: 'NONE' };
      const filtered = options.filter(o => o !== opposites[cop.dir]);
      const finalOptions = filtered.length > 0 ? filtered : options;

      let bestDir = finalOptions[0];
      let bestDist = scared ? -1 : Infinity;

      finalOptions.forEach(d => {
        let tx = rx, ty = ry;
        if (d === 'UP') ty--; else if (d === 'DOWN') ty++; else if (d === 'LEFT') tx--; else if (d === 'RIGHT') tx++;
        const dist = Math.sqrt(Math.pow(tx - playerPos.x, 2) + Math.pow(ty - playerPos.y, 2));
        if (scared) {
          if (dist > bestDist) { bestDist = dist; bestDir = d; }
        } else {
          if (dist < bestDist) { bestDist = dist; bestDir = d; }
        }
      });
      
      cop.nextDir = bestDir;
      if (cop.dir === 'NONE') cop.dir = bestDir; // Forzar salida si se quedó trabado
    }

    cop.speed = scared ? POLICE_SPEED_SCARED : POLICE_SPEED_NORMAL;
    moveEntity(cop, dt);
  };

  const checkCollisions = () => {
    const px = Math.round(playerRef.current.pos.x);
    const py = Math.round(playerRef.current.pos.y);
    const maze = mazeRef.current;

    if (maze[py] && maze[py][px] === TileType.CASH) {
      maze[py][px] = TileType.EMPTY;
      setGameState(prev => ({ ...prev, score: prev.score + 10, cashRemaining: prev.cashRemaining - 1 }));
    } else if (maze[py] && maze[py][px] === TileType.TURBO) {
      maze[py][px] = TileType.EMPTY;
      setGameState(prev => ({ ...prev, isVulnerable: true, vulnerableTimer: TURBO_DURATION }));
      getHeistCommentary('COLLECT_TURBO').then(msg => onMessage(msg, 'DJ_GEMINI'));
    }

    policeRef.current.forEach(cop => {
      const dx = cop.pos.x - playerRef.current.pos.x;
      const dy = cop.pos.y - playerRef.current.pos.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 0.6) {
        if (stateRef.current.isVulnerable) {
          cop.pos = { x: 12, y: 10 };
          setGameState(prev => ({ ...prev, score: prev.score + 200 }));
          onMessage("¡Patrulla arrestada!", "DJ_GEMINI");
        } else {
          const nextLives = stateRef.current.lives - 1;
          if (nextLives <= 0) {
            setGameState(prev => ({ ...prev, status: 'GAMEOVER', lives: 0 }));
          } else {
            setGameState(prev => ({ ...prev, lives: nextLives }));
            resetEntities();
          }
        }
      }
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    mazeRef.current.forEach((row, y) => {
      row.forEach((tile, x) => {
        const tx = x * TILE_SIZE;
        const ty = y * TILE_SIZE;
        if (tile === TileType.WALL) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1;
          ctx.strokeRect(tx + 3, ty + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        } else if (tile === TileType.CASH) {
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(tx + TILE_SIZE/2, ty + TILE_SIZE/2, 2.5, 0, Math.PI*2);
          ctx.fill();
        } else if (tile === TileType.TURBO) {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(tx + TILE_SIZE/2, ty + TILE_SIZE/2, 6, 0, Math.PI*2);
          ctx.fill();
        }
      });
    });

    // Coche Jugador
    const p = playerRef.current;
    ctx.save();
    ctx.translate(p.pos.x * TILE_SIZE + TILE_SIZE/2, p.pos.y * TILE_SIZE + TILE_SIZE/2);
    const rot = p.dir === 'UP' ? -Math.PI/2 : p.dir === 'DOWN' ? Math.PI/2 : p.dir === 'LEFT' ? Math.PI : 0;
    ctx.rotate(rot);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-11, -8, 22, 16);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(5, -6, 3, 12);
    ctx.restore();

    // Patrullas
    policeRef.current.forEach(cop => {
      ctx.save();
      ctx.translate(cop.pos.x * TILE_SIZE + TILE_SIZE/2, cop.pos.y * TILE_SIZE + TILE_SIZE/2);
      const crot = cop.dir === 'UP' ? -Math.PI/2 : cop.dir === 'DOWN' ? Math.PI/2 : cop.dir === 'LEFT' ? Math.PI : 0;
      ctx.rotate(crot);
      ctx.fillStyle = stateRef.current.isVulnerable ? '#3b82f6' : '#fff';
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#000';
      ctx.fillRect(-11, -8, 11, 16);
      const sOn = Math.floor(Date.now() / 150) % 2 === 0;
      ctx.fillStyle = sOn ? '#f00' : '#00f';
      ctx.fillRect(0, -3, 3, 6);
      ctx.restore();
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const p = playerRef.current;
      
      let next: Direction = 'NONE';
      if (key === 'w') next = 'UP';
      else if (key === 's') next = 'DOWN';
      else if (key === 'a') next = 'LEFT';
      else if (key === 'd') next = 'RIGHT';

      if (next !== 'NONE') {
        p.nextDir = next;
        // Inversión inmediata
        const opposites: Record<string, string> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
        if (opposites[p.dir] === next) {
          p.dir = next;
          p.nextDir = 'NONE';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      if (stateRef.current.status === 'PLAYING') {
        moveEntity(playerRef.current, dt);
        policeRef.current.forEach(cop => updatePoliceAI(cop, playerRef.current.pos, stateRef.current.isVulnerable, dt));
        checkCollisions();

        if (stateRef.current.isVulnerable) {
          setGameState(prev => {
            const nextTimer = prev.vulnerableTimer - 1;
            if (nextTimer <= 0) return { ...prev, isVulnerable: false, vulnerableTimer: 0 };
            return { ...prev, vulnerableTimer: nextTimer };
          });
        }
      }
      
      draw();
      requestAnimationFrame(loop);
    };

    const animId = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="relative border-4 border-slate-800 rounded-lg shadow-2xl bg-slate-900 overflow-hidden">
      <canvas ref={canvasRef} width={MAZE_LAYOUT[0].length * TILE_SIZE} height={MAZE_LAYOUT.length * TILE_SIZE} />
      
      {gameState.status === 'START' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-center p-6">
          <h2 className="text-4xl text-blue-500 retro-font mb-4">STREET CASH</h2>
          <p className="text-slate-400 text-xs mb-8 uppercase tracking-widest">Controles: WASD para Conducir</p>
          <button 
            onClick={() => setGameState(p => ({...p, status: 'PLAYING', cashRemaining: mazeRef.current.flat().filter(t => t === TileType.CASH).length}))}
            className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white retro-font text-[10px] animate-pulse"
          >
            INICIAR ESCAPE
          </button>
        </div>
      )}

      {gameState.status === 'GAMEOVER' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 text-center">
          <h2 className="text-5xl text-white retro-font mb-4 italic">¡BUSTED!</h2>
          <p className="text-red-200 mb-8 font-bold text-sm">Botín confiscado. Score: {gameState.score}</p>
          <button 
            onClick={() => setGameState({
              score: 0,
              lives: 3,
              status: 'START',
              level: 1,
              cashRemaining: 0,
              isVulnerable: false,
              vulnerableTimer: 0
            })} 
            className="px-8 py-4 bg-white text-red-900 retro-font text-[10px]"
          >
            VOLVER A EMPEZAR
          </button>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
