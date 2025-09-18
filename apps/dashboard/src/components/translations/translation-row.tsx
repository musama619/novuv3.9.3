import { EnvironmentTypeEnum, PermissionsEnum } from '@novu/shared';
import { ComponentProps, useCallback } from 'react';
import { RiDeleteBin2Line, RiMore2Fill, RiRouteFill } from 'react-icons/ri';
import { useNavigate, useParams } from 'react-router-dom';
import { TranslationGroup } from '@/api/translations';
import { StackedFlagCircles } from '@/components/flag-circle';
import { CompactButton } from '@/components/primitives/button-compact';
import { CopyButton } from '@/components/primitives/copy-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/primitives/dropdown-menu';
import { Skeleton } from '@/components/primitives/skeleton';
import { TableCell, TableRow } from '@/components/primitives/table';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/components/primitives/tooltip';
import { TimeDisplayHoverCard } from '@/components/time-display-hover-card';
import TruncatedText from '@/components/truncated-text';
import { useEnvironment } from '@/context/environment/hooks';
import { useHasPermission } from '@/hooks/use-has-permission';
import { formatDateSimple } from '@/utils/format-date';
import { buildRoute, ROUTES } from '@/utils/routes';
import { cn } from '@/utils/ui';
import { TranslationStatus } from './translation-status';

type TranslationTableCellProps = ComponentProps<typeof TableCell>;

function TranslationTableCell({ className, children, ...props }: TranslationTableCellProps) {
  return (
    <TableCell className={cn('group-hover:bg-neutral-alpha-50 text-text-sub relative', className)} {...props}>
      {children}
      <span className="sr-only">Edit translation</span>
    </TableCell>
  );
}

type ResourceInfoProps = {
  resourceId: string;
  resourceName: string;
};

function ResourceInfo({ resourceId, resourceName }: ResourceInfoProps) {
  return (
    <div className="flex items-center gap-2">
      <Tooltip delayDuration={300}>
        <TooltipTrigger>
          <RiRouteFill className="text-feature size-4" />
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent>
            <span className="font-medium">Workflow Translation</span>
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
      <div>
        <div className="flex items-center gap-1">
          <TruncatedText className="max-w-[32ch]">{resourceName}</TruncatedText>
        </div>
        <div className="flex items-center gap-1 transition-opacity duration-200">
          <TruncatedText className="text-foreground-400 font-code block max-w-[40ch] text-xs">
            {resourceId}
          </TruncatedText>
          <CopyButton
            className="z-10 flex size-2 p-0 px-1 opacity-0 group-hover:opacity-100"
            valueToCopy={resourceId}
            size="2xs"
          />
        </div>
      </div>
    </div>
  );
}

type TranslationActionsMenuProps = {
  onGoToWorkflow: (e: React.MouseEvent) => void;
  onStopPropagation: (e: React.MouseEvent) => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  canWrite: boolean;
  isDevEnvironment: boolean;
};

function TranslationActionsMenu({
  onGoToWorkflow,
  onStopPropagation,
  onDeleteClick,
  canWrite,
  isDevEnvironment,
}: TranslationActionsMenuProps) {
  const canDelete = canWrite && isDevEnvironment;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild onClick={onStopPropagation}>
        <CompactButton variant="ghost" icon={RiMore2Fill} className="z-10 h-8 w-8 p-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onGoToWorkflow} className="flex cursor-pointer items-center gap-2">
            <RiRouteFill className="h-4 w-4" />
            <span>Go to workflow</span>
          </DropdownMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuItem
                onClick={canDelete ? onDeleteClick : undefined}
                className={cn(
                  'flex cursor-pointer items-center gap-2',
                  canDelete ? 'text-destructive' : 'cursor-not-allowed text-neutral-400'
                )}
                disabled={!canDelete}
              >
                <RiDeleteBin2Line className="h-4 w-4" />
                <span>Disable & delete translation</span>
              </DropdownMenuItem>
            </TooltipTrigger>
            {!canDelete && <TooltipContent>Edit translations in your development environment.</TooltipContent>}
          </Tooltip>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useTranslationRowLogic(translation: TranslationGroup) {
  const navigate = useNavigate();
  const { environmentSlug } = useParams<{ environmentSlug: string }>();

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleGoToWorkflow = useCallback(
    (e: React.MouseEvent) => {
      stopPropagation(e);

      if (environmentSlug) {
        navigate(
          buildRoute(ROUTES.EDIT_WORKFLOW, {
            environmentSlug: environmentSlug,
            workflowSlug: translation.resourceId,
          })
        );
      }
    },
    [environmentSlug, navigate, translation.resourceId, stopPropagation]
  );

  return {
    stopPropagation,
    handleGoToWorkflow,
  };
}

export function TranslationRowSkeleton() {
  return (
    <TableRow>
      <TranslationTableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="size-4" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </TranslationTableCell>
      <TranslationTableCell>
        <div className="flex gap-1">
          <Skeleton className="h-5 w-8 rounded-full" />
          <Skeleton className="h-5 w-8 rounded-full" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
      </TranslationTableCell>
      <TranslationTableCell>
        <Skeleton className="h-4 w-24" />
      </TranslationTableCell>
      <TranslationTableCell>
        <Skeleton className="h-4 w-24" />
      </TranslationTableCell>
      <TranslationTableCell>
        <Skeleton className="h-8 w-8" />
      </TranslationTableCell>
    </TableRow>
  );
}

type TranslationRowProps = {
  translation: TranslationGroup;
  onTranslationClick?: (translation: TranslationGroup) => void;
  onDeleteClick?: (translation: TranslationGroup) => void;
};

export function TranslationRow({ translation, onTranslationClick, onDeleteClick }: TranslationRowProps) {
  const { stopPropagation, handleGoToWorkflow } = useTranslationRowLogic(translation);
  const has = useHasPermission();
  const { currentEnvironment } = useEnvironment();
  const canWrite = has({ permission: PermissionsEnum.WORKFLOW_WRITE });
  const isDevEnvironment = currentEnvironment?.type === EnvironmentTypeEnum.DEV;

  const handleRowClick = useCallback(() => {
    onTranslationClick?.(translation);
  }, [onTranslationClick, translation]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      stopPropagation(e);
      onDeleteClick?.(translation);
    },
    [stopPropagation, onDeleteClick, translation]
  );

  return (
    <TableRow key={translation.resourceId} className="group relative isolate cursor-pointer" onClick={handleRowClick}>
      <TranslationTableCell className="font-medium">
        <ResourceInfo resourceId={translation.resourceId} resourceName={translation.resourceName} />
      </TranslationTableCell>

      <TranslationTableCell>
        <TranslationStatus outdatedLocales={translation.outdatedLocales} />
      </TranslationTableCell>

      <TranslationTableCell>
        <StackedFlagCircles locales={translation.locales} maxVisible={4} size="md" />
      </TranslationTableCell>

      <TranslationTableCell>
        <TimeDisplayHoverCard date={new Date(translation.createdAt)}>
          {formatDateSimple(translation.createdAt)}
        </TimeDisplayHoverCard>
      </TranslationTableCell>

      <TranslationTableCell>
        <TimeDisplayHoverCard date={new Date(translation.updatedAt)}>
          {formatDateSimple(translation.updatedAt)}
        </TimeDisplayHoverCard>
      </TranslationTableCell>

      <TranslationTableCell>
        <div className="flex justify-end">
          <TranslationActionsMenu
            onGoToWorkflow={handleGoToWorkflow}
            onStopPropagation={stopPropagation}
            onDeleteClick={handleDeleteClick}
            canWrite={canWrite}
            isDevEnvironment={isDevEnvironment}
          />
        </div>
      </TranslationTableCell>
    </TableRow>
  );
}
