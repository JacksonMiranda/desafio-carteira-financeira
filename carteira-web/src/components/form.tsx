// Primitivos de formulário reutilizados nas telas de auth e nas operações.

type TextFieldProps = {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: string;
};

export function TextField({
  label,
  name,
  type = 'text',
  required = true,
  placeholder,
  step,
  min,
}: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        step={step}
        min={min}
        className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
      />
    </label>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel,
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-gray-900 px-4 py-2 font-medium text-white transition disabled:opacity-50"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function ErrorAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
  );
}
