"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { RoomStatus, Role } from "@repo/types";
import { RoleCard } from "@/components/RoleCard";
import { RulesModal } from "@/components/RulesModal";
import { Toaster, toast } from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";

const ANIMAL_EMOJIS = [
  "🐶",
  "🐱",
  "🐭",
  "🐹",
  "🐰",
  "🦊",
  "🐻",
  "🐼",
  "🐨",
  "🐯",
  "🦁",
  "🐮",
  "🐷",
  "🐸",
  "🐵",
  "🐔",
  "🐧",
  "🐦",
  "🐤",
  "🦉",
  "🦇",
  "🐺",
  "🐗",
  "🐴",
  "🦄",
  "🐝",
  "🐛",
  "🦋",
  "🐌",
  "🐞",
  "🐜",
  "🦟",
  "🐢",
  "🐍",
  "🦎",
  "🦖",
  "🦕",
  "🐙",
  "🦑",
  "🦐",
  "🦞",
  "🦀",
  "🐡",
  "🐠",
  "🐟",
  "🐬",
  "🐳",
  "🐋",
  "🦈",
  "🐊",
  "🐅",
  "🐆",
  "🦓",
  "🦍",
  "🦧",
  "🦣",
  "🐘",
  "🦛",
  "🦏",
  "🐪",
  "🐫",
  "🦒",
  "🦘",
  "🦬",
  "🐃",
  "🐂",
  "🐄",
  "🐎",
  "🐖",
  "🐏",
  "🐑",
  "🦙",
  "🐐",
  "🦌",
  "🐕",
  "🐩",
  "🦮",
  "🐕‍🦺",
  "🐈",
  "🐈‍⬛",
  "🐓",
  "🦃",
  "🦚",
  "🦜",
  "🦢",
  "🦩",
  "🕊",
  "🐇",
  "🦝",
  "🦨",
  "🦡",
  "🦦",
  "🦥",
  "🐁",
  "🐀",
  "🐿",
  "🦔",
];

function getAvatarEmoji(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % ANIMAL_EMOJIS.length;
  return ANIMAL_EMOJIS[index];
}

function CountdownTimer({ endTime }: { endTime?: number }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!endTime) return;

    const tick = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [endTime]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <span>
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

function GameLobby() {
  const { connect, connected, room, myName, setName, createRoom, joinRoom, startGame, myRole, leaveRoom, availableRooms } = useGameStore();
  const searchParams = useSearchParams();
  const roomQuery = searchParams.get("room");

  const [joinCode, setJoinCode] = useState(roomQuery || "");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    connect();
  }, [connect]);

  if (!connected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-slate-950">
        <h1 className="text-4xl font-bold animate-pulse text-slate-400">Connecting...</h1>
      </main>
    );
  }

  if (!room) {
    if (roomQuery) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-200 relative">
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
            <RulesModal />
          </div>
          <div className="w-full max-w-md p-6 sm:p-8 bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            <div className="flex justify-center mb-4 mt-2">
              <img src="/icon.png" alt="WHO KNOW? Logo" className="w-20 h-20 rounded-2xl shadow-lg shadow-indigo-500/20 border border-slate-700" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-center mb-2 tracking-tighter text-white">You've been invited!</h1>
            <p className="text-center text-slate-400 mb-8 font-medium">
              Join room <span className="text-indigo-400 font-mono font-bold">{roomQuery.toUpperCase()}</span>
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Display Name</label>
                <input
                  type="text"
                  value={myName}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && myName && joinCode.length >= 4) {
                      joinRoom(joinCode);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-center text-lg shadow-inner"
                  placeholder="Enter your name to play"
                  autoFocus
                />
              </div>

              <button onClick={() => joinRoom(joinCode)} disabled={!myName || joinCode.length < 4} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xl py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]">
                Enter Game
              </button>

              <button
                onClick={() => {
                  window.history.replaceState({}, document.title, window.location.pathname);
                  setJoinCode("");
                }}
                className="w-full text-slate-500 hover:text-slate-300 font-medium text-sm transition-colors py-2"
              >
                Or create your own room
              </button>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-200 relative">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <RulesModal />
        </div>
        <div className="w-full max-w-md p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
          <div className="flex justify-center mb-6">
            <img src="/icon.png" alt="WHO KNOW? Logo" className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] shadow-2xl shadow-indigo-500/20 border border-slate-700" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-center mb-8 tracking-tighter bg-gradient-to-br from-indigo-400 to-purple-500 bg-clip-text text-transparent">WHO KNOW?</h1>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Display Name</label>
              <input type="text" value={myName} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="Enter your name" />
            </div>

            <button onClick={createRoom} disabled={!myName} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-indigo-500/20">
              Create New Room
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-medium">OR</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && myName && joinCode.length >= 4) {
                    joinRoom(joinCode);
                  }
                }}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono uppercase font-bold text-center"
                placeholder="ROOM CODE"
                maxLength={6}
              />
              <button onClick={() => joinRoom(joinCode)} disabled={!myName || joinCode.length < 4} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 rounded-xl transition-colors">
                Join
              </button>
            </div>
          </div>

          {availableRooms.length > 0 && (
            <div className="mt-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px bg-slate-800 flex-1"></div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  Public Lobbies
                  <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md shadow-sm">{availableRooms.length}</span>
                </h3>
                <div className="h-px bg-slate-800 flex-1"></div>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {availableRooms.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (!myName) {
                        toast.error("Please enter your display name first");
                        return;
                      }
                      setJoinCode(r.code);
                      joinRoom(r.code);
                    }}
                    className="w-full bg-slate-900 border border-slate-800/80 hover:border-indigo-500/50 rounded-2xl p-4 text-left transition-all flex items-center justify-between group shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5"
                  >
                    <div>
                      <div className="text-slate-200 font-bold font-mono tracking-widest text-lg leading-none mb-1 group-hover:text-indigo-300 transition-colors">{r.code}</div>
                      <div className="text-slate-500 text-[10px] font-medium uppercase mt-0.5 tracking-wider flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        Host <span className="text-slate-300 normal-case font-bold">{r.hostName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 shadow-inner group-hover:border-indigo-500/30 transition-colors" title={`${r.playerCount} Players currently in room`}>
                        {r.playerCount}
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 group-hover:text-indigo-400 transition-colors">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] uppercase font-black px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 border border-indigo-500/50">Join</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center p-2 sm:p-4 bg-slate-950 text-slate-200">
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-2 sm:gap-4 flex-1 relative">
        {/* Header */}
        <header className="flex-none flex items-center justify-between gap-4 p-2 sm:p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl z-10 w-full">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap w-full">
            <img src="/icon.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm border border-slate-700" />
            <span className="text-xs font-medium text-slate-500 hidden sm:block">Room</span>
            <span className="text-xl sm:text-2xl font-black font-mono tracking-widest text-indigo-400 leading-none">{room.code}</span>
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 ml-1 sm:ml-2 border-l border-slate-700 pl-2 sm:pl-4 py-0.5 flex items-center gap-1">
              <span className="hidden sm:inline">Room Host:</span>
              <span className="text-slate-300 font-bold truncate max-w-[100px] sm:max-w-[150px]" title="Room Creator">
                {room.players?.find((p) => p.socketId === room.roomHostId)?.name || "Unknown"}
              </span>
            </span>
            <button
              onClick={() => {
                const inviteLink = `${window.location.origin}/?room=${room.code}`;
                navigator.clipboard.writeText(inviteLink);
                toast.success("Invite link copied!");
              }}
              className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 font-bold px-2.5 py-1.5 rounded-lg transition-colors text-xs flex items-center gap-1.5 sm:ml-2"
              title="Copy Invite Link"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              <span className="hidden sm:inline">Copy Link</span>
            </button>
            <button onClick={() => setShowQRModal(true)} className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 hover:text-purple-300 border border-purple-500/30 font-bold px-2.5 py-1.5 rounded-lg transition-colors text-xs flex items-center gap-1.5 ml-1" title="Show QR Code">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <rect width="4" height="4" x="7" y="7" />
                <rect width="4" height="4" x="13" y="7" />
                <rect width="4" height="4" x="7" y="13" />
                <rect width="4" height="4" x="13" y="13" />
              </svg>
              <span className="hidden sm:inline">QR Code</span>
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <RulesModal />
            <button onClick={() => setShowLeaveModal(true)} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap" title="Leave Room">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </header>

        {/* Role Section at Top */}
        {myRole && (
          <div className="flex-none w-full relative z-0">
            <RoleCard role={myRole} word={useGameStore.getState().secretWord} />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2 sm:gap-4">
          {/* Left: Players Table */}
          <div className="flex-1 md:flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl p-2 sm:p-4 shadow-xl overflow-hidden min-h-[100px]">
            <div className="flex flex-none items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Players</h3>
              <span className="bg-slate-800 px-2 py-0.5 rounded-full text-[10px] text-indigo-400 font-black border border-slate-700">{room.players.length}</span>
            </div>

            <div className="flex-1 overflow-auto border border-slate-800/50 rounded-xl relative bg-slate-950/20">
              <table className="w-full text-sm text-left relative">
                <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/90 backdrop-blur-md sticky top-0 border-b border-slate-800/80 shadow-sm">
                  <tr>
                    <th className="px-3 py-2 font-bold tracking-wider">Player</th>
                    <th className="px-3 py-2 text-right font-bold tracking-wider">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {room.players.map((p) => (
                    <tr key={p.id} className="bg-slate-800/10 hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2 font-medium flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-sm shadow-inner flex-shrink-0 border border-slate-700" title={p.name}>
                          {getAvatarEmoji(p.id)}
                        </span>
                        <span className="truncate max-w-[120px] sm:max-w-[200px] text-slate-300">
                          {p.name}
                          {p.connected === false && <span className="text-[9px] font-bold text-slate-500 ml-1.5 align-middle border border-slate-700 bg-slate-800/50 px-1 py-0.5 rounded leading-none inline-flex">(OFFLINE)</span>}
                          {p.name === myName && <span className="text-[9px] font-bold text-indigo-400 ml-1.5 align-middle">(YOU)</span>}
                        </span>
                        {p.role === Role.Host && (
                          <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded border border-amber-500/20 ml-auto shadow-sm leading-none flex items-center" title="Game Host">
                            HOST
                          </span>
                        )}
                        {room.status === RoomStatus.VOTING && room.votes?.[p.socketId] && (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 ml-auto shadow-sm leading-none flex items-center gap-1" title="Locked In">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            LOCKED
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-400 font-medium">{p.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Phase Interaction Area */}
          <div className="flex-none md:flex-[1.5] flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl p-2 sm:p-4 shadow-xl min-h-[300px]">
            {room.status === RoomStatus.LOBBY && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[150px]">
                <h4 className="text-lg font-black uppercase text-indigo-400 tracking-widest bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-500/20">Waiting Room</h4>

                {/* Configuration Panel */}
                <div className="w-full max-w-sm bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Host Selection</label>
                    {useGameStore.getState().socketId === room.roomHostId ? (
                      <select value={room.config?.hostSelection || "ROUND_ROBIN"} onChange={(e) => useGameStore.getState().updateConfig({ hostSelection: e.target.value as any })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                        <option value="ROUND_ROBIN">Round Robin</option>
                        <option value="RANDOM">Random</option>
                        <option value="FIXED">Room Creator (Fixed)</option>
                      </select>
                    ) : (
                      <div className="text-slate-300 font-medium text-sm px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-800/50">{room.config?.hostSelection === "ROUND_ROBIN" ? "Round Robin" : room.config?.hostSelection === "RANDOM" ? "Random" : "Room Creator (Fixed)"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Timer (Minutes)</label>
                    {useGameStore.getState().socketId === room.roomHostId ? (
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={room.config?.timerMin === undefined ? 5 : room.config?.timerMin}
                        onChange={(e) => {
                          const val = e.target.value;
                          useGameStore.getState().updateConfig({ timerMin: val === "" ? ("" as any) : parseInt(val) });
                        }}
                        onBlur={() => {
                          if (!room.config?.timerMin) {
                            useGameStore.getState().updateConfig({ timerMin: 5 });
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    ) : (
                      <div className="text-slate-300 font-medium text-sm px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-800/50">{room.config?.timerMin || 5} Minutes</div>
                    )}
                  </div>
                </div>

                {useGameStore.getState().socketId === room.roomHostId ? (
                  <button onClick={startGame} disabled={room.players.length < 4} className="w-full max-w-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-lg py-4 rounded-xl transition-colors uppercase tracking-widest shadow-lg shadow-green-900/20">
                    {room.players.length < 4 ? "Waiting (min 4)" : "Start Game"}
                  </button>
                ) : (
                  <div className="w-full max-w-xs bg-slate-800/50 text-slate-400 border border-slate-800 font-bold text-sm py-4 rounded-xl text-center uppercase tracking-widest">Waiting for Room Host to start</div>
                )}
              </div>
            )}

            {room.status === "WORD_SETTING" && (
              <div className="flex-1 flex flex-col items-center justify-center py-6 gap-4 min-h-[150px]">
                {myRole === "Host" ? (
                  <p className="text-slate-300 font-medium">Please set the secret word using the popup.</p>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                    <p className="text-slate-300 font-medium animate-pulse">Waiting for the Game Host to pick a word...</p>
                  </>
                )}
              </div>
            )}
            {room.status === RoomStatus.QUESTIONING && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 min-h-0 py-2 sm:py-4">
                <div className="text-center space-y-1 sm:space-y-2">
                  <h4 className="text-base sm:text-lg font-black uppercase text-teal-400 tracking-widest bg-teal-500/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-teal-500/20 inline-block mb-1 sm:mb-2">Questioning Phase</h4>
                  {myRole === Role.Host ? <p className="text-slate-300 font-medium text-xs sm:text-sm">Answer the players' Yes/No questions.</p> : <p className="text-slate-300 font-medium text-xs sm:text-sm">Ask the Game Host Yes or No questions to find the Secret Word!</p>}
                </div>

                {/* Timer UI Element */}
                <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-mono font-black text-white bg-slate-950 px-6 py-4 rounded-2xl border-2 sm:border-4 border-slate-800 shadow-inner tracking-widest w-full max-w-sm text-center">{room.endTime ? <CountdownTimer endTime={room.endTime} /> : <span>--:--</span>}</div>

                {myRole === Role.Host && (
                  <div className="flex flex-col gap-3 mt-2 w-full max-w-md">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={() => useGameStore.getState().endQuestioning(false)} className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-black px-4 py-4 rounded-xl transition-all shadow-lg shadow-teal-900/20 active:scale-[0.98] uppercase tracking-wider text-sm sm:text-base border border-teal-500/30">
                        Word Guessed (Vote)
                      </button>
                      <button onClick={() => useGameStore.getState().endQuestioning(true)} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-4 rounded-xl transition-all shadow-lg shadow-rose-900/20 active:scale-[0.98] uppercase tracking-wider text-sm sm:text-base border border-rose-500/30">
                        Time's Up (Fail)
                      </button>
                    </div>
                    {room.endTime && (
                      <button onClick={() => useGameStore.getState().stopTimer()} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-3 rounded-xl transition-all shadow-md active:scale-[0.98] uppercase tracking-wider text-sm border border-slate-700">
                        Stop Timer
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {room.status === RoomStatus.VOTING && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 min-h-0 py-2 sm:py-4">
                <div className="text-center space-y-1 sm:space-y-2">
                  <h4 className="text-base sm:text-lg font-black uppercase text-orange-400 tracking-widest bg-orange-500/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-orange-500/20 inline-block mb-1 sm:mb-2">Voting Phase</h4>
                  {myRole === Role.Host ? (
                    <p className="text-slate-300 text-center font-medium text-xs sm:text-sm">
                      Wait for the players to vote for the <span className="text-rose-400 font-bold bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20">Insider</span>.
                    </p>
                  ) : (
                    <p className="text-slate-300 text-center font-medium text-xs sm:text-sm">Who was secretly guiding the group? Cast your vote:</p>
                  )}
                </div>

                {myRole !== Role.Host && (
                  <div className="flex flex-wrap gap-3 justify-center w-full max-w-md">
                    {room.players.map((p) => {
                      // Don't show Host and don't show self
                      if (p.role === Role.Host || p.socketId === useGameStore.getState().socketId) return null;

                      const hasVotedTarget = room.votes?.[useGameStore.getState().socketId] === p.socketId;

                      return (
                        <button key={p.id} onClick={() => useGameStore.getState().submitVote(p.socketId)} className={`px-4 py-4 rounded-xl font-bold transition-all shadow-md active:scale-[0.98] w-full sm:w-auto flex-1 basis-[45%] border ${hasVotedTarget ? "bg-orange-600 text-white border-orange-500 shadow-orange-900/50" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white"}`}>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {room.status === RoomStatus.RESULT && (
              <div className="flex-1 flex flex-col items-center justify-start gap-4 sm:gap-6 min-h-0 py-4 sm:py-6 w-full overflow-y-auto px-2">
                <h4 className="text-base sm:text-lg flex-none font-black uppercase text-yellow-400 tracking-widest bg-yellow-500/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-yellow-500/20">Game Results</h4>

                {room.winner === "TIMEOUT" ? (
                  <div className="text-center bg-rose-950/50 p-6 rounded-2xl border border-rose-900 w-full max-w-sm animate-in zoom-in-95">
                    <h5 className="text-2xl font-black text-rose-500 mb-2 uppercase tracking-wider">Time's Up!</h5>
                    <p className="text-rose-200/80 font-medium text-sm">The group failed to guess the secret word in time. Everyone loses.</p>
                  </div>
                ) : room.winner === "INSIDER" ? (
                  <div className="text-center bg-rose-950/50 p-6 rounded-2xl border border-rose-900 w-full max-w-sm shadow-xl animate-in zoom-in-95">
                    <h5 className="text-2xl font-black text-rose-500 mb-2 uppercase tracking-wider">Insider Wins!</h5>
                    <p className="text-rose-200/80 font-medium text-sm">The group guessed the word, but failed to catch the Insider. The Insider scored 2 points!</p>
                  </div>
                ) : room.winner === "COMMONERS" ? (
                  <div className="text-center bg-emerald-950/50 p-6 rounded-2xl border border-emerald-900 w-full max-w-sm shadow-xl animate-in zoom-in-95">
                    <h5 className="text-2xl font-black text-emerald-500 mb-2 uppercase tracking-wider">Commoners Win!</h5>
                    <p className="text-emerald-200/80 font-medium text-sm">The group guessed the word and correctly caught the Insider. Commoners + Host scored +1 point!</p>
                  </div>
                ) : null}

                <div className="text-center flex-none bg-slate-900/50 p-5 rounded-2xl border border-slate-800 w-full max-w-sm">
                  <p className="text-slate-400 mb-1 uppercase tracking-wide text-xs font-bold">The Secret Word was</p>
                  <p className="text-2xl font-black text-rose-400 mb-4">{useGameStore.getState().secretWord || "Unknown"}</p>

                  <p className="text-slate-400 mb-1 uppercase tracking-wide text-xs font-bold">The Insider was</p>
                  <p className="text-xl font-black text-slate-200">{room.players.find((p) => p.role === Role.Know)?.name || "Unknown"}</p>
                </div>

                {room.votes && Object.keys(room.votes).length > 0 && (
                  <div className="w-full flex-none max-w-sm bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-3">Voting Results</h5>
                    <div className="space-y-2">
                      {(() => {
                        const targetToVoters: Record<string, string[]> = {};
                        Object.entries(room.votes || {}).forEach(([voterId, targetId]) => {
                          if (!targetToVoters[targetId]) targetToVoters[targetId] = [];
                          targetToVoters[targetId].push(voterId);
                        });

                        const sortedTargets = Object.entries(targetToVoters).sort((a, b) => b[1].length - a[1].length);
                        const maxVotes = sortedTargets.length > 0 ? sortedTargets[0][1].length : 0;

                        return sortedTargets.map(([targetId, voterIds]) => {
                          const targetPlayer = room.players.find((p) => p.socketId === targetId);
                          if (!targetPlayer) return null;
                          const isMostVoted = voterIds.length === maxVotes && maxVotes > 0;
                          return (
                            <div key={targetId} className={`flex flex-col gap-1.5 p-2.5 rounded-xl border ${isMostVoted ? "bg-orange-950/30 border-orange-900/50" : "bg-slate-950/50 border-slate-800/80"}`}>
                              <div className="flex justify-between items-center">
                                <span className={`font-bold text-sm ${isMostVoted ? "text-orange-400" : "text-slate-200"}`}>
                                  {targetPlayer.name}
                                  {isMostVoted && <span className="ml-1.5 text-[9px] bg-orange-500/20 text-orange-400 px-1 py-0.5 rounded uppercase tracking-wider font-black">Most Voted</span>}
                                </span>
                                <span className={`text-[10px] font-black border px-1.5 py-0.5 rounded font-mono ${isMostVoted ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"}`}>
                                  {voterIds.length} {voterIds.length === 1 ? "VOTE" : "VOTES"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {voterIds.map((voterId) => {
                                  const voter = room.players.find((p) => p.socketId === voterId);
                                  return voter ? (
                                    <span key={voterId} className="text-[10px] text-slate-400 bg-slate-900/80 border border-slate-700/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                                      {voter.name}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {useGameStore.getState().socketId === room.roomHostId && (
                  <div className="w-full flex-none max-w-sm mt-4">
                    <button onClick={() => useGameStore.getState().resetRoom()} className="w-full bg-yellow-600 hover:bg-yellow-500 text-slate-950 font-black text-lg py-4 rounded-xl transition-all uppercase tracking-widest shadow-xl shadow-yellow-900/20 active:scale-[0.98]">
                      Play Again
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Phase Footer */}
        {room.status !== RoomStatus.LOBBY && (
          <footer className="flex-none p-2 sm:p-3 bg-slate-900 border border-slate-800 rounded-xl text-center shadow-xl flex items-center justify-center gap-2 sm:gap-3 w-full">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Phase</span>
            <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-full text-[10px] sm:text-xs font-black tracking-widest">{room.status === "WORD_SETTING" ? "SECRET WORD SELECTION" : room.status.replace("_", " ")}</span>
          </footer>
        )}
      </div>

      {/* Secret Word Setting Modal Handle */}
      {room.status === RoomStatus.WORD_SETTING && myRole === Role.Host && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            <div className="p-6 md:p-8 flex flex-col gap-6">
              <div className="text-center">
                <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">You are the Host</h3>
                <p className="text-slate-400 font-medium">Enter the secret word for this round. Only you and the Insider will know what it is!</p>
              </div>

              <div>
                <input
                  type="text"
                  id="secretWordModalInput"
                  placeholder="Type secret word..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-center text-xl shadow-inner mb-4"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = e.currentTarget.value.trim();
                      if (val) useGameStore.getState().setWord(val);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById("secretWordModalInput") as HTMLInputElement;
                    if (input && input.value.trim()) {
                      useGameStore.getState().setWord(input.value.trim());
                    }
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
                >
                  Confirm Secret Word
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leave Room Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-500"></div>
            <div className="p-6 md:p-8 flex flex-col gap-4 text-center">
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-rose-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-widest">Leave Room?</h3>
              <p className="text-slate-400 font-medium text-sm mb-4">
                Are you sure you want to leave the room?
                <br />
                You'll need the room code to rejoin.
              </p>

              <div className="flex gap-3 mt-2">
                <button onClick={() => setShowLeaveModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLeaveModal(false);
                    leaveRoom();
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-rose-900/20"
                >
                  Leave Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal*/}
      {showQRModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-purple-500/50 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
            <div className="p-6 md:p-8 flex flex-col items-center gap-4 text-center">
              <h3 className="text-2xl font-black text-white uppercase tracking-widest">Invite Players</h3>
              <p className="text-slate-400 font-medium text-sm mb-2">
                Scan this QR code to join room <span className="text-purple-400 font-mono font-bold">{room.code}</span>
              </p>

              <div className="bg-white p-4 rounded-2xl shadow-inner mx-auto mb-2">
                <QRCodeSVG
                  value={`${globalThis.location.origin}/?room=${room.code}`}
                  size={200}
                  bgColor={"#ffffff"}
                  fgColor={"#0f172a"} // slate-900
                  level={"H"}
                />
              </div>

              <button onClick={() => setShowQRModal(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl transition-all border border-slate-700 mt-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-slate-950">
          <h1 className="text-4xl font-bold animate-pulse text-slate-400">Loading Lobby...</h1>
        </main>
      }
    >
      <GameLobby />
      <Toaster
        position="bottom-center"
        toastOptions={{
          className: "!bg-slate-900 !text-slate-200 !border !border-slate-800 !font-bold !tracking-wide rounded-xl",
          success: { iconTheme: { primary: "#10b981", secondary: "#1e293b" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#1e293b" } },
        }}
      />
    </Suspense>
  );
}
