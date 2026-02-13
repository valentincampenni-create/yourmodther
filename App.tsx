
import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, RadioMessage } from './types';
import { Wallet, Heart, Radio, ShieldAlert } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: 3,
    status: 'START',
    level: 1,
    cashRemaining: 0,
    isVulnerable: false,
    vulnerableTimer: 0
  });

  const [messages, setMessages] = useState<RadioMessage[]>([]);

  const addMessage = (text: string, sender: 'DJ_GEMINI' | 'POLICE_DISPATCH') => {
    const newMessage: RadioMessage = {
      text,
      sender,
      id: Date.now()
    };
    setMessages(prev => [newMessage, ...prev].slice(0, 3));
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-2">
      {/* Header HUD */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-4 px-6 py-3 bg-slate-900/50 rounded-xl border border-slate-800 shadow-lg shadow-blue-500/5">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-slate-500 text-[9px] uppercase font-bold tracking-[0.2em]">Botín Actual</span>
            <div className="flex items-center gap-2 text-green-400 font-bold">
              <Wallet size={16} />
              <span className="retro-font text-xs">${gameState.score.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-[9px] uppercase font-bold tracking-[0.2em]">Integridad</span>
            <div className="flex items-center gap-1 text-red-500">
              {[...Array(3)].map((_, i) => (
                <Heart 
                  key={i} 
                  size={16} 
                  fill={i < gameState.lives ? "currentColor" : "transparent"} 
                  className={i < gameState.lives ? "" : "text-slate-800"}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-black text-white italic tracking-tighter">
            STREET <span className="text-blue-500">CASH</span>
          </h1>
          {gameState.isVulnerable && (
            <div className="flex items-center gap-2 text-amber-500 animate-pulse justify-center">
              <ShieldAlert size={12} />
              <span className="text-[9px] font-bold">MODO TURBO</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end">
          <span className="text-slate-500 text-[9px] uppercase font-bold tracking-[0.2em]">Sector</span>
          <span className="text-blue-400 font-bold retro-font text-xs">{gameState.level}</span>
        </div>
      </div>

      <div className="relative flex flex-col md:flex-row gap-4 items-stretch">
        {/* Game Area */}
        <GameCanvas 
          gameState={gameState}
          setGameState={setGameState}
          onScoreUpdate={(s) => setGameState(p => ({...p, score: s}))}
          onLivesUpdate={(l) => setGameState(p => ({...p, lives: l}))}
          onLevelUpdate={(lv) => setGameState(p => ({...p, level: lv}))}
          onMessage={addMessage}
        />

        {/* Side Panel: Radio */}
        <div className="w-full md:w-64 flex flex-col gap-4">
          <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 h-full min-h-[250px] overflow-hidden relative shadow-inner">
            <div className="flex items-center gap-2 text-blue-400 mb-4 border-b border-blue-900/30 pb-2">
              <Radio size={16} className="animate-pulse" />
              <span className="font-bold text-[10px] uppercase tracking-wider">Underground Radio</span>
            </div>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-slate-600 text-[10px] italic">Buscando señal...</p>
              ) : (
                messages.map(m => (
                  <div key={m.id} className="animate-in slide-in-from-right duration-300">
                    <p className={`text-[9px] font-bold mb-1 ${m.sender === 'DJ_GEMINI' ? 'text-blue-400' : 'text-red-400'}`}>
                      {m.sender === 'DJ_GEMINI' ? '>> DJ NITRO' : '>> CENTRAL POLICÍA'}
                    </p>
                    <p className="text-slate-300 text-[11px] leading-snug font-medium italic">"{m.text}"</p>
                  </div>
                ))
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
          </div>

          <div className="p-4 bg-blue-600/5 rounded-xl border border-blue-500/10">
            <h3 className="text-blue-500 text-[9px] font-bold uppercase mb-2 tracking-widest">Manual de Piloto</h3>
            <ul className="text-slate-500 text-[10px] space-y-1.5 font-medium">
              <li className="flex justify-between"><span>CONDUCIR:</span> <span className="text-slate-300 font-bold">WASD</span></li>
              <li className="flex justify-between"><span>DINERO:</span> <span className="text-green-500 font-bold">PUNTOS VERDES</span></li>
              <li className="flex justify-between"><span>TURBO:</span> <span className="text-amber-500 font-bold">PUNTOS NARANJAS</span></li>
              <li className="text-[9px] mt-2 pt-2 border-t border-slate-800 italic text-slate-600">
                * Con el turbo activado, embiste a las patrullas para eliminarlas.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
