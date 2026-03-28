import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: 'user' | 'assistant' | 'system';
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      'group flex w-full items-end justify-end gap-2 py-3',
      from === 'user' ? 'is-user' : 'is-assistant flex-row-reverse justify-end',
      '[&>div]:max-w-[80%]',
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      'flex flex-col gap-2 rounded-2xl text-sm text-neutral-700 px-5 py-3.5 overflow-hidden leading-relaxed',
      'group-[.is-user]:bg-neutral-900 group-[.is-user]:text-white',
      'group-[.is-assistant]:bg-white group-[.is-assistant]:border group-[.is-assistant]:border-neutral-200 group-[.is-assistant]:shadow-sm group-[.is-assistant]:text-neutral-700',
      className,
    )}
    {...props}
  >
    <div>{children}</div>
  </div>
);
