import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  Dropdown,
  EmptyState,
  GlassPlate,
  IconButton,
  Input,
  LoadingBlock,
  StatusBadge,
} from '@/components/primitives';
import { radii } from '@/design-system';
import {
  languagesForDirection,
  TRAVEL_TRANSLATOR_QUICK_PHRASES,
} from '@/features/travel/translator/travel-translator-language';
import type {
  TravelTranslatorDirection,
  TravelTranslatorLanguage,
  TravelTranslatorTurn,
} from '@/features/travel/translator/travel-translator-types';
import { useTravelTranslator } from '@/features/travel/translator/use-travel-translator';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { AgentUiIds } from '@/utils/agent-ui';

function LanguageSelector({
  label,
  value,
  options,
  onChange,
  testID,
}: {
  label: string;
  value: TravelTranslatorLanguage;
  options: readonly TravelTranslatorLanguage[];
  onChange: (language: TravelTranslatorLanguage) => void;
  testID: string;
}) {
  return (
    <View style={styles.languageSelector}>
      <Dropdown
        label={label}
        icon="globe"
        testID={testID}
        value={value.speechLocale}
        options={options.map((language) => ({
          value: language.speechLocale,
          label: `${language.displayName} · ${language.speechLocale}`,
        }))}
        onChange={(next) => {
          const language = options.find((option) => option.speechLocale === next);
          if (language) onChange(language);
        }}
        fieldStyle={styles.languageField}
      />
    </View>
  );
}

function DirectionButton({
  direction,
  selected,
  language,
  onPress,
}: {
  direction: TravelTranslatorDirection;
  selected: boolean;
  language: TravelTranslatorLanguage;
  onPress: () => void;
}) {
  return (
    <Button
      variant={selected ? 'primary' : 'secondary'}
      size="sm"
      onPress={onPress}
      testID={
        direction === 'home-to-destination'
          ? AgentUiIds.travel.translator.directionHome
          : AgentUiIds.travel.translator.directionDestination
      }
      style={styles.flexButton}>
      {`Speak ${language.displayName}`}
    </Button>
  );
}

function TranslatorTurnCard({
  turn,
  source,
  target,
  onCopy,
  onReplay,
  onRetry,
}: {
  turn: TravelTranslatorTurn;
  source: TravelTranslatorLanguage;
  target: TravelTranslatorLanguage;
  onCopy: () => void;
  onReplay: () => void;
  onRetry: () => void;
}) {
  const { spacing } = useResponsive();
  return (
    <GlassPlate
      mist
      style={[styles.turnCard, { padding: spacing.md, gap: spacing.sm }]}> 
      <View style={[styles.turnHeader, { gap: spacing.sm }]}>
        <AppText variant="caption" color="secondary" fit style={styles.shrinkText}>
          {source.displayName} → {target.displayName}
        </AppText>
        <StatusBadge
          label={
            turn.status === 'translating'
              ? 'Translating'
              : turn.status === 'failed'
                ? 'Needs retry'
                : 'Translated'
          }
          tone={
            turn.status === 'failed'
              ? 'danger'
              : turn.status === 'translated'
                ? 'success'
                : 'neutral'
          }
        />
      </View>
      {turn.sourceText ? (
        <AppText variant="body" color="secondary">
          {turn.sourceText}
        </AppText>
      ) : null}
      {turn.status === 'translated' ? (
        <>
          <AppText variant="subheading">{turn.translatedText}</AppText>
          {turn.transliteration ? (
            <AppText variant="callout" color="secondary">
              {turn.transliteration}
            </AppText>
          ) : null}
          <View style={[styles.turnActions, { gap: spacing.sm }]}> 
            <IconButton
              icon="copy"
              onPress={onCopy}
              testID={AgentUiIds.travel.translator.copy(turn.id)}
              accessibilityLabel="Copy translation"
            />
            <IconButton
              icon="speaker"
              onPress={onReplay}
              testID={AgentUiIds.travel.translator.replay(turn.id)}
              accessibilityLabel={`Play translation in ${target.displayName}`}
            />
          </View>
        </>
      ) : turn.status === 'failed' ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="callout" color="danger">
            {turn.errorMessage || 'This turn could not be translated.'}
          </AppText>
          {turn.sourceText ? (
            <Button
              variant="secondary"
              size="sm"
              icon="repeat"
              onPress={onRetry}
              testID={AgentUiIds.travel.translator.retry(turn.id)}>
              Retry
            </Button>
          ) : null}
        </View>
      ) : (
        <LoadingBlock compact label="Translating…" />
      )}
    </GlassPlate>
  );
}

export function TravelTranslatorSheet({
  plan,
  visible,
  onClose,
}: {
  plan: TravelPlan;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { s, spacing, layout } = useResponsive();
  const aiEnabled = usePreferences((state) => state.aiEnabled);
  const homeLocale = usePreferences((state) => state.dateLocale);
  const state = useTravelTranslator({ plan, visible, aiEnabled, homeLocale });
  const minHeight = Math.round(Math.max(320, height - insets.top - spacing.sm) * 0.94);
  const close = () => {
    void state.cancelActiveWork();
    onClose();
  };
  const homeVoiceActive = state.activeVoice === 'home-to-destination';
  const destinationVoiceActive = state.activeVoice === 'destination-to-home';

  return (
    <TravelSheetModal
      visible={visible}
      eyebrow="TRANSLATOR"
      title="Talk Like You’re There"
      subtitle={plan.destination.trim() || undefined}
      subtitleIcon="location"
      onClose={close}
      closeAccessibilityLabel="Close destination translator"
      closeTestID={AgentUiIds.travel.translator.close}
      minHeight={minHeight}
      scrollKey={`${plan.id}-${visible ? 'translator-open' : 'translator-closed'}`}
      footer={
        <Button
          variant="primary"
          onPress={close}
          style={{ minHeight: Math.max(layout.minTapTarget, s(52)) }}>
          Done
        </Button>
      }>
      <View
        testID={AgentUiIds.travel.translator.sheet}
        style={{ gap: spacing.lg, paddingTop: spacing.sm }}>
        {!aiEnabled ? (
          <EmptyState
            icon="translator"
            title="Translator is off"
            message="Turn on AI Summaries in Profile preferences to translate typed or spoken phrases."
            actionLabel="Open preferences"
            actionTestID={AgentUiIds.travel.translator.preferences}
            onAction={() => {
              close();
              router.push('/(tabs)/profile' as never);
            }}
          />
        ) : (
          <>
            <View style={[styles.languageRow, { gap: spacing.sm }]}> 
              <LanguageSelector
                label="Your language"
                value={state.homeLanguage}
                options={state.languageOptions}
                onChange={(language) => {
                  void state.cancelActiveWork();
                  state.setHomeLanguage(language);
                }}
                testID={AgentUiIds.travel.translator.homeLanguage}
              />
              <IconButton
                icon="sort"
                onPress={state.swapLanguages}
                testID={AgentUiIds.travel.translator.swap}
                accessibilityLabel="Swap translator languages"
              />
              <LanguageSelector
                label="Local language"
                value={state.destinationLanguage}
                options={state.languageOptions}
                onChange={(language) => {
                  void state.cancelActiveWork();
                  state.setDestinationLanguage(language);
                }}
                testID={AgentUiIds.travel.translator.destinationLanguage}
              />
            </View>

            {state.languageLoading ? (
              <LoadingBlock compact label={`Finding the local language for ${plan.destination}…`} />
            ) : null}
            {state.languageMessage ? (
              <AppText
                variant="caption"
                align="center"
                style={{ color: theme.warning }}>
                {state.languageMessage}
              </AppText>
            ) : null}

            <GlassPlate style={[styles.voicePanel, { padding: spacing.lg, gap: spacing.md }]}> 
              <View style={{ gap: spacing.xs }}>
                <AppText variant="subheading" align="center" fit>
                  One person, one tap
                </AppText>
                <AppText variant="callout" color="secondary" align="center">
                  Tap a language, speak for up to 30 seconds, then tap again to translate and play it aloud.
                </AppText>
              </View>
              <View style={[styles.voiceButtons, { gap: spacing.sm }]}> 
                <Button
                  variant={homeVoiceActive ? 'danger' : 'primary'}
                  icon={homeVoiceActive ? 'pause' : 'microphone'}
                  onPress={() => void state.startVoice('home-to-destination')}
                  disabled={
                    !state.nativeVoiceAvailable ||
                    state.translating ||
                    destinationVoiceActive
                  }
                  testID={
                    homeVoiceActive
                      ? AgentUiIds.travel.translator.stop
                      : AgentUiIds.travel.translator.microphoneHome
                  }
                  style={styles.flexButton}>
                  {homeVoiceActive
                    ? 'Stop & Translate'
                    : `Speak ${state.homeLanguage.displayName}`}
                </Button>
                <Button
                  variant={destinationVoiceActive ? 'danger' : 'secondary'}
                  icon={destinationVoiceActive ? 'pause' : 'microphone'}
                  onPress={() => void state.startVoice('destination-to-home')}
                  disabled={
                    !state.nativeVoiceAvailable ||
                    state.translating ||
                    homeVoiceActive
                  }
                  testID={
                    destinationVoiceActive
                      ? AgentUiIds.travel.translator.stop
                      : AgentUiIds.travel.translator.microphoneDestination
                  }
                  style={styles.flexButton}>
                  {destinationVoiceActive
                    ? 'Stop & Translate'
                    : `Speak ${state.destinationLanguage.displayName}`}
                </Button>
              </View>
              {!state.nativeVoiceAvailable ? (
                <AppText variant="caption" color="secondary" align="center">
                  Voice recording and playback require the latest app build. Typed translation remains available.
                </AppText>
              ) : null}
              <AppText variant="caption" color="tertiary" align="center">
                Your short recording is sent securely for transcription and deleted from this device immediately after it is read. It is never added to your trip.
              </AppText>
            </GlassPlate>

            <View style={{ gap: spacing.md }}>
              <AppText variant="overline" color="secondary" fit>
                Type a phrase
              </AppText>
              <View style={[styles.directionRow, { gap: spacing.sm }]}> 
                <DirectionButton
                  direction="home-to-destination"
                  selected={state.typedDirection === 'home-to-destination'}
                  language={state.homeLanguage}
                  onPress={() => state.setTypedDirection('home-to-destination')}
                />
                <DirectionButton
                  direction="destination-to-home"
                  selected={state.typedDirection === 'destination-to-home'}
                  language={state.destinationLanguage}
                  onPress={() => state.setTypedDirection('destination-to-home')}
                />
              </View>
              <Input
                stackedLabel="Phrase"
                icon="translator"
                multiline
                value={state.typedText}
                onChangeText={state.setTypedText}
                maxLength={1_000}
                placeholder="What would you like to say?"
                accessibilityLabel="Phrase to translate"
                testID={AgentUiIds.travel.translator.input}
                style={{ minHeight: Math.max(s(92), layout.minTapTarget * 2) }}
              />
              <Button
                icon="translator"
                loading={state.translating}
                disabled={!state.typedText.trim() || Boolean(state.activeVoice)}
                onPress={() => state.translateTyped()}
                testID={AgentUiIds.travel.translator.translate}>
                {`Translate to ${
                  languagesForDirection(
                    state.typedDirection,
                    state.homeLanguage,
                    state.destinationLanguage,
                  ).target.displayName
                }`}
              </Button>
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText variant="overline" color="secondary" fit>
                Quick phrases
              </AppText>
              <View style={[styles.quickPhrases, { gap: spacing.sm }]}> 
                {TRAVEL_TRANSLATOR_QUICK_PHRASES.map((phrase, index) => (
                  <Pressable
                    key={phrase}
                    accessibilityRole="button"
                    accessibilityLabel={`Translate ${phrase}`}
                    testID={AgentUiIds.travel.translator.quickPhrase(index)}
                    disabled={state.translating || Boolean(state.activeVoice)}
                    onPress={() =>
                      state.translateTyped(phrase, 'home-to-destination')
                    }
                    style={({ pressed }) => [
                      styles.quickPhraseHit,
                      { opacity: pressed ? 0.72 : 1 },
                    ]}>
                    <GlassPlate
                      mist
                      style={[
                        styles.quickPhrase,
                        {
                          minHeight: layout.minTapTarget,
                          borderRadius: radii.pill,
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm,
                        },
                      ]}>
                      <AppText variant="caption" fit>
                        {phrase}
                      </AppText>
                    </GlassPlate>
                  </Pressable>
                ))}
              </View>
            </View>

            {state.statusMessage ? (
              <AppText
                variant="callout"
                color={state.statusMessage.includes('copied') ? 'success' : undefined}
                align="center"
                style={
                  state.statusMessage.includes('copied')
                    ? undefined
                    : { color: theme.warning }
                }>
                {state.statusMessage}
              </AppText>
            ) : null}

            {state.turns.length ? (
              <View style={{ gap: spacing.md }}>
                <AppText variant="overline" color="secondary" fit>
                  This conversation
                </AppText>
                {state.turns.map((turn) => {
                  const { source, target } = languagesForDirection(
                    turn.direction,
                    state.homeLanguage,
                    state.destinationLanguage,
                  );
                  return (
                    <TranslatorTurnCard
                      key={turn.id}
                      turn={turn}
                      source={source}
                      target={target}
                      onCopy={() => void state.copyTurn(turn)}
                      onReplay={() => state.replayTurn(turn)}
                      onRetry={() => state.retryTurn(turn)}
                    />
                  );
                })}
              </View>
            ) : (
              <GlassPlate
                mist
                style={[
                  styles.emptyConversation,
                  {
                    borderRadius: radii.lg,
                    padding: spacing.lg,
                    gap: spacing.xs,
                  },
                ]}>
                <AppText variant="callout" align="center" style={{ color: theme.textPrimary }}>
                  Your conversation starts here
                </AppText>
                <AppText variant="caption" color="secondary" align="center">
                  Translations stay only in this trip session.
                </AppText>
              </GlassPlate>
            )}
          </>
        )}
      </View>
    </TravelSheetModal>
  );
}

const styles = StyleSheet.create({
  languageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  languageSelector: {
    flex: 1,
    minWidth: 0,
  },
  languageField: {
    minWidth: 0,
  },
  voicePanel: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
  },
  voiceButtons: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  directionRow: {
    flexDirection: 'row',
  },
  flexButton: {
    flex: 1,
    minWidth: 0,
  },
  quickPhrases: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickPhraseHit: {
    maxWidth: '100%',
  },
  quickPhrase: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  turnCard: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  turnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  turnActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  shrinkText: {
    flex: 1,
    minWidth: 0,
  },
  emptyConversation: {
    alignItems: 'center',
    borderCurve: 'continuous',
  },
});
