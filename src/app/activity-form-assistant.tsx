import { Pressable, View } from 'react-native';

import { ASSISTANT_COPY } from '@/app/activity-form-copy';
import { activityFormGlassCardStyle } from '@/app/activity-form-sections';
import { MovieEditor } from '@/app/activity-form-editors';
import { activityFormStyles as styles } from '@/app/activity-form-styles';
import {
  AppText,
  GlassPlate,
  Input,
} from '@/components/primitives';
import { CategoryBadge } from '@/components/shared';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export function ActivityFormAssistantSection(props: Record<string, any>) {
  const {
    isEditing,
    availableCategories,
    categoryId,
    setCategoryId,
    setTitle,
    setMovie,
    setError,
    category,
    title,
    movie,
    editId,
    savedDraftId,
    setDuration,
    theme,
    fieldFill,
    fieldBorder,
  } = props;

  return (
    <>
{!isEditing ? (
          <View style={styles.assistant}>
            <View style={styles.assistantHeading}>
              <View style={[styles.assistantDot, { backgroundColor: theme.accentPrimary }]} />
              <AppText variant="overline" color="accent">onTrack assistant</AppText>
            </View>
            <AppText variant="title">
              What are we getting into?
            </AppText>
            <AppText variant="body" color="secondary">
              Pick a vibe and I’ll help with the rest.
            </AppText>
            <View style={styles.wrap}>
              {availableCategories.map((item: any) => {
                const selectCategory = () => {
                  setCategoryId(item.id);
                  setTitle('');
                  setMovie(undefined);
                  setError(undefined);
                };
                const selected = item.id === categoryId;
                return (
                  <AgentTestId
                    key={item.id}
                    testID={AgentUiIds.activityForm.category(item.id)}
                    label={item.name}
                    onPress={selectCategory}>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={selectCategory}>
                      <CategoryBadge category={item} selected={selected} size="large" />
                    </Pressable>
                  </AgentTestId>
                );
              })}
            </View>
            {category ? (
              <View style={[styles.followUp, { borderTopColor: theme.separator }]}>
                <AppText variant="bodyMedium">
                  {category.detailKind === 'movie'
                    ? 'Ooh, screen time. What are we watching? 🍿'
                    : ASSISTANT_COPY[category.id]?.question ?? 'What should we call it?'}
                </AppText>
                {category.detailKind === 'movie' ? (
                  <MovieEditor
                    movie={movie}
                    guided
                    onSelect={(selected) => {
                      setMovie({ ...selected, activityId: editId ?? savedDraftId });
                      setTitle(selected.title);
                      if (selected.runtimeMinutes) setDuration(String(selected.runtimeMinutes));
                    }}
                  />
                ) : (
                  <Input
                    key={category.id}
                    label={ASSISTANT_COPY[category.id]?.label ?? 'Event'}
                    value={title}
                    onChangeText={setTitle}
                    placeholder={ASSISTANT_COPY[category.id]?.placeholder ?? 'What’s happening?'}
                    autoFocus
                    returnKeyType="next"
                    fieldBackground={fieldFill}
                    fieldBorderColor={fieldBorder}
                    testID={AgentUiIds.activityForm.guidedTitle}
                  />
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {isEditing && category ? (
          <GlassPlate airy style={activityFormGlassCardStyle}>
            <CategoryBadge category={category} />
            <Input
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Event title"
              fieldBackground={fieldFill}
              fieldBorderColor={fieldBorder}
              testID={AgentUiIds.activityForm.title}
            />
          </GlassPlate>
        ) : null}
    </>
  );
}
