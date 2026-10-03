import { useNavigate } from "react-router";

export function usePageStack() {
  const navigate = useNavigate();

  return {
    push(path: string, state?: unknown) {
      document.documentElement.dataset.stack = "push";
      void navigate(path, { state, viewTransition: true });
    },
    pop() {
      document.documentElement.dataset.stack = "pop";
      void navigate(-1);
    },
    replace(path: string) {
      delete document.documentElement.dataset.stack;
      void navigate(path, { replace: true });
    },
  };
}
