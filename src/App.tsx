import { useState, useEffect, useRef, useCallback } from 'react';
import { Country, COUNTRIES, CONTINENTS, HEMISPHERES } from './data/countries';
import {
  getTodayDateString,
  getDailyCountry,
  getTimeUntilMidnight,
  loadCompletedIds,
  saveCompletedId,
  loadDailyResults,
  saveDailyResult,
  resetGameStorage,
  DailyResult,
  QUESTS,
  QuestType,
  loadQuestStats,
  recordQuestFinished,
  getIslandHopperCountries,
  getContinentExpeditionCountries,
  getMixedCountries,
  QuestStats,
} from './utils/daily';
import { sounds } from './utils/audio';
import { CountryOutline } from './components/CountryOutline';
import { FlagMenu } from './components/FlagMenu';
import { LanguageSelector } from './components/LanguageSelector';
import {
  Volume2,
  VolumeX,
  Share2,
  RotateCcw,
  Clock,
  ArrowLeft,
  Check,
  ChevronRight,
  Heart,
  Compass,
  Zap,
} from 'lucide-react';

type Screen = 'TITLE' | 'PLAYING' | 'RESULTS' | 'GG' | 'QUESTS_MENU' | 'QUEST_RESULT';

export default function App() {
  const [screen, setScreen] = useState<Screen>('TITLE');
  const [todayDate] = useState<string>(getTodayDateString());
  const [completedIds, setCompletedIds] = useState<string[]>(() => loadCompletedIds());
  const [dailyResults, setDailyResults] = useState<Record<string, DailyResult>>(() => loadDailyResults());
  const [questStats, setQuestStats] = useState<QuestStats>(() => loadQuestStats());
  
  // Current active country
  const [currentCountry, setCurrentCountry] = useState<Country | null>(null);
  const [isDailyRun, setIsDailyRun] = useState<boolean>(true);

  // Side Quest State
  const [activeQuest, setActiveQuest] = useState<QuestType | null>(null);
  const [questQueue, setQuestQueue] = useState<Country[]>([]);
  const [questIndex, setQuestIndex] = useState<number>(0);
  const [questScore, setQuestScore] = useState<number>(0);
  const [questLives, setQuestLives] = useState<number>(3);
  const [questStreak, setQuestStreak] = useState<number>(0);
  const [selectedContinent, setSelectedContinent] = useState<string>('europe');
  const [questResultSummary, setQuestResultSummary] = useState<{
    title: string;
    score: number;
    streak?: number;
    success: boolean;
    reason?: string;
  } | null>(null);

  // Gameplay state
  const [timeLeft, setTimeLeft] = useState<number>(120); // standard 120s or blitz 60s
  const [score, setScore] = useState<number>(0);
  const [scoreDelta, setScoreDelta] = useState<{ amount: number; id: number } | null>(null);

  // Guess tracking
  const [solved, setSolved] = useState<{
    hemisphere: boolean;
    continent: boolean;
    language: boolean;
    flag: boolean;
  }>({
    hemisphere: false,
    continent: false,
    language: false,
    flag: false,
  });

  const [attempts, setAttempts] = useState<{
    hemisphere: number;
    continent: number;
    language: number;
    flag: number;
  }>({
    hemisphere: 0,
    continent: 0,
    language: 0,
    flag: 0,
  });

  const [solvedLanguageName, setSolvedLanguageName] = useState<string | null>(null);
  const [solvedFlagEmoji, setSolvedFlagEmoji] = useState<string | null>(null);

  // UI state
  const [isFlagMenuOpen, setIsFlagMenuOpen] = useState(false);
  const [shakeField, setShakeField] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => sounds.isEnabled());
  const [countdownText, setCountdownText] = useState(getTimeUntilMidnight().formatted);

  // Timer reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Refresh midnight countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownText(getTimeUntilMidnight().formatted);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check today's game setup
  const dailyData = getDailyCountry(todayDate, completedIds);
  const todayAlreadyPlayed = Boolean(dailyResults[todayDate]);

  // If all countries are completed and user is on title, show GG
  useEffect(() => {
    if (dailyData.isAllCompleted && screen === 'TITLE') {
      setScreen('GG');
    }
  }, [dailyData.isAllCompleted, screen]);

  // Audio toggle handler
  const handleToggleAudio = () => {
    const next = sounds.toggleAudio();
    setSoundEnabled(next);
  };

  // Trigger floating score delta animation
  const addScore = (delta: number) => {
    setScore((prev) => Math.max(0, prev + delta));
    setScoreDelta({ amount: delta, id: Date.now() });
    setTimeout(() => {
      setScoreDelta((current) => (current && current.id <= Date.now() ? null : current));
    }, 1200);
  };

  // Trigger shake feedback on wrong answer
  const triggerShake = (field: string) => {
    setShakeField(field);
    sounds.playWrong();
    setTimeout(() => setShakeField(null), 500);
  };

  // Start daily game handler
  const handleStartPlay = () => {
    if (dailyData.isAllCompleted) {
      setScreen('GG');
      return;
    }

    if (todayAlreadyPlayed) {
      const res = dailyResults[todayDate];
      if (res) {
        const country = COUNTRIES.find((c) => c.id === res.countryId) || dailyData.country;
        if (country) setCurrentCountry(country);
        setScreen('RESULTS');
        return;
      }
    }

    const targetCountry = dailyData.country;
    if (!targetCountry) {
      setScreen('GG');
      return;
    }

    setCurrentCountry(targetCountry);
    setIsDailyRun(true);
    setActiveQuest(null);
    setTimeLeft(120);
    setScore(0);
    setSolved({
      hemisphere: false,
      continent: false,
      language: false,
      flag: false,
    });
    setAttempts({
      hemisphere: 0,
      continent: 0,
      language: 0,
      flag: 0,
    });
    setSolvedLanguageName(null);
    setSolvedFlagEmoji(null);
    setScreen('PLAYING');
  };

  // --------------------------------------------------------------------------
  // SIDE QUEST LAUNCHERS
  // --------------------------------------------------------------------------
  const startSideQuest = (type: QuestType, continentChoice?: string) => {
    let queue: Country[] = [];
    let initialTime = 120;

    if (type === 'island_hopper') {
      queue = getIslandHopperCountries(3);
    } else if (type === 'continent_expedition') {
      const cont = continentChoice || selectedContinent;
      queue = getContinentExpeditionCountries(cont, 3);
    } else if (type === 'blitz_60s') {
      queue = getMixedCountries(25);
      initialTime = 60;
    } else if (type === 'survival_streak') {
      queue = getMixedCountries(35);
      setQuestLives(3);
      setQuestStreak(0);
    }

    if (queue.length === 0) return;

    setActiveQuest(type);
    setIsDailyRun(false);
    setQuestQueue(queue);
    setQuestIndex(0);
    setQuestScore(0);
    setCurrentCountry(queue[0]);
    setTimeLeft(initialTime);
    setScore(0);
    setSolved({
      hemisphere: false,
      continent: false,
      language: false,
      flag: false,
    });
    setAttempts({
      hemisphere: 0,
      continent: 0,
      language: 0,
      flag: 0,
    });
    setSolvedLanguageName(null);
    setSolvedFlagEmoji(null);
    setScreen('PLAYING');
  };

  // Advance to next country in side quest
  const advanceQuestCountry = () => {
    const nextIdx = questIndex + 1;
    const currentTotalScore = questScore + score;
    setQuestScore(currentTotalScore);

    if (activeQuest === 'survival_streak') {
      const newStreak = questStreak + 1;
      setQuestStreak(newStreak);
    }

    // Check if quest completed
    const maxCountries = activeQuest === 'island_hopper' || activeQuest === 'continent_expedition' ? 3 : questQueue.length;

    if (nextIdx >= maxCountries) {
      // Completed quest!
      sounds.playVictory();
      const finalStats = recordQuestFinished(
        activeQuest === 'survival_streak' ? questStreak + 1 : 0,
        activeQuest === 'blitz_60s' ? currentTotalScore : 0
      );
      setQuestStats(finalStats);
      setQuestResultSummary({
        title: activeQuest === 'island_hopper' ? 'island hopper conquered' : 'continent expedition conquered',
        score: currentTotalScore,
        streak: questStreak + 1,
        success: true,
      });
      setScreen('QUEST_RESULT');
      return;
    }

    // Move to next country
    setQuestIndex(nextIdx);
    setCurrentCountry(questQueue[nextIdx]);
    setScore(0);
    setSolved({
      hemisphere: false,
      continent: false,
      language: false,
      flag: false,
    });
    setAttempts({
      hemisphere: 0,
      continent: 0,
      language: 0,
      flag: 0,
    });
    setSolvedLanguageName(null);
    setSolvedFlagEmoji(null);
    sounds.playCorrect();
  };

  // Finish daily round
  const handleFinishRound = useCallback((timeout = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (!currentCountry) return;

    if (isDailyRun) {
      sounds.playVictory();
      const timeSpent = 120 - timeLeft;
      const finalResult: DailyResult = {
        date: todayDate,
        countryId: currentCountry.id,
        countryName: currentCountry.name,
        score: score,
        timeRemaining: timeLeft,
        timeSpent: timeSpent,
        attempts: attempts,
        solved: solved,
        completedAt: Date.now(),
      };

      saveDailyResult(finalResult);
      const updated = saveCompletedId(currentCountry.id);
      setCompletedIds(updated);
      setDailyResults((prev) => ({ ...prev, [todayDate]: finalResult }));
      setScreen('RESULTS');
    } else {
      // Side quest timeout / finish
      const finalTotalScore = questScore + score;
      const finalStats = recordQuestFinished(
        activeQuest === 'survival_streak' ? questStreak : 0,
        activeQuest === 'blitz_60s' ? finalTotalScore : 0
      );
      setQuestStats(finalStats);

      setQuestResultSummary({
        title: activeQuest ? activeQuest.replace('_', ' ') : 'side quest',
        score: finalTotalScore,
        streak: questStreak,
        success: timeout ? false : true,
        reason: timeout ? 'time ran out' : 'conquered',
      });
      setScreen('QUEST_RESULT');
    }
  }, [currentCountry, timeLeft, score, attempts, solved, todayDate, isDailyRun, activeQuest, questScore, questStreak]);

  // Timer loop when playing
  useEffect(() => {
    if (screen === 'PLAYING') {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleFinishRound(true);
            return 0;
          }
          if (prev <= 11) {
            sounds.playTick();
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [screen, handleFinishRound]);

  // Win condition listener for countries
  useEffect(() => {
    if (screen === 'PLAYING') {
      if (solved.hemisphere && solved.continent && solved.language && solved.flag) {
        if (!isDailyRun) {
          // In side quests, advance to next country
          advanceQuestCountry();
        } else {
          // Daily complete
          handleFinishRound(false);
        }
      }
    }
  }, [solved, screen, isDailyRun, handleFinishRound]);

  // Handle wrong attempt in quest (life loss in survival)
  const handleWrongAttempt = (field: string) => {
    addScore(-200);
    triggerShake(field);

    if (activeQuest === 'survival_streak') {
      setQuestLives((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          // Game over in survival streak
          sounds.playWrong();
          const finalTotal = questScore + score;
          const stats = recordQuestFinished(questStreak, 0);
          setQuestStats(stats);
          setQuestResultSummary({
            title: 'survival streak ended',
            score: finalTotal,
            streak: questStreak,
            success: false,
            reason: 'ran out of lives',
          });
          setScreen('QUEST_RESULT');
          return 0;
        }
        return next;
      });
    }
  };

  // Guess Handlers:
  // 1. Hemisphere
  const handleGuessHemisphere = (guessed: 'northern' | 'southern' | 'equator') => {
    if (solved.hemisphere || !currentCountry) return;
    setAttempts((prev) => ({ ...prev, hemisphere: prev.hemisphere + 1 }));

    const target = currentCountry.hemisphere;
    const isCorrect =
      guessed === target ||
      (target === 'equator' && (guessed === 'northern' || guessed === 'southern' || guessed === 'equator'));

    if (isCorrect) {
      sounds.playCorrect();
      addScore(1000);
      setSolved((prev) => ({ ...prev, hemisphere: true }));
    } else {
      handleWrongAttempt('hemisphere');
    }
  };

  // 2. Continent
  const handleGuessContinent = (guessedContinent: string) => {
    if (solved.continent || !currentCountry) return;
    setAttempts((prev) => ({ ...prev, continent: prev.continent + 1 }));

    if (guessedContinent.toLowerCase() === currentCountry.continent.toLowerCase()) {
      sounds.playCorrect();
      addScore(1000);
      setSolved((prev) => ({ ...prev, continent: true }));
    } else {
      handleWrongAttempt('continent');
    }
  };

  // 3. Language
  const handleGuessLanguage = (guessedLanguage: string) => {
    if (solved.language || !currentCountry) return;
    setAttempts((prev) => ({ ...prev, language: prev.language + 1 }));

    const normalizedGuess = guessedLanguage.toLowerCase().trim();
    const isCorrect = currentCountry.languages.some(
      (lang) => lang.toLowerCase().trim() === normalizedGuess
    );

    if (isCorrect) {
      sounds.playCorrect();
      addScore(1000);
      setSolved((prev) => ({ ...prev, language: true }));
      setSolvedLanguageName(normalizedGuess);
    } else {
      handleWrongAttempt('language');
    }
  };

  // 4. Flag
  const handleSelectFlag = (pickedCountry: Country) => {
    if (solved.flag || !currentCountry) return;
    setAttempts((prev) => ({ ...prev, flag: prev.flag + 1 }));

    if (pickedCountry.id === currentCountry.id) {
      sounds.playCorrect();
      addScore(1000);
      setSolved((prev) => ({ ...prev, flag: true }));
      setSolvedFlagEmoji(pickedCountry.flagEmoji);
    } else {
      handleWrongAttempt('flag');
    }
  };

  // Reset entire game
  const handleResetGame = () => {
    resetGameStorage();
    setCompletedIds([]);
    setDailyResults({});
    setScore(0);
    setScreen('TITLE');
  };

  // Format seconds to mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Share daily results
  const handleShare = () => {
    if (!currentCountry) return;
    const timeSpent = 120 - timeLeft;
    const mins = Math.floor(timeSpent / 60);
    const secs = timeSpent % 60;
    const timeFormatted = `${mins}:${String(secs).padStart(2, '0')}`;

    const text = [
      `terra · ${todayDate}`,
      `score: ${score} / 4000`,
      `⏱️ ${timeFormatted} / 2:00`,
      `🌐 hemisphere: ${solved.hemisphere ? '🟩' : '🟥'} (${attempts.hemisphere} att)`,
      `🧭 continent: ${solved.continent ? '🟩' : '🟥'} (${attempts.continent} att)`,
      `🗣️ language: ${solved.language ? '🟩' : '🟥'} (${attempts.language} att)`,
      `🚩 flag: ${solved.flag ? '🟩' : '🟥'} (${attempts.flag} att)`,
      ``,
      `terra by misiori · misiori.github.io`,
    ].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 2000);
      });
    }

    if (navigator.share) {
      navigator.share({
        title: 'terra - guess the country',
        text: text,
      }).catch(() => {});
    }
  };

  // --------------------------------------------------------------------------
  // SCREEN 1: TITLE SCREEN
  // Minimalist lowercase layout: headbang font logo, description, play button,
  // credit by misiori in Caveat, and side quests section when daily is done!
  // --------------------------------------------------------------------------
  if (screen === 'TITLE') {
    return (
      <main className="min-h-screen flex flex-col justify-between items-center px-6 py-10 sm:py-14 text-center select-none bg-[#090a0c]">
        {/* Top quiet sound indicator */}
        <div className="w-full max-w-md flex justify-end">
          <button
            onClick={handleToggleAudio}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title={soundEnabled ? 'mute audio' : 'unmute audio'}
            aria-label="toggle sound"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>

        {/* Center Minimalist Brand & Action */}
        <div className="flex flex-col items-center justify-center my-auto space-y-6 max-w-sm w-full">
          {/* Logo headbang font, everything in lower case */}
          <h1 className="text-7xl sm:text-8xl font-headbang tracking-wider text-zinc-100 lowercase drop-shadow-[0_4px_16px_rgba(255,255,255,0.08)]">
            terra
          </h1>

          {/* Small description: guess the country! */}
          <p className="text-xs sm:text-sm font-mono tracking-widest text-zinc-500 lowercase">
            guess the country!
          </p>

          {/* Button play */}
          <div className="pt-2 flex flex-col items-center gap-3 w-full">
            <button
              onClick={handleStartPlay}
              className="px-8 py-3 w-48 bg-zinc-100 hover:bg-white text-zinc-950 font-mono text-sm font-medium tracking-wider lowercase transition-all duration-150 active:scale-98 shadow-sm hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            >
              {todayAlreadyPlayed ? 'view daily' : 'play'}
            </button>

            {todayAlreadyPlayed ? (
              <div className="space-y-1 pt-1">
                <span className="text-[11px] font-mono text-zinc-400 lowercase tracking-tight block">
                  daily completed · next country in {countdownText}
                </span>
                <span className="text-[11px] font-mono text-zinc-600 block">
                  {completedIds.length} / {COUNTRIES.length} countries conquered
                </span>
              </div>
            ) : null}

            {/* Side Quests button / section */}
            <div className="pt-3 w-full">
              <button
                onClick={() => setScreen('QUESTS_MENU')}
                className="w-full py-2.5 px-4 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 rounded text-xs font-mono text-zinc-300 hover:text-white transition-all lowercase flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Compass size={14} className="text-zinc-400" />
                  <span>side quests</span>
                </span>
                <span className="text-[11px] text-zinc-500">
                  {questStats.questsFinished} completed →
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Credit: this game is made by misiori (written in caveat), link to the websiteis misiori.github.io. */}
        <footer className="w-full text-center pt-8">
          <p className="text-xs text-zinc-600 font-mono lowercase">
            this game is made by{' '}
            <a
              href="https://misiori.github.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-caveat text-base text-zinc-400 hover:text-zinc-100 transition-colors inline-block ml-0.5 underline decoration-zinc-700 underline-offset-3"
            >
              misiori
            </a>
          </p>
        </footer>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: SIDE QUESTS MENU
  // Replayable side quests when daily challenge is completed
  // --------------------------------------------------------------------------
  if (screen === 'QUESTS_MENU') {
    return (
      <main className="min-h-screen flex flex-col justify-between items-center px-4 py-8 max-w-xl mx-auto select-none bg-[#090a0c]">
        {/* Header */}
        <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-4">
          <button
            onClick={() => setScreen('TITLE')}
            className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-100 lowercase transition-colors"
          >
            <ArrowLeft size={14} />
            <span>menu</span>
          </button>
          <span className="font-headbang text-xl text-zinc-300 lowercase">terra</span>
          <span className="text-xs font-mono text-zinc-500 lowercase">
            side quests
          </span>
        </div>

        {/* Quests List */}
        <div className="w-full py-6 space-y-4">
          <div className="text-left space-y-1">
            <h2 className="text-sm font-mono text-zinc-200 lowercase">available side quests</h2>
            <p className="text-xs font-mono text-zinc-500 lowercase">
              expeditions, speed runs & endurance challenges across 195 countries.
            </p>
          </div>

          <div className="space-y-3">
            {/* 1. Island Hopper */}
            <button
              onClick={() => startSideQuest('island_hopper')}
              className="w-full text-left p-4 bg-[#111215] hover:bg-zinc-800/60 border border-zinc-800 hover:border-zinc-700/80 rounded transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-zinc-200 group-hover:text-white flex items-center gap-2 lowercase font-medium">
                  <span>🏝️</span>
                  <span>island hopper</span>
                </span>
                <span className="text-[11px] font-mono text-zinc-500 group-hover:text-zinc-300">
                  3 nations
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-500 lowercase">
                guess 3 archipelago and island nations from across the world.
              </p>
            </button>

            {/* 2. Continent Expedition */}
            <div className="p-4 bg-[#111215] border border-zinc-800 rounded space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-200 flex items-center gap-2 lowercase font-medium">
                  <span>🧭</span>
                  <span>continent expedition</span>
                </span>
                <span className="text-[11px] font-mono text-zinc-500">
                  3 nations
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-500 lowercase">
                select a continent to test your regional geography:
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {CONTINENTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setSelectedContinent(c);
                      startSideQuest('continent_expedition', c);
                    }}
                    className="py-1 px-2 text-[11px] font-mono lowercase border border-zinc-800 hover:border-zinc-600 rounded bg-zinc-900 text-zinc-300 hover:text-white transition-colors truncate"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Blitz 60s */}
            <button
              onClick={() => startSideQuest('blitz_60s')}
              className="w-full text-left p-4 bg-[#111215] hover:bg-zinc-800/60 border border-zinc-800 hover:border-zinc-700/80 rounded transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-zinc-200 group-hover:text-white flex items-center gap-2 lowercase font-medium">
                  <span>⚡</span>
                  <span>blitz 60s</span>
                </span>
                <span className="text-[11px] font-mono text-zinc-500 group-hover:text-zinc-300">
                  best: {questStats.bestBlitz} pts
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-500 lowercase">
                60 seconds clock: guess attributes as fast as possible.
              </p>
            </button>

            {/* 4. Survival Streak */}
            <button
              onClick={() => startSideQuest('survival_streak')}
              className="w-full text-left p-4 bg-[#111215] hover:bg-zinc-800/60 border border-zinc-800 hover:border-zinc-700/80 rounded transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-zinc-200 group-hover:text-white flex items-center gap-2 lowercase font-medium">
                  <span>❤️</span>
                  <span>survival streak</span>
                </span>
                <span className="text-[11px] font-mono text-zinc-500 group-hover:text-zinc-300">
                  best: {questStats.bestStreak} streak
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-500 lowercase">
                endless mixed country run with 3 lives. any mistake costs a heart.
              </p>
            </button>
          </div>
        </div>

        {/* Footer Credit */}
        <footer className="w-full text-center pt-6 border-t border-zinc-900">
          <p className="text-xs text-zinc-600 font-mono lowercase">
            this game is made by{' '}
            <a
              href="https://misiori.github.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-caveat text-base text-zinc-400 hover:text-zinc-100 transition-colors inline-block underline decoration-zinc-700 underline-offset-3"
            >
              misiori
            </a>
          </p>
        </footer>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: QUEST RESULT
  // --------------------------------------------------------------------------
  if (screen === 'QUEST_RESULT' && questResultSummary) {
    return (
      <main className="min-h-screen flex flex-col justify-between items-center px-4 py-8 max-w-xl mx-auto select-none bg-[#090a0c]">
        {/* Header */}
        <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-4">
          <button
            onClick={() => setScreen('QUESTS_MENU')}
            className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-100 lowercase transition-colors"
          >
            <ArrowLeft size={14} />
            <span>quests</span>
          </button>
          <span className="font-headbang text-xl text-zinc-300 lowercase">terra</span>
          <span className="text-xs font-mono text-zinc-500 lowercase">summary</span>
        </div>

        {/* Content */}
        <div className="w-full py-8 text-center space-y-6 my-auto">
          <div className="space-y-2">
            <span className="text-3xl">
              {questResultSummary.success ? '🏆' : '💀'}
            </span>
            <h2 className="text-2xl font-mono font-semibold text-zinc-100 lowercase">
              {questResultSummary.title}
            </h2>
            {questResultSummary.reason && (
              <p className="text-xs font-mono text-zinc-500 lowercase">
                {questResultSummary.reason}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto p-4 bg-zinc-900/40 border border-zinc-800 rounded font-mono text-center">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block tracking-wider">score</span>
              <span className="text-2xl font-medium text-zinc-100">{questResultSummary.score}</span>
              <span className="text-xs text-zinc-600 block">pts</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block tracking-wider">streak</span>
              <span className="text-2xl font-medium text-zinc-100">
                {questResultSummary.streak || 0}
              </span>
              <span className="text-xs text-zinc-600 block">countries</span>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-2 max-w-xs mx-auto w-full">
            <button
              onClick={() => {
                if (activeQuest) startSideQuest(activeQuest);
                else setScreen('QUESTS_MENU');
              }}
              className="w-full py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-mono text-xs font-semibold lowercase transition-all active:scale-98"
            >
              play again
            </button>
            <button
              onClick={() => setScreen('TITLE')}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs font-mono text-zinc-300 hover:text-white transition-colors lowercase"
            >
              back to main menu
            </button>
          </div>
        </div>

        {/* Footer Credit */}
        <footer className="w-full text-center pt-6 border-t border-zinc-900">
          <p className="text-xs text-zinc-600 font-mono lowercase">
            this game is made by{' '}
            <a
              href="https://misiori.github.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-caveat text-base text-zinc-400 hover:text-zinc-100 transition-colors inline-block underline decoration-zinc-700 underline-offset-3"
            >
              misiori
            </a>
          </p>
        </footer>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 4: GG SCREEN (When all 195 countries have been completed)
  // "when there are no other countries left to guess anymore, it says GG, and u just reset the game to start over."
  // --------------------------------------------------------------------------
  if (screen === 'GG') {
    return (
      <main className="min-h-screen flex flex-col justify-between items-center px-6 py-12 text-center select-none bg-[#090a0c]">
        <div />

        <div className="flex flex-col items-center justify-center my-auto space-y-6 max-w-md w-full">
          <h1 className="text-8xl sm:text-9xl font-headbang tracking-wider text-zinc-100 lowercase">
            gg
          </h1>

          <div className="space-y-1">
            <p className="text-sm font-mono text-zinc-300 lowercase">
              no countries left to guess on terra.
            </p>
            <p className="text-xs font-mono text-zinc-500 lowercase">
              you have conquered all {COUNTRIES.length} nations across the globe.
            </p>
          </div>

          <div className="pt-4 flex flex-col items-center gap-3">
            <button
              onClick={handleResetGame}
              className="flex items-center gap-2 px-8 py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-mono text-sm tracking-wider lowercase transition-all active:scale-98"
            >
              <RotateCcw size={14} />
              <span>reset game</span>
            </button>
          </div>
        </div>

        <footer className="w-full text-center pt-8">
          <p className="text-xs text-zinc-600 font-mono lowercase">
            this game is made by{' '}
            <a
              href="https://misiori.github.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-caveat text-base text-zinc-400 hover:text-zinc-100 transition-colors inline-block underline decoration-zinc-700 underline-offset-3"
            >
              misiori
            </a>
          </p>
        </footer>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 3: RESULTS SCREEN
  // Displays country outline revealed, scores, breakdown, share button, countdown
  // --------------------------------------------------------------------------
  if (screen === 'RESULTS' && currentCountry) {
    return (
      <main className="min-h-screen flex flex-col justify-between items-center px-4 py-8 max-w-xl mx-auto select-none bg-[#090a0c]">
        {/* Header */}
        <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-4">
          <button
            onClick={() => setScreen('TITLE')}
            className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-100 lowercase transition-colors"
          >
            <ArrowLeft size={14} />
            <span>menu</span>
          </button>
          <span className="font-headbang text-xl text-zinc-300 lowercase">terra</span>
          <span className="text-xs font-mono text-zinc-500 lowercase">
            {todayDate}
          </span>
        </div>

        {/* Content */}
        <div className="w-full py-6 space-y-6">
          {/* Revealed Country */}
          <div className="flex flex-col items-center text-center space-y-3">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
              country revealed
            </span>
            <div className="flex items-center gap-3">
              <span className="text-4xl drop-shadow-sm">{currentCountry.flagEmoji}</span>
              <h2 className="text-3xl font-mono font-semibold text-zinc-100 lowercase">
                {currentCountry.name}
              </h2>
            </div>
          </div>

          {/* Country outline silhouette */}
          <div className="w-full max-w-[280px] mx-auto">
            <CountryOutline country={currentCountry} revealed={true} />
          </div>

          {/* Score & Time banner */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-zinc-900/40 border border-zinc-800 rounded font-mono text-center">
            <div>
              <span className="text-[11px] text-zinc-500 uppercase block tracking-wider">score</span>
              <span className="text-2xl font-medium text-zinc-100">{score}</span>
              <span className="text-xs text-zinc-600 block">/ 4000 pts</span>
            </div>
            <div>
              <span className="text-[11px] text-zinc-500 uppercase block tracking-wider">time</span>
              <span className="text-2xl font-medium text-zinc-100">
                {formatTimer(120 - timeLeft)}
              </span>
              <span className="text-xs text-zinc-600 block">of 2:00</span>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between p-2.5 bg-zinc-900/20 border border-zinc-800/80 rounded">
              <span className="text-zinc-400 lowercase">hemisphere</span>
              <div className="flex items-center gap-2">
                <span className="text-zinc-200 lowercase">{currentCountry.hemisphere}</span>
                <span className={solved.hemisphere ? 'text-emerald-400' : 'text-rose-400'}>
                  {solved.hemisphere ? `+1000 (${attempts.hemisphere} att)` : 'missed'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-zinc-900/20 border border-zinc-800/80 rounded">
              <span className="text-zinc-400 lowercase">continent</span>
              <div className="flex items-center gap-2">
                <span className="text-zinc-200 lowercase">{currentCountry.continent}</span>
                <span className={solved.continent ? 'text-emerald-400' : 'text-rose-400'}>
                  {solved.continent ? `+1000 (${attempts.continent} att)` : 'missed'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-zinc-900/20 border border-zinc-800/80 rounded">
              <span className="text-zinc-400 lowercase">official language</span>
              <div className="flex items-center gap-2">
                <span className="text-zinc-200 lowercase">{currentCountry.languages.join(', ')}</span>
                <span className={solved.language ? 'text-emerald-400' : 'text-rose-400'}>
                  {solved.language ? `+1000 (${attempts.language} att)` : 'missed'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-zinc-900/20 border border-zinc-800/80 rounded">
              <span className="text-zinc-400 lowercase">flag</span>
              <div className="flex items-center gap-2">
                <span className="text-base">{currentCountry.flagEmoji}</span>
                <span className={solved.flag ? 'text-emerald-400' : 'text-rose-400'}>
                  {solved.flag ? `+1000 (${attempts.flag} att)` : 'missed'}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 space-y-3">
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-mono text-xs font-semibold lowercase transition-all active:scale-98"
            >
              <Share2 size={14} />
              <span>{copyToast ? 'copied to clipboard!' : 'share results'}</span>
            </button>

            {/* Jump straight to side quests */}
            <button
              onClick={() => setScreen('QUESTS_MENU')}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs font-mono text-zinc-300 hover:text-white transition-colors lowercase"
            >
              <Compass size={14} />
              <span>play side quests →</span>
            </button>

            <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pt-2 px-1">
              <span>next daily in {countdownText}</span>
              <span>{COUNTRIES.length - completedIds.length} countries remaining</span>
            </div>
          </div>
        </div>

        {/* Footer Credit */}
        <footer className="w-full text-center pt-6 border-t border-zinc-900">
          <p className="text-xs text-zinc-600 font-mono lowercase">
            this game is made by{' '}
            <a
              href="https://misiori.github.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-caveat text-base text-zinc-400 hover:text-zinc-100 transition-colors inline-block underline decoration-zinc-700 underline-offset-3"
            >
              misiori
            </a>
          </p>
        </footer>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 2: ACTIVE PLAYING SCREEN (Daily Challenge or Side Quest)
  // --------------------------------------------------------------------------
  return (
    <main className="min-h-screen flex flex-col justify-between max-w-2xl mx-auto px-4 py-5 select-none bg-[#090a0c]">
      {/* Top HUD: Exit, Timer, Score/Quest Indicator, Audio */}
      <header className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <button
          onClick={() => setScreen(isDailyRun ? 'TITLE' : 'QUESTS_MENU')}
          className="flex items-center gap-1 text-xs font-mono text-zinc-400 hover:text-zinc-200 lowercase transition-colors"
        >
          <ArrowLeft size={14} />
          <span>quit</span>
        </button>

        {/* Quest progress indicator / Timer */}
        <div className="flex items-center gap-3">
          {!isDailyRun && (
            <span className="text-[11px] font-mono text-zinc-400 lowercase">
              {activeQuest === 'island_hopper' && `island ${questIndex + 1}/3`}
              {activeQuest === 'continent_expedition' && `${selectedContinent} ${questIndex + 1}/3`}
              {activeQuest === 'blitz_60s' && `blitz`}
              {activeQuest === 'survival_streak' && (
                <span className="flex items-center gap-1 text-rose-400">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Heart
                      key={i}
                      size={12}
                      className={i < questLives ? 'fill-rose-500 text-rose-500' : 'text-zinc-700'}
                    />
                  ))}
                  <span className="text-zinc-400 ml-1">streak: {questStreak}</span>
                </span>
              )}
            </span>
          )}

          <div className="flex items-center gap-1.5">
            <Clock size={14} className={timeLeft <= 15 ? 'text-rose-400 animate-pulse' : 'text-zinc-500'} />
            <span
              className={`font-mono text-sm tracking-wider font-semibold ${
                timeLeft <= 15 ? 'text-rose-400' : 'text-zinc-200'
              }`}
            >
              {formatTimer(timeLeft)}
            </span>
          </div>
        </div>

        {/* Live Score Counter with Floating Delta */}
        <div className="relative flex items-center gap-3">
          <div className="text-right font-mono">
            <span className="text-[10px] text-zinc-500 block uppercase">score</span>
            <span className="text-sm font-semibold text-zinc-100">
              {isDailyRun ? score : questScore + score}
            </span>
          </div>

          {scoreDelta && (
            <div
              key={scoreDelta.id}
              className={`absolute -top-3 right-8 text-xs font-mono font-bold animate-out fade-out slide-out-to-top duration-1000 ${
                scoreDelta.amount > 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {scoreDelta.amount > 0 ? `+${scoreDelta.amount}` : scoreDelta.amount}
            </div>
          )}

          <button
            onClick={handleToggleAudio}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="toggle sound"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        </div>
      </header>

      {/* Main Playing Area */}
      {currentCountry && (
        <div className="flex-1 py-4 flex flex-col justify-center space-y-4">
          {/* Country outline visualization */}
          <div className="w-full">
            <CountryOutline country={currentCountry} />
          </div>

          {/* 4 Interactive Guess Categories */}
          <div className="space-y-3 max-w-xl mx-auto w-full">
            {/* 1. Hemisphere */}
            <div
              className={`p-3 bg-[#111215] border rounded transition-all duration-200 ${
                shakeField === 'hemisphere'
                  ? 'border-rose-500 bg-rose-950/20 translate-x-1'
                  : solved.hemisphere
                  ? 'border-emerald-900/60 bg-emerald-950/20'
                  : 'border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-zinc-400 lowercase">
                  1. hemisphere
                </span>
                {solved.hemisphere ? (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <Check size={12} /> solved (+1000)
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-zinc-500">
                    {attempts.hemisphere > 0 ? `${attempts.hemisphere} att (-${attempts.hemisphere * 200})` : '+1000 / -200'}
                  </span>
                )}
              </div>

              {solved.hemisphere ? (
                <div className="text-xs font-mono text-emerald-300 lowercase px-1 py-0.5">
                  ✓ {currentCountry.hemisphere === 'equator' ? 'crosses equator' : currentCountry.hemisphere}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {HEMISPHERES.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => handleGuessHemisphere(h.id)}
                      className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 rounded text-xs font-mono text-zinc-200 hover:text-white lowercase transition-colors"
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Continent */}
            <div
              className={`p-3 bg-[#111215] border rounded transition-all duration-200 ${
                shakeField === 'continent'
                  ? 'border-rose-500 bg-rose-950/20 translate-x-1'
                  : solved.continent
                  ? 'border-emerald-900/60 bg-emerald-950/20'
                  : 'border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-zinc-400 lowercase">
                  2. continent
                </span>
                {solved.continent ? (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <Check size={12} /> solved (+1000)
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-zinc-500">
                    {attempts.continent > 0 ? `${attempts.continent} att (-${attempts.continent * 200})` : '+1000 / -200'}
                  </span>
                )}
              </div>

              {solved.continent ? (
                <div className="text-xs font-mono text-emerald-300 lowercase px-1 py-0.5">
                  ✓ {currentCountry.continent}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CONTINENTS.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleGuessContinent(c)}
                      className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 rounded text-xs font-mono text-zinc-200 hover:text-white lowercase transition-colors text-center"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Language (at least one official) */}
            <div
              className={`p-3 bg-[#111215] border rounded transition-all duration-200 ${
                shakeField === 'language'
                  ? 'border-rose-500 bg-rose-950/20 translate-x-1'
                  : solved.language
                  ? 'border-emerald-900/60 bg-emerald-950/20'
                  : 'border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-zinc-400 lowercase">
                  3. language (at least one official)
                </span>
                {solved.language ? (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <Check size={12} /> solved (+1000)
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-zinc-500">
                    {attempts.language > 0 ? `${attempts.language} att (-${attempts.language * 200})` : '+1000 / -200'}
                  </span>
                )}
              </div>

              <LanguageSelector
                onGuessLanguage={handleGuessLanguage}
                disabled={solved.language}
                solvedLanguage={solvedLanguageName}
              />
            </div>

            {/* 4. Flag (choose from menu, find by country) */}
            <div
              className={`p-3 bg-[#111215] border rounded transition-all duration-200 ${
                shakeField === 'flag'
                  ? 'border-rose-500 bg-rose-950/20 translate-x-1'
                  : solved.flag
                  ? 'border-emerald-900/60 bg-emerald-950/20'
                  : 'border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-zinc-400 lowercase">
                  4. flag
                </span>
                {solved.flag ? (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <Check size={12} /> solved (+1000)
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-zinc-500">
                    {attempts.flag > 0 ? `${attempts.flag} att (-${attempts.flag * 200})` : '+1000 / -200'}
                  </span>
                )}
              </div>

              {solved.flag ? (
                <div className="flex items-center justify-between p-2 bg-emerald-950/20 border border-emerald-900/40 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{solvedFlagEmoji}</span>
                    <span className="text-xs font-mono text-emerald-300 lowercase">
                      flag matched!
                    </span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-semibold">+1000</span>
                </div>
              ) : (
                <button
                  onClick={() => setIsFlagMenuOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 rounded text-xs font-mono text-zinc-200 transition-colors group"
                >
                  <span className="text-zinc-400 group-hover:text-zinc-200">
                    choose flag from menu (search by country)...
                  </span>
                  <ChevronRight size={14} className="text-zinc-500 group-hover:text-zinc-300" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Flag Selector Modal */}
      <FlagMenu
        isOpen={isFlagMenuOpen}
        onClose={() => setIsFlagMenuOpen(false)}
        onSelectFlag={handleSelectFlag}
        disabled={solved.flag}
      />

      {/* Footer minimal credit */}
      <footer className="w-full text-center pt-3 border-t border-zinc-900">
        <p className="text-xs text-zinc-600 font-mono lowercase">
          this game is made by{' '}
          <a
            href="https://misiori.github.io"
            target="_blank"
            rel="noopener noreferrer"
            className="font-caveat text-base text-zinc-400 hover:text-zinc-100 transition-colors inline-block underline decoration-zinc-700 underline-offset-3"
          >
            misiori
          </a>
        </p>
      </footer>
    </main>
  );
}
