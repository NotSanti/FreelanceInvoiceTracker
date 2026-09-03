"use client";

import { useActionState, useState } from "react";

import {
  deleteClient,
  type ClientFormState,
} from "@/app/(dashboard)/clients/actions";
import { Button } from "@/components/ui/button";

const initialState: ClientFormState = {};

export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteClient, initialState);

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
        Delete client
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={clientId} />
      <p className="text-sm text-muted-foreground">
        Delete {clientName}? This cannot be undone.
      </p>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Deleting…" : "Delete"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
