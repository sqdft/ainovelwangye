import { useCallback, useRef, useState } from 'react';

export type TaskKind =
  | 'idle'
  | 'models'
  | 'titles'
  | 'bookInfo'
  | 'characters'
  | 'realms'
  | 'toc'
  | 'chapter'
  | 'batch'
  | 'shortTitles'
  | 'shortOutline'
  | 'shortContent'
  | 'other';

export type TaskStatus = 'idle' | 'running' | 'error';

export type TaskState = {
  kind: TaskKind;
  label: string;
  status: TaskStatus;
  progress?: { current: number; total: number };
  cancellable?: boolean;
  lastError?: string;
};

export type RunTaskOptions = {
  kind: TaskKind;
  label: string;
  cancellable?: boolean;
  progress?: { current: number; total: number };
  run: () => Promise<void>;
};

type ToastFn = (
  message: string,
  kind?: 'info' | 'success' | 'error' | 'warn',
  action?: { label: string; tab?: string }
) => void;

const idleTask = (): TaskState => ({ kind: 'idle', label: '', status: 'idle' });

/**
 * 全局任务状态机：唯一 busy 来源 + 失败可重试 + 可请求停止。
 * stopBatchRef 与批量生成共用，便于顶栏「停止」与批量按钮一致。
 */
export function useTaskRunner(pushToast: ToastFn) {
  const [taskState, setTaskState] = useState<TaskState>(idleTask());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [generatingChapterNum, setGeneratingChapterNum] = useState<number | null>(null);

  const cancelTaskRef = useRef(false);
  const stopBatchRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRetryRef = useRef<null | (() => Promise<void>)>(null);
  const busyRef = useRef(false);

  const isTaskBusy =
    taskState.status === 'running' || isGenerating || isBatchGenerating;

  const clearTask = useCallback(() => {
    setTaskState(idleTask());
    lastRetryRef.current = null;
    busyRef.current = false;
  }, []);

  const requestCancelTask = useCallback(() => {
    cancelTaskRef.current = true;
    stopBatchRef.current = true;
    try {
      abortControllerRef.current?.abort();
    } catch { /* ignore */ }
    pushToast('已请求停止…', 'warn');
  }, [pushToast]);

  const runTask = useCallback(
    async (opts: RunTaskOptions) => {
      if (busyRef.current || isGenerating) {
        pushToast('当前有任务进行中，请稍候或先停止', 'warn');
        return;
      }
      cancelTaskRef.current = false;
      abortControllerRef.current = opts.cancellable ? new AbortController() : null;
      const retryFn = async () => {
        await runTask(opts);
      };
      lastRetryRef.current = retryFn;
      busyRef.current = true;
      setTaskState({
        kind: opts.kind,
        label: opts.label,
        status: 'running',
        progress: opts.progress,
        cancellable: opts.cancellable,
      });
      setIsGenerating(true);
      try {
        await opts.run();
        if (cancelTaskRef.current) {
          setTaskState({
            kind: opts.kind,
            label: opts.label,
            status: 'error',
            lastError: '已取消',
            cancellable: opts.cancellable,
          });
          pushToast('任务已取消', 'warn');
        } else {
          clearTask();
        }
      } catch (error: any) {
        const msg = error?.message || String(error) || '未知错误';
        setTaskState({
          kind: opts.kind,
          label: opts.label,
          status: 'error',
          lastError: msg,
          progress: opts.progress,
          cancellable: opts.cancellable,
        });
        pushToast(msg, 'error');
      } finally {
        setIsGenerating(false);
        setIsBatchGenerating(false);
        setGeneratingChapterNum(null);
        busyRef.current = false;
      }
    },
    [clearTask, isGenerating, pushToast]
  );

  const retryLastTask = useCallback(async () => {
    if (lastRetryRef.current) {
      await lastRetryRef.current();
    } else {
      pushToast('没有可重试的任务', 'warn');
    }
  }, [pushToast]);

  const patchTaskProgress = useCallback(
    (patch: Partial<TaskState>) => {
      setTaskState(prev => ({ ...prev, ...patch, status: 'running' }));
    },
    []
  );

  return {
    taskState,
    setTaskState,
    patchTaskProgress,
    isGenerating,
    setIsGenerating,
    isBatchGenerating,
    setIsBatchGenerating,
    generatingChapterNum,
    setGeneratingChapterNum,
    isTaskBusy,
    cancelTaskRef,
    stopBatchRef,
    abortControllerRef,
    runTask,
    retryLastTask,
    requestCancelTask,
    clearTask,
  };
}
