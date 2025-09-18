import {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
  startCompletion,
} from '@codemirror/autocomplete';
import { TRANSLATION_NAMESPACE_SEPARATOR } from '@novu/shared';
import { EditorView } from '@uiw/react-codemirror';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { NewVariablePreview } from '@/components/variable/components/new-variable-preview';
import { getFilters } from '@/components/variable/constants';
import { LiquidVariable } from '@/utils/parseStepVariables';
import { getVariablesAtPositionWithLoopProperties } from './liquid-scope-analyzer';

export interface CompletionOption {
  label: string;
  type: string;
  boost?: number;
  isNewVariable?: boolean;
  displayLabel?: string;
}

// Novu JIT namespaces
const PAYLOAD_NAMESPACE = 'payload';
const SUBSCRIBER_DATA_NAMESPACE = 'subscriber.data';
const STEP_PAYLOAD_REGEX = /^steps\.[a-zA-Z0-9_-]+\.events/;

/**
 * Create a DOM element to render the info panel in Codemirror.
 */
const createInfoPanel = ({ component }: { component: React.ReactNode }) => {
  const dom = document.createElement('div');
  createRoot(dom).render(component);
  return dom;
};

/**
 * Liquid variable autocomplete for the following patterns:
 *
 * 1. Payload Variables:
 *    Valid:
 *    - payload.
 *    - payload.user
 *    - payload.anyNewField (allows any new field)
 *    - payload.deeply.nested.field
 *    Invalid:
 *    - pay (shows suggestions but won't validate)
 *    - payload (shows suggestions but won't validate)
 *
 * 2. Subscriber Variables:
 *    Valid:
 *    - subscriber.data.
 *    - subscriber.data.anyNewField (allows any new field)
 *    - subscriber.data.custom.nested.field
 *    - subscriber (shows suggestions but won't validate)
 *    - subscriber.email
 *    - subscriber.firstName
 *    Invalid:
 *    - subscriber.someOtherField (must use valid subscriber field)
 *
 * 3. Step Variables:
 *    Valid:
 *    - steps.
 *    - steps.digest-step (must be existing step ID)
 *    - steps.digest-step.events
 *    - steps.digest-step.events[0]
 *    - steps.digest-step.events[0].id
 *    - steps.digest-step.events[0].payload
 *    - steps.digest-step.events[0].payload.anyNewField (allows any new field after payload)
 *    - steps.digest-step.events[0].payload.deeply.nested.field
 *    Invalid:
 *    - steps.invalid-step (must use existing step ID)
 *    - steps.digest-step.payload (must use events[n].payload pattern)
 *    - steps.digest-step.events.payload (must use events[n] pattern)
 *    - steps.digest-step.invalidProp (only events[] is allowed)
 *
 * Autocomplete Behavior:
 * 1. Shows suggestions when typing partial prefixes:
 *    - 'su' -> shows subscriber.data.* variables
 *    - 'pay' -> shows payload.* variables
 *    - 'ste' -> shows steps.* variables
 *
 * 2. Shows suggestions with closing braces:
 *    - '{{su}}' -> shows subscriber.data.* variables
 *    - '{{payload.}}' -> shows payload.* variables
 *
 * 3. Allows new variables after valid prefixes:
 *    - subscriber.data.* (any new field)
 *    - payload.* (any new field)
 *    - steps.{valid-step}.events[n].payload.* (any new field)
 */
export const completions =
  (
    scopedVariables: LiquidVariable[],
    variables: LiquidVariable[],
    onCreateNewVariable?: (variableName: string) => Promise<void>,
    isPayloadSchemaEnabled?: boolean
  ) =>
  (context: CompletionContext): CompletionResult | null => {
    const { state, pos } = context;
    const beforeCursor = state.sliceDoc(0, pos);

    // Only proceed if we're inside or just after {{
    const lastOpenBrace = beforeCursor.lastIndexOf('{{');
    if (lastOpenBrace === -1) return null;

    // Get the content between {{ and cursor
    const insideBraces = state.sliceDoc(lastOpenBrace + 2, pos);

    // Get clean search text without braces and trim
    const searchText = insideBraces.replace(/}+$/, '').trim();

    // Handle pipe filters
    const afterPipe = getContentAfterPipe(searchText);

    if (afterPipe !== null) {
      return {
        from: pos - afterPipe.length,
        to: pos,
        options: getFilterCompletions(afterPipe),
      };
    }

    const allVariables = [...scopedVariables, ...variables];
    const matchingVariables = getMatchingVariables(
      searchText,
      scopedVariables,
      variables,
      onCreateNewVariable,
      isPayloadSchemaEnabled
    );

    // If we have matches or we're in a valid context, show them
    if (matchingVariables.length > 0 || isInsideLiquidBlock(beforeCursor)) {
      return {
        from: lastOpenBrace + 2,
        to: pos,
        options:
          matchingVariables.length > 0
            ? matchingVariables.map((v) =>
                createCompletionOption(
                  v.name,
                  v.isNewSuggestion && isPayloadSchemaEnabled ? 'new-variable' : (v.type ?? 'variable'),
                  v.boost,
                  v.info,
                  v.displayLabel
                )
              )
            : allVariables.map((v) =>
                createCompletionOption(v.name, v.type ?? 'variable', v.boost, v.info, v.displayLabel)
              ),
      };
    }

    return null;
  };

function isInsideLiquidBlock(beforeCursor: string): boolean {
  const lastOpenBrace = beforeCursor.lastIndexOf('{{');

  return lastOpenBrace !== -1;
}

function getContentAfterPipe(content: string): string | null {
  const pipeIndex = content.lastIndexOf('|');
  if (pipeIndex === -1) return null;

  return content.slice(pipeIndex + 1).trimStart();
}

function createCompletionOption(
  label: string,
  type: string,
  boost?: number,
  info?: Completion['info'],
  displayLabel?: Completion['displayLabel']
): CompletionOption {
  return {
    label,
    type,
    isNewVariable: type === 'new-variable',
    ...(boost && { boost }),
    ...(info && { info }),
    ...(displayLabel && { displayLabel }),
  };
}

function getFilterCompletions(afterPipe: string): CompletionOption[] {
  return getFilters()
    .filter((f) => f.label.toLowerCase().startsWith(afterPipe.toLowerCase()))
    .map((f) => createCompletionOption(f.value, 'function'));
}

function getMatchingVariables(
  searchText: string,
  scopedVariables: LiquidVariable[],
  variables: LiquidVariable[],
  onCreateNewVariable?: (variableName: string) => Promise<void>,
  isPayloadSchemaEnabled?: boolean
): LiquidVariable[] {
  const allVariables = [...scopedVariables, ...variables];
  if (!searchText) return allVariables;

  const searchTextTrimmed = searchText.trim();

  // Handle dot endings
  if (searchText.endsWith('.')) {
    const prefix = searchText.slice(0, -1);
    return allVariables.filter((v) => v.name.startsWith(prefix));
  }

  // Filter jit step namespaces out of the returned variables from the server
  const stepPayloadNamespaces = variables.reduce<string[]>((acc, variableItem) => {
    const match = variableItem.name.match(STEP_PAYLOAD_REGEX);

    const withPayload = match ? `${match[0]}.payload` : null;

    if (withPayload && !acc.includes(withPayload)) {
      acc.push(withPayload);
    }

    return acc;
  }, []);

  // Create JIT variables based on the search text e.g. payload.foo, subscriber.data.foo, steps.digest-step.events[0].payload.foo
  const jitVariables = [PAYLOAD_NAMESPACE, SUBSCRIBER_DATA_NAMESPACE, ...stepPayloadNamespaces].reduce<
    LiquidVariable[]
  >((acc, namespace) => {
    // If the user is typing steps.*, don't suggest any variables like payload.steps.digest-step.events
    if (searchText.startsWith('steps.')) {
      return acc;
    }

    if (searchText.startsWith(namespace + '.') && searchText !== namespace) {
      // Ensure that if the user types payload.foo the first suggestion is payload.foo
      acc.push({
        name: searchText,
        type: 'variable',
        isNewSuggestion: true,
        info: () => {
          if (!isPayloadSchemaEnabled) {
            return null;
          }

          const dom = createInfoPanel({
            component: (
              <NewVariablePreview
                onCreateClick={() => {
                  onCreateNewVariable?.(searchText.replace(namespace + '.', ''));
                }}
              />
            ),
          });
          return {
            dom,
            destroy: () => {
              dom.remove();
            },
          };
        },
      });
    } else if (!searchText.startsWith(namespace)) {
      const suggestedVariableName = `${namespace}.${searchText.trim()}`;
      const isPayloadVariable = namespace === PAYLOAD_NAMESPACE;

      // For payload variables, treat them as new suggestions with creation capability
      acc.push({
        name: suggestedVariableName,
        type: 'variable',
        isNewSuggestion: isPayloadVariable,
        ...(isPayloadVariable && {
          info: () => {
            if (!isPayloadSchemaEnabled) {
              return null;
            }

            const dom = createInfoPanel({
              component: (
                <NewVariablePreview
                  onCreateClick={() => {
                    onCreateNewVariable?.(searchText.trim());
                  }}
                />
              ),
            });
            return {
              dom,
              destroy: () => {
                dom.remove();
              },
            };
          },
        }),
      });
    }

    return acc;
  }, []);

  const prefix = searchText.split('.')[0];
  const localVariable = scopedVariables.find((v) => v.name === prefix);
  let combinedVariables = [...jitVariables, ...allVariables];

  if (localVariable) {
    combinedVariables = [
      ...jitVariables,
      {
        name: searchText,
        displayLabel: searchText,
        type: 'local',
      },
      ...allVariables,
    ];
  }

  const baseVariables = Array.from(new Map(combinedVariables.map((item) => [item.name, item])).values());

  const existingMatchingVariables = baseVariables.filter((v) => {
    const namePartWithoutFilters = v.name.split('|')[0].trim();

    return namePartWithoutFilters.includes(searchTextTrimmed);
  });

  return existingMatchingVariables;
}

function createTranslationNamespaceCompletion(): Completion {
  return {
    label: TRANSLATION_NAMESPACE_SEPARATOR,
    displayLabel: 't.',
    type: 'translation',
  };
}

function applyTranslationNamespaceCompletion(
  view: EditorView,
  completion: Completion,
  from: number,
  to: number,
  onVariableSelect?: (completion: CompletionOption) => void
): boolean {
  const content = view.state.doc.toString();
  const beforeCursor = content.slice(0, from);
  const afterCursor = content.slice(to);

  const needsOpening = !beforeCursor.endsWith('{{');
  const selectedValue = completion.label;

  // Remove auto-inserted closing braces if present
  const finalTo = afterCursor.startsWith('}}') ? to + 2 : to;
  const wrappedValue = `${needsOpening ? '{{' : ''}${selectedValue}`;

  onVariableSelect?.(completion as CompletionOption);

  view.dispatch({
    changes: { from, to: finalTo, insert: wrappedValue },
    selection: { anchor: from + wrappedValue.length },
  });

  // Trigger translation autocomplete
  setTimeout(() => startCompletion(view), 0);

  return true;
}

function applyRegularCompletion(
  view: EditorView,
  completion: Completion,
  from: number,
  to: number,
  onVariableSelect?: (completion: CompletionOption) => void
): boolean {
  const selectedValue = completion.label;
  const content = view.state.doc.toString();
  const beforeCursor = content.slice(0, from);
  const afterCursor = content.slice(to);

  const needsOpening = !beforeCursor.endsWith('{{');
  const needsClosing = !afterCursor.startsWith('}}');

  const wrappedValue = `${needsOpening ? '{{' : ''}${selectedValue}${needsClosing ? '}}' : ''}`;
  const finalCursorPos = from + wrappedValue.length;

  onVariableSelect?.(completion as CompletionOption);

  view.dispatch({
    changes: { from, to, insert: wrappedValue },
    selection: { anchor: finalCursorPos },
  });

  return true;
}

export function createAutocompleteSource(
  variables: LiquidVariable[],
  onVariableSelect?: (completion: CompletionOption) => void,
  onCreateNewVariable?: (variableName: string) => Promise<void>,
  isPayloadSchemaEnabled?: boolean,
  isTranslationEnabled?: boolean
): CompletionSource {
  return (context: CompletionContext) => {
    // Match text that starts with {{ and capture everything after it until the cursor position
    const word = context.matchBefore(/\{\{([^}]*)/);
    if (!word) return null;

    const scopedVariables = getVariablesAtPositionWithLoopProperties(context.state.doc.toString(), context.pos);
    const scopedLiquidVariables = scopedVariables.map<LiquidVariable>((variable) => ({
      name: variable,
      displayLabel: variable,
      type: 'local',
    }));
    const options = completions(scopedLiquidVariables, variables, onCreateNewVariable, isPayloadSchemaEnabled)(context);
    if (!options) return null;

    // Add translation namespace variable if translation feature is enabled
    if (isTranslationEnabled) {
      options.options = [createTranslationNamespaceCompletion(), ...options.options] as Completion[];
    }

    const { from, to } = options;

    return {
      from,
      to,
      options: options.options.map(
        (option) =>
          ({
            ...option,
            apply: (view: EditorView, completion: CompletionOption, from: number, to: number) => {
              if (completion.type === 'translation') {
                return applyTranslationNamespaceCompletion(view, completion, from, to, onVariableSelect);
              }

              return applyRegularCompletion(view, completion, from, to, onVariableSelect);
            },
          }) as Completion
      ),
    };
  };
}
