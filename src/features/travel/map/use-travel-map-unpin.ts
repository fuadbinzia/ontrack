import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useWindowDimensions, type ModalProps } from 'react-native';

import { useTravelMap } from '@/store/travel-map';
import { AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

import type { TravelMapPlaceSelection } from './travel-map-canvas';

export function useTravelMapUnpin(
  setSelected: Dispatch<SetStateAction<TravelMapPlaceSelection | undefined>>,
) {
  const { width, height } = useWindowDimensions();
  const removePlace = useTravelMap((state) => state.removePlace);
  const landscape = width > height;

  return useCallback((selection: TravelMapPlaceSelection) => {
    if (!selection.rendered.person.isSelf) return;
    const supportedOrientations: ModalProps['supportedOrientations'] = landscape
      ? ['landscape-left', 'landscape-right']
      : ['portrait'];
    confirmDestructiveAction({
      title: 'Unpin this place?',
      message: `Remove ${selection.pin.label} from your travel map? The trip itself will stay.`,
      actionLabel: 'Unpin',
      confirmTestID: AgentUiIds.travel.map.previewUnpinConfirm,
      supportedOrientations,
      onConfirm: () => {
        removePlace(selection.rendered.visit.id, selection.pin.id);
        setSelected(undefined);
      },
    });
  }, [landscape, removePlace, setSelected]);
}
