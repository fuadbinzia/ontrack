import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, GlassPlate } from '@/components/primitives';
import { layout, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import { haptics } from '@/utils/haptics';
import { goBackOrReplace } from '@/utils/navigation';
import { AgentUiIds } from '@/utils/agent-ui';

import { balloonColor } from './colors';
import { BalloonPopHud } from './balloon-pop-hud';
import { BalloonPopStage } from './balloon-pop-stage';
import { applyTimePenalty, getLevelConfig } from './levels';
import type { GamePhase, LevelConfig } from './types';

export function BalloonPopScreen() {
  const theme = useTheme();
  const routeIsActive = useRouteIsActive();
  const router = useRouter();
  const [levelNumber, setLevelNumber] = useState(1);
  const [level, setLevel] = useState<LevelConfig>(() => getLevelConfig(1));
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [remainingSec, setRemainingSec] = useState(level.durationSec);
  const [score, setScore] = useState(0);
  const [targetsLeft, setTargetsLeft] = useState(level.targetCount);
  const [timerFlash, setTimerFlash] = useState(false);
  const remainingRef = useRef(remainingSec);
  const phaseRef = useRef(phase);
  remainingRef.current = remainingSec;
  phaseRef.current = phase;

  const startLevel = useCallback((nextLevel: number, keepScore: boolean) => {
    const config = getLevelConfig(nextLevel);
    setLevelNumber(nextLevel);
    setLevel(config);
    setRemainingSec(config.durationSec);
    remainingRef.current = config.durationSec;
    setTargetsLeft(config.targetCount);
    setTimerFlash(false);
    if (!keepScore) setScore(0);
    setPhase('playing');
    phaseRef.current = 'playing';
  }, []);

  useEffect(() => {
    if (phase !== 'playing' || !routeIsActive) return;

    const id = setInterval(() => {
      if (phaseRef.current !== 'playing') return;
      const next = Math.max(0, remainingRef.current - 0.1);
      remainingRef.current = next;
      setRemainingSec(next);
      if (next <= 0) {
        setPhase('lost');
        phaseRef.current = 'lost';
        haptics.warning();
      }
    }, 100);

    return () => clearInterval(id);
  }, [phase, level.level, routeIsActive]);

  const onPopTarget = useCallback(() => {
    haptics.tap();
    setScore((value) => value + 10);
    setTargetsLeft((value) => Math.max(0, value - 1));
  }, []);

  const onPopWrong = useCallback(() => {
    haptics.warning();
    const next = applyTimePenalty(
      remainingRef.current,
      level.wrongPopPenaltySec,
    );
    remainingRef.current = next;
    setRemainingSec(next);
    setTimerFlash(true);
    setTimeout(() => setTimerFlash(false), 350);
    if (next <= 0) {
      setPhase('lost');
      phaseRef.current = 'lost';
    }
  }, [level.wrongPopPenaltySec]);

  const onTargetsCleared = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    haptics.success();
    setPhase('won');
    phaseRef.current = 'won';
  }, []);

  useEffect(() => {
    if (phase !== 'won' || !routeIsActive) return;
    const id = setTimeout(() => {
      startLevel(levelNumber + 1, true);
    }, 1200);
    return () => clearTimeout(id);
  }, [phase, levelNumber, routeIsActive, startLevel]);

  const leave = () => goBackOrReplace(router, '/(tabs)/games');

  // Top inset comes from AppSafeArea; pad remaining edges here (gym-active pattern).
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.fill, { backgroundColor: theme.backgroundPrimary }]}
    >
      <View style={styles.content}>
        <BalloonPopHud
          level={level.level}
          remainingSec={remainingSec}
          targetColorId={level.targetColorId}
          targetsLeft={targetsLeft}
          score={score}
          timerFlash={timerFlash}
          onClose={leave}
        />

        <View style={styles.stageWrap}>
          <BalloonPopStage
            key={`${level.level}-${phase === 'ready' ? 'ready' : 'run'}-${levelNumber}`}
            level={level}
            playing={phase === 'playing' && routeIsActive}
            onPopTarget={onPopTarget}
            onPopWrong={onPopWrong}
            onTargetsCleared={onTargetsCleared}
          />
        </View>

        {phase === 'ready' ? (
          <View
            style={[styles.overlay, { backgroundColor: theme.overlayScrim }]}
          >
            <GlassPlate style={styles.panel}>
              <View style={styles.panelInner}>
                <AppText variant="heading" align="center">
                  Balloon Pop
                </AppText>
                <AppText
                  variant="body"
                  color="secondary"
                  align="center"
                  style={styles.blurb}
                >
                  Pop every{' '}
                  {balloonColor(level.targetColorId).label.toLowerCase()}{' '}
                  balloon before time runs out. Wrong colors cost time. Fans
                  push balloons harder as you climb levels.
                </AppText>
                <Button
                  testID={AgentUiIds.games.balloonPopPlay}
                  onPress={() => startLevel(1, false)}
                >
                  Play
                </Button>
              </View>
            </GlassPlate>
          </View>
        ) : null}

        {phase === 'won' ? (
          <View style={[styles.banner, { backgroundColor: theme.accentFaint }]}>
            <AppText variant="subheading" color="accent" align="center">
              Level {level.level} clear
            </AppText>
          </View>
        ) : null}

        {phase === 'lost' ? (
          <View
            style={[styles.overlay, { backgroundColor: theme.overlayScrim }]}
          >
            <GlassPlate style={styles.panel}>
              <View style={styles.panelInner}>
                <AppText variant="heading" align="center">
                  Time’s up
                </AppText>
                <AppText
                  variant="body"
                  color="secondary"
                  align="center"
                  style={styles.blurb}
                >
                  Score {score} · reached level {level.level}
                </AppText>
                <View style={styles.actions}>
                  <Button
                    testID={AgentUiIds.games.balloonPopRetry}
                    onPress={() => startLevel(level.level, false)}
                  >
                    Retry
                  </Button>
                  <Button
                    variant="secondary"
                    testID={AgentUiIds.games.balloonPopBack}
                    onPress={leave}
                  >
                    Back to Games
                  </Button>
                </View>
              </View>
            </GlassPlate>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  stageWrap: {
    flex: 1,
    minHeight: 280,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 10,
  },
  panel: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    overflow: 'hidden',
  },
  panelInner: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    zIndex: 1,
  },
  blurb: {
    maxWidth: 320,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  banner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
    zIndex: 8,
  },
});
