import { useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, type View } from 'react-native';

import { type DropdownAnchor } from '@/components/primitives/dropdown-layout';
import {
  CITY_LOOKUP_MIN_QUERY,
  searchCities,
  type CitySuggestion,
} from '@/utils/city-lookup';

const DEBOUNCE_MS = 320;

type UseCityAutofindSuggestionsParams = {
  value: string;
  onChangeText: (text: string) => void;
  onCommit: (label: string) => void;
  onBlur?: () => void;
  fieldRef: RefObject<View | null>;
};

export function useCityAutofindSuggestions({
  value,
  onChangeText,
  onCommit,
  onBlur,
  fieldRef,
}: UseCityAutofindSuggestionsParams) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DropdownAnchor>();
  const requestIdRef = useRef(0);
  const openGenerationRef = useRef(0);
  const suppressUntilTypedRef = useRef(false);
  const suppressBlurRef = useRef(false);
  const lastLocalValueRef = useRef(value);
  const userTypedRef = useRef(false);

  const clearSuggestions = () => {
    requestIdRef.current += 1;
    openGenerationRef.current += 1;
    setSuggestions([]);
    setOpen(false);
    setAnchor(undefined);
    setLoading(false);
  };

  const dismissMenu = () => {
    requestIdRef.current += 1;
    openGenerationRef.current += 1;
    suppressUntilTypedRef.current = true;
    setOpen(false);
    setAnchor(undefined);
    setLoading(false);
    Keyboard.dismiss();
  };

  const measureAndOpen = () => {
    if (suppressUntilTypedRef.current) return;
    const generation = ++openGenerationRef.current;
    fieldRef.current?.measureInWindow((x, y, width, measuredHeight) => {
      if (generation !== openGenerationRef.current) return;
      if (suppressUntilTypedRef.current) return;
      if (width <= 0 || measuredHeight <= 0) return;
      setAnchor({ x, y, width, height: measuredHeight });
      setOpen(true);
    });
  };

  useEffect(() => {
    const fromUserTyping = userTypedRef.current;
    userTypedRef.current = false;

    if (value !== lastLocalValueRef.current) {
      lastLocalValueRef.current = value;
      suppressUntilTypedRef.current = false;
      clearSuggestions();
      return;
    }

    if (!fromUserTyping) {
      if (suppressUntilTypedRef.current) return;
      clearSuggestions();
      return;
    }

    const query = value.trim();
    if (query.length < CITY_LOOKUP_MIN_QUERY) {
      clearSuggestions();
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchCities(query).then((results) => {
        if (requestId !== requestIdRef.current) return;
        if (suppressUntilTypedRef.current) return;
        setSuggestions(results);
        setLoading(false);
        if (results.length > 0) {
          measureAndOpen();
        } else {
          setOpen(false);
          setAnchor(undefined);
        }
      });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      if (requestId === requestIdRef.current) setLoading(false);
    };
  }, [value]);

  useEffect(() => {
    if (!open) {
      setAnchor(undefined);
      return;
    }
    if (anchor) return;
    const generation = openGenerationRef.current;
    fieldRef.current?.measureInWindow((x, y, width, measuredHeight) => {
      if (generation !== openGenerationRef.current) return;
      if (suppressUntilTypedRef.current) return;
      if (width <= 0 || measuredHeight <= 0) return;
      setAnchor({ x, y, width, height: measuredHeight });
    });
  }, [open, anchor, fieldRef]);

  const applySuggestion = (suggestion: CitySuggestion) => {
    lastLocalValueRef.current = suggestion.label;
    userTypedRef.current = false;
    suppressUntilTypedRef.current = false;
    // onCommit already persisted — ignore the blur from Keyboard.dismiss
    // so a stale draft (e.g. mirrored GPS) cannot overwrite the selection.
    suppressBlurRef.current = true;
    clearSuggestions();
    onChangeText(suggestion.label);
    onCommit(suggestion.label);
    Keyboard.dismiss();
  };

  const handleBlur = () => {
    if (suppressBlurRef.current) {
      suppressBlurRef.current = false;
      return;
    }
    onBlur?.();
  };

  const handleChangeText = (next: string) => {
    suppressUntilTypedRef.current = false;
    userTypedRef.current = true;
    lastLocalValueRef.current = next;
    onChangeText(next);
  };

  const handleSubmitEditing = () => {
    dismissMenu();
    handleBlur();
  };

  return {
    suggestions,
    loading,
    open,
    anchor,
    dismissMenu,
    applySuggestion,
    handleBlur,
    handleChangeText,
    handleSubmitEditing,
  };
}
