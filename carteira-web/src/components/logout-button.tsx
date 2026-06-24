import { logoutAction } from '@/app/actions';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="text-sm text-gray-600 underline">
        Sair
      </button>
    </form>
  );
}
