import { EmptyState } from "./ui/Feedback";
import { ButtonLink } from "./ui/Button";

export function NotFound() {
  return (
    <>
      <title>Page not found · Aurelle</title>
      <EmptyState title="Page not found" action={<ButtonLink to="/shop">Browse the collection</ButtonLink>}>
        The link may be broken, or the page may have moved.
      </EmptyState>
    </>
  );
}
