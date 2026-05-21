'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

export type BusinessProfileActionState = {
  message: string;
  status: 'error' | 'idle' | 'success';
};

type BusinessProfileFormShellProps = {
  action: (
    state: BusinessProfileActionState,
    formData: FormData,
  ) => Promise<BusinessProfileActionState>;
  children: React.ReactNode;
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
    >
      {pending ? 'Saving...' : 'Save Business Profile'}
    </button>
  );
}

export default function BusinessProfileFormShell({
  action,
  children,
}: BusinessProfileFormShellProps) {
  const [state, formAction] = useActionState(action, {
    message: '',
    status: 'idle',
  } satisfies BusinessProfileActionState);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      {children}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
        <SaveButton />
        {state.status !== 'idle' ? (
          <p
            className={`text-sm font-medium ${
              state.status === 'success' ? 'text-emerald-700' : 'text-red-700'
            }`}
            role={state.status === 'error' ? 'alert' : 'status'}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
