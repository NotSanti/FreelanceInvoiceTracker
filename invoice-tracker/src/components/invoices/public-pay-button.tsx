import { Button } from "@/components/ui/button";

export function PublicPayButton({ publicToken }: { publicToken: string }) {
  return (
    <form action="/api/stripe/checkout" method="post">
      <input type="hidden" name="public_token" value={publicToken} />
      <Button type="submit" size="sm">
        Pay securely
      </Button>
    </form>
  );
}
