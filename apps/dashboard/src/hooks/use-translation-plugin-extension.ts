import { EditorView } from '@uiw/react-codemirror';
import { MutableRefObject, useMemo } from 'react';
import { createTranslationExtension } from '@/components/primitives/translation-plugin';
import { CompletionRange } from '@/components/primitives/variable-editor';
import { useTranslations } from '@/hooks/use-translations';
import { useFetchTranslationKeys } from './use-fetch-translation-keys';

export const useTranslationPluginExtension = ({
  viewRef,
  lastCompletionRef,
  onChange,
  workflow,
  shouldEnableTranslations,
}: {
  viewRef: MutableRefObject<EditorView | null>;
  lastCompletionRef: MutableRefObject<CompletionRange | null>;
  onChange: (value: string) => void;
  workflow?: { _id: string };
  shouldEnableTranslations: boolean;
}) => {
  const {
    selectedTranslation,
    setSelectedTranslation,
    handleTranslationDelete,
    handleTranslationReplaceKey,
    handleTranslationSelect,
  } = useTranslations(viewRef, onChange);

  // Translation keys for autocompletion - only fetch if translations are enabled
  const { translationKeys, isLoading: isTranslationKeysLoading } = useFetchTranslationKeys({
    workflowId: workflow?._id || '',
    enabled: shouldEnableTranslations && !!workflow?._id,
  });

  const translationPluginExtension = useMemo(() => {
    if (!shouldEnableTranslations) return null;

    return createTranslationExtension({
      viewRef,
      lastCompletionRef,
      onSelect: handleTranslationSelect,
      translationKeys,
      isTranslationKeysLoading,
    });
  }, [
    handleTranslationSelect,
    translationKeys,
    isTranslationKeysLoading,
    shouldEnableTranslations,
    viewRef,
    lastCompletionRef,
  ]);

  return {
    translationPluginExtension,
    selectedTranslation,
    setSelectedTranslation,
    handleTranslationDelete,
    handleTranslationReplaceKey,
  };
};
