import { useState, useEffect, useRef } from "react";
import { GameType } from "@repo/types";
import { WhoKnowRules } from "./games/who-know/WhoKnowRules";
import { TicTacToeRules } from "./games/tic-tac-toe/TicTacToeRules";
import { GobblerRules } from "./games/gobbler/GobblerRules";
import { RPSRules } from "./games/rps/RPSRules";
import { LobbyRules } from "./games/LobbyRules";
import { SoundsFishyRules } from "./games/sounds-fishy/SoundsFishyRules";
import { DetectiveClubRules } from "./games/detective-club/DetectiveClubRules";
import { useTranslate } from "@/hooks/useTranslate";

interface RulesModalProps {
  defaultGameType?: GameType;
  isGameRoom?: boolean;
}

export function RulesModal({ defaultGameType, isGameRoom }: RulesModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<GameType | "LOBBY">(defaultGameType || "LOBBY");
  const contentRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslate();

  // When defaultGameType changes, ensure tab updates if open
  useEffect(() => {
    if (defaultGameType) {
      setActiveTab(defaultGameType);
    }
  }, [defaultGameType, isOpen]);

  // Scroll content to top when tab changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case "LOBBY":
        return <LobbyRules />;
      case GameType.WHO_KNOW:
        return <WhoKnowRules />;
      case GameType.TIC_TAC_TOE:
        return <TicTacToeRules />;
      case GameType.GOBBLER_TIC_TAC_TOE:
        return <GobblerRules />;
      case GameType.RPS:
        return <RPSRules />;
      case GameType.SOUNDS_FISHY:
        return <SoundsFishyRules />;
      case GameType.DETECTIVE_CLUB:
        return <DetectiveClubRules />;
      default:
        return null;
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="text-sm font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent hover:border-slate-800 hover:bg-slate-800/50 text-nowrap" title={t('rules.modal.title')}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
        <span className="hidden sm:inline">{t('rules.button')}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 pt-4 sm:p-4 text-left overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-2 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10 shrink-0">
              <h2 className="text-2xl font-black text-slate-100 uppercase tracking-widest flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                {t('rules.modal.title')}
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-colors" aria-label="Close rules">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {!isGameRoom && (
              <div className="bg-slate-900 pt-3 border-b border-slate-800 shrink-0">
                 <div className="flex gap-2 overflow-x-auto px-6 pb-3 no-scrollbar shrink-0">
                   <button onClick={() => setActiveTab("LOBBY")} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "LOBBY" ? 'bg-purple-500/20 text-purple-400 shadow-inner border border-purple-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>{t('rules.modal.tabs.overview')}</button>
                   <button onClick={() => setActiveTab(GameType.WHO_KNOW)} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.WHO_KNOW ? 'bg-indigo-500/20 text-indigo-400 shadow-inner border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>{t('rules.modal.tabs.whoKnow')}</button>
                   <button onClick={() => setActiveTab(GameType.GOBBLER_TIC_TAC_TOE)} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.GOBBLER_TIC_TAC_TOE ? 'bg-blue-500/20 text-blue-400 shadow-inner border border-blue-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>{t('rules.modal.tabs.gobbler')}</button>
                   <button onClick={() => setActiveTab(GameType.TIC_TAC_TOE)} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.TIC_TAC_TOE ? 'bg-zinc-500/20 text-zinc-400 shadow-inner border border-zinc-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>{t('rules.modal.tabs.ticTacToe')}</button>
                   <button onClick={() => setActiveTab(GameType.RPS)} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.RPS ? 'bg-amber-500/20 text-amber-400 shadow-inner border border-amber-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>{t('rules.modal.tabs.handDuel')}</button>
                   <button onClick={() => setActiveTab(GameType.SOUNDS_FISHY)} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.SOUNDS_FISHY ? 'bg-purple-500/20 text-purple-400 shadow-inner border border-purple-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>{t('rules.modal.tabs.soundsFishy')}</button>
                   <button onClick={() => setActiveTab(GameType.DETECTIVE_CLUB)} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === GameType.DETECTIVE_CLUB ? 'bg-slate-500/20 text-slate-300 shadow-inner border border-slate-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>Detective Club</button>
                 </div>
              </div>
            )}

            <div ref={contentRef} className="p-6 overflow-y-auto text-slate-300 bg-slate-900/50 flex-1">
              {renderContent()}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900 shrink-0">
              <button onClick={() => setIsOpen(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg py-4 rounded-xl transition-colors shadow-lg active:scale-[0.98]">
                {t('rules.modal.closeBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
