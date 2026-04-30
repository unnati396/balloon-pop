import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Dimensions,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import Balloon, { BALLOON_COLORS } from './components/Balloon';

const windowWidth = Dimensions.get('window').width;

const INITIAL_COUNT = 20;
const BALLOON_SIZE = 55;
const SURVIVAL_MAX_MISSED = 10;
const TIMED_DURATION = 60;

const STORAGE_KEY_TIMED = '@balloon_highscore_timed';
const STORAGE_KEY_SURVIVAL = '@balloon_highscore_survival';

const makeBalloon = () => ({
  alive: true,
  x: Math.random() * (windowWidth - BALLOON_SIZE),
  colorIndex: Math.floor(Math.random() * BALLOON_COLORS.length),
  durationSeed: 1 + Math.random() * 3,
});

// ─── Sound Manager ─────────────────────────────────────────

const SoundManager = {
  popSound: null,
  gameOverSound: null,

  async load() {
    try {
      const { sound: pop } = await Audio.Sound.createAsync(
        require('./assets/pop.mp3'),
        { shouldPlay: false, volume: 0.6 }
      );
      this.popSound = pop;
    } catch (e) {
      // Sound file may not exist yet — gracefully skip
    }
  },

  async playPop() {
    try {
      if (this.popSound) {
        await this.popSound.replayAsync();
      }
    } catch (e) {}
  },

  async unload() {
    try {
      if (this.popSound) await this.popSound.unloadAsync();
    } catch (e) {}
  },
};

// ─── High Score helpers ────────────────────────────────────

const getHighScore = async (mode) => {
  try {
    const key = mode === 'timed' ? STORAGE_KEY_TIMED : STORAGE_KEY_SURVIVAL;
    const val = await AsyncStorage.getItem(key);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
};

const saveHighScore = async (mode, score) => {
  try {
    const key = mode === 'timed' ? STORAGE_KEY_TIMED : STORAGE_KEY_SURVIVAL;
    const prev = await getHighScore(mode);
    if (score > prev) {
      await AsyncStorage.setItem(key, String(score));
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// ─── Haptic helper (no-op on web) ──────────────────────────

const triggerHaptic = (style) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch {}
};

// ─── Mode Selection ────────────────────────────────────────

const ModeSelect = ({ onSelect, highScores }) => (
  <View style={styles.modeOverlay}>
    <View style={styles.skyTop} />
    <View style={styles.skyMiddle} />
    <View style={styles.skyBottom} />

    <View style={styles.modeContent}>
      <Text style={styles.modeTitle}>{'🎈'} Balloon Pop</Text>
      <Text style={styles.modeSubtitle}>Choose a game mode</Text>

      <TouchableOpacity
        style={[styles.modeCard, { borderColor: '#FF9FF3' }]}
        onPress={() => onSelect('timed')}
      >
        <Text style={styles.modeCardEmoji}>{'⏱️'}</Text>
        <View style={styles.modeCardText}>
          <Text style={styles.modeCardTitle}>Time Attack</Text>
          <Text style={styles.modeCardDesc}>
            Pop as many balloons as you can in 60 seconds
          </Text>
          {highScores.timed > 0 && (
            <Text style={styles.modeCardHighScore}>
              {'🏆'} Best: {highScores.timed} pops
            </Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.modeCard, { borderColor: '#70A1FF' }]}
        onPress={() => onSelect('survival')}
      >
        <Text style={styles.modeCardEmoji}>{'💀'}</Text>
        <View style={styles.modeCardText}>
          <Text style={styles.modeCardTitle}>Survival</Text>
          <Text style={styles.modeCardDesc}>
            Keep popping — game ends after 10 missed balloons
          </Text>
          {highScores.survival > 0 && (
            <Text style={styles.modeCardHighScore}>
              {'🏆'} Best: {highScores.survival} pops
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>

    <View style={styles.ground} />
  </View>
);

// ─── Balloons ──────────────────────────────────────────────

const BalloonsWrapper = memo(({ balloons, onFinish, onBurst, burstCount }) => {
  return balloons.map((b, index) => {
    if (!b.alive) return null;
    return (
      <Balloon
        key={index}
        id={index}
        x={b.x}
        colorIndex={b.colorIndex}
        onFinish={onFinish}
        onBurst={onBurst}
        balloonSize={BALLOON_SIZE}
        duration={(2000 + Math.max(0, 500 - burstCount * 8)) * b.durationSeed}
      />
    );
  });
});

// ─── HUD ───────────────────────────────────────────────────

const ScoreHUD = ({ mode, burstCount, missedCount, timeLeft }) => (
  <View style={styles.hud}>
    {mode === 'timed' && (
      <>
        <View style={styles.hudItem}>
          <Text style={styles.hudEmoji}>{'⏱️'}</Text>
          <Text style={[styles.hudValue, timeLeft <= 10 && styles.hudDanger]}>
            {timeLeft}s
          </Text>
          <Text style={styles.hudLabel}>Time</Text>
        </View>
        <View style={styles.hudDivider} />
      </>
    )}

    <View style={styles.hudItem}>
      <Text style={styles.hudEmoji}>{'💥'}</Text>
      <Text style={styles.hudValue}>{burstCount}</Text>
      <Text style={styles.hudLabel}>Popped</Text>
    </View>
    <View style={styles.hudDivider} />

    <View style={styles.hudItem}>
      <Text style={styles.hudEmoji}>{'💨'}</Text>
      <Text
        style={[
          styles.hudValue,
          mode === 'survival' && missedCount >= SURVIVAL_MAX_MISSED - 2 && styles.hudDanger,
        ]}
      >
        {mode === 'survival' ? `${missedCount}/${SURVIVAL_MAX_MISSED}` : missedCount}
      </Text>
      <Text style={styles.hudLabel}>Missed</Text>
    </View>
    <View style={styles.hudDivider} />

    <View style={styles.hudItem}>
      <Text style={styles.hudEmoji}>{'🎯'}</Text>
      <Text style={styles.hudValue}>
        {burstCount + missedCount > 0
          ? Math.round((burstCount / (burstCount + missedCount)) * 100)
          : 0}%
      </Text>
      <Text style={styles.hudLabel}>Accuracy</Text>
    </View>
  </View>
);

// ─── Game Over ─────────────────────────────────────────────

const GameOverScreen = ({ mode, burstCount, missedCount, isNewHighScore, highScore, onRestart, onMenu, onShare }) => {
  const total = burstCount + missedCount;
  const accuracy = total > 0 ? Math.round((burstCount / total) * 100) : 0;

  const subtitle =
    mode === 'timed'
      ? `You popped ${burstCount} balloons in ${TIMED_DURATION} seconds!`
      : `You missed ${SURVIVAL_MAX_MISSED} balloons`;

  return (
    <View style={styles.gameOverOverlay}>
      <View style={styles.gameOverCard}>
        <Text style={styles.gameOverEmoji}>
          {isNewHighScore ? '🏆' : mode === 'timed' ? '⏱️' : '😢'}
        </Text>
        <Text style={styles.gameOverTitle}>
          {isNewHighScore ? 'New High Score!' : mode === 'timed' ? "Time's Up!" : 'Game Over'}
        </Text>
        <Text style={styles.gameOverSubtitle}>{subtitle}</Text>

        {highScore > 0 && !isNewHighScore && (
          <Text style={styles.highScoreText}>
            {'🏆'} Best: {highScore}
          </Text>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{burstCount}</Text>
            <Text style={styles.statLabel}>Popped</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{missedCount}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{accuracy}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.restartButton} onPress={onRestart}>
          <Text style={styles.restartText}>Play Again</Text>
        </TouchableOpacity>

        <View style={styles.bottomButtons}>
          <TouchableOpacity style={styles.menuButton} onPress={onShare}>
            <Text style={styles.shareButtonText}>{'📤'} Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuButton} onPress={onMenu}>
            <Text style={styles.menuButtonText}>Change Mode</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ─── App ───────────────────────────────────────────────────

const App = () => {
  const makeInitial = () => Array.from({ length: INITIAL_COUNT }, makeBalloon);

  const [mode, setMode] = useState(null);
  const [balloons, setBalloons] = useState(makeInitial);
  const [finishedCount, setFinishedCount] = useState(0);
  const [burstCount, setBurstCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMED_DURATION);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [highScores, setHighScores] = useState({ timed: 0, survival: 0 });

  const timerRef = useRef(null);
  const gameOverRef = useRef(false);
  const burstCountRef = useRef(0);

  // Load sound + high scores on mount
  useEffect(() => {
    SoundManager.load();
    (async () => {
      const timed = await getHighScore('timed');
      const survival = await getHighScore('survival');
      setHighScores({ timed, survival });
    })();
    return () => SoundManager.unload();
  }, []);

  const resetGame = useCallback(() => {
    setBalloons(makeInitial());
    setFinishedCount(0);
    setBurstCount(0);
    burstCountRef.current = 0;
    setGameOver(false);
    setTimeLeft(TIMED_DURATION);
    setIsNewHighScore(false);
    gameOverRef.current = false;
  }, []);

  const startMode = useCallback(async (selectedMode) => {
    resetGame();
    const hs = await getHighScore(selectedMode);
    setHighScore(hs);
    setMode(selectedMode);
  }, [resetGame]);

  const goToMenu = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    resetGame();
    const timed = await getHighScore('timed');
    const survival = await getHighScore('survival');
    setHighScores({ timed, survival });
    setMode(null);
  }, [resetGame]);

  // Check high score when game ends
  useEffect(() => {
    if (!gameOver || !mode) return;
    (async () => {
      const isNew = await saveHighScore(mode, burstCountRef.current);
      setIsNewHighScore(isNew);
      if (isNew) {
        setHighScore(burstCountRef.current);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      }
    })();
  }, [gameOver, mode]);

  // Timed mode countdown
  useEffect(() => {
    if (mode !== 'timed' || gameOver) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setGameOver(true);
          gameOverRef.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [mode, gameOver]);

  const onFinish = useCallback((id) => {
    if (gameOverRef.current) return;
    setFinishedCount((prev) => {
      const next = prev + 1;
      if (mode === 'survival' && next >= SURVIVAL_MAX_MISSED) {
        setGameOver(true);
        gameOverRef.current = true;
      }
      return next;
    });
    setBalloons((prev) => {
      const next = prev.map((b, i) =>
        i === id ? { ...b, alive: false } : b
      );
      return [...next, makeBalloon()];
    });
  }, [mode]);

  const onBurst = useCallback((id) => {
    if (gameOverRef.current) return;

    // Haptic buzz
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    // Pop sound
    SoundManager.playPop();

    burstCountRef.current += 1;
    setBurstCount((prev) => prev + 1);
    setBalloons((prev) => {
      const next = prev.map((b, i) =>
        i === id ? { ...b, alive: false } : b
      );
      return [...next, makeBalloon(), makeBalloon()];
    });
  }, []);

  const handleShare = useCallback(async () => {
    const total = burstCountRef.current + finishedCount;
    const accuracy = total > 0 ? Math.round((burstCountRef.current / total) * 100) : 0;
    const modeLabel = mode === 'timed' ? 'Time Attack' : 'Survival';
    const message = `🎈 Balloon Pop — ${modeLabel}\n💥 Popped: ${burstCountRef.current}\n💨 Missed: ${finishedCount}\n🎯 Accuracy: ${accuracy}%${isNewHighScore ? '\n🏆 New High Score!' : ''}\n\nCan you beat me?`;

    if (Platform.OS === 'web') {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Balloon Pop', text: message });
        } catch {}
      } else {
        try {
          await navigator.clipboard.writeText(message);
          alert('Results copied to clipboard!');
        } catch {}
      }
    } else {
      try {
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync('data:text/plain,' + encodeURIComponent(message));
        }
      } catch {}
    }
  }, [mode, finishedCount, isNewHighScore]);

  // ─── Mode select screen ───
  if (mode === null) {
    return <ModeSelect onSelect={startMode} highScores={highScores} />;
  }

  // ─── Game screen ───
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.skyTop} />
      <View style={styles.skyMiddle} />
      <View style={styles.skyBottom} />

      <View style={[styles.cloud, { top: '8%', left: '10%' }]}>
        <View style={styles.cloudPuff} />
        <View style={[styles.cloudPuff, styles.cloudPuffLarge]} />
        <View style={styles.cloudPuff} />
      </View>
      <View style={[styles.cloud, { top: '18%', right: '15%' }]}>
        <View style={styles.cloudPuff} />
        <View style={[styles.cloudPuff, styles.cloudPuffLarge]} />
        <View style={styles.cloudPuff} />
      </View>

      <ScoreHUD
        mode={mode}
        burstCount={burstCount}
        missedCount={finishedCount}
        timeLeft={timeLeft}
      />

      {!gameOver && (
        <BalloonsWrapper
          balloons={balloons}
          onFinish={onFinish}
          onBurst={onBurst}
          burstCount={burstCount}
        />
      )}

      {gameOver && (
        <GameOverScreen
          mode={mode}
          burstCount={burstCount}
          missedCount={finishedCount}
          isNewHighScore={isNewHighScore}
          highScore={highScore}
          onRestart={resetGame}
          onMenu={goToMenu}
          onShare={handleShare}
        />
      )}

      <View style={styles.ground} />
    </SafeAreaView>
  );
};

export default App;

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1, overflow: 'hidden', backgroundColor: '#87CEEB',
  },
  skyTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '33%', backgroundColor: '#4A90D9',
  },
  skyMiddle: {
    position: 'absolute', top: '33%', left: 0, right: 0,
    height: '34%', backgroundColor: '#87CEEB',
  },
  skyBottom: {
    position: 'absolute', top: '67%', left: 0, right: 0,
    height: '33%', backgroundColor: '#B0E0F6',
  },
  cloud: {
    position: 'absolute', flexDirection: 'row',
    alignItems: 'flex-end', opacity: 0.7,
  },
  cloudPuff: {
    width: 40, height: 30, borderRadius: 20,
    backgroundColor: 'white', marginHorizontal: -6,
  },
  cloudPuffLarge: {
    width: 55, height: 42, borderRadius: 25, marginBottom: 5,
  },
  ground: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 30, backgroundColor: '#90EE90',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },

  // Mode Select
  modeOverlay: { flex: 1, backgroundColor: '#87CEEB' },
  modeContent: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 28, zIndex: 10,
  },
  modeTitle: {
    fontSize: 42, fontWeight: '900', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6, marginBottom: 6,
  },
  modeSubtitle: {
    fontSize: 16, color: 'rgba(255,255,255,0.85)',
    fontWeight: '600', marginBottom: 36,
  },
  modeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18, padding: 20,
    width: '100%', maxWidth: 380, marginBottom: 16,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
  modeCardEmoji: { fontSize: 36, marginRight: 16 },
  modeCardText: { flex: 1 },
  modeCardTitle: {
    fontSize: 20, fontWeight: '800', color: '#2C3E50', marginBottom: 4,
  },
  modeCardDesc: { fontSize: 13, color: '#7F8C8D', lineHeight: 18 },
  modeCardHighScore: {
    fontSize: 13, fontWeight: '700', color: '#F39C12', marginTop: 6,
  },

  // HUD
  hud: {
    position: 'absolute', top: 12, left: 16, right: 16,
    zIndex: 100, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12,
  },
  hudItem: { alignItems: 'center', flex: 1 },
  hudDivider: {
    width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)',
  },
  hudEmoji: { fontSize: 18, marginBottom: 2 },
  hudValue: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  hudDanger: { color: '#FF4757' },
  hudLabel: {
    color: 'rgba(255,255,255,0.7)', fontSize: 10,
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Game Over
  gameOverOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 200, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  gameOverCard: {
    backgroundColor: '#FFF', borderRadius: 24,
    paddingVertical: 36, paddingHorizontal: 32,
    alignItems: 'center', width: '85%', maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },
  gameOverEmoji: { fontSize: 56, marginBottom: 12 },
  gameOverTitle: {
    fontSize: 28, fontWeight: '800', color: '#2C3E50', marginBottom: 6,
  },
  gameOverSubtitle: {
    fontSize: 15, color: '#7F8C8D', marginBottom: 12, textAlign: 'center',
  },
  highScoreText: {
    fontSize: 14, fontWeight: '700', color: '#F39C12', marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    width: '100%', marginBottom: 28,
  },
  statBox: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 26, fontWeight: '800', color: '#2C3E50' },
  statLabel: {
    fontSize: 12, color: '#95A5A6', fontWeight: '600',
    textTransform: 'uppercase', marginTop: 2,
  },
  restartButton: {
    backgroundColor: '#FF4757',
    paddingVertical: 14, paddingHorizontal: 48,
    borderRadius: 30, marginBottom: 16,
    shadowColor: '#FF4757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  restartText: {
    color: '#FFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.5,
  },
  bottomButtons: {
    flexDirection: 'row', justifyContent: 'center', gap: 20,
  },
  menuButton: { paddingVertical: 10, paddingHorizontal: 16 },
  menuButtonText: { color: '#7F8C8D', fontSize: 15, fontWeight: '600' },
  shareButtonText: { color: '#3498DB', fontSize: 15, fontWeight: '700' },
});
