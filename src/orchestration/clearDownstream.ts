import type { DownstreamLevel } from './gates';
import { downstreamImpactLabel } from './gates';

/** 构造上游修改确认文案（纯函数，不碰 React state） */
export function buildClearDownstreamMessage(
  actionLabel: string,
  level: DownstreamLevel
): string {
  return `${actionLabel}将清空：${downstreamImpactLabel(level)}。是否继续？`;
}

export type ClearDownstreamPreview = {
  level: DownstreamLevel;
  impacts: string;
  message: string;
};

export function previewClearDownstream(
  actionLabel: string,
  level: DownstreamLevel
): ClearDownstreamPreview {
  const impacts = downstreamImpactLabel(level);
  return {
    level,
    impacts,
    message: buildClearDownstreamMessage(actionLabel, level),
  };
}
