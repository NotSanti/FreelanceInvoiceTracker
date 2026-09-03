import Link from "next/link";

import type { ClientListItem } from "@/types/database";

function CellFallback({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>;
  }

  return value;
}

export function ClientList({ clients }: { clients: ClientListItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Saved clients</caption>
        <thead>
          <tr className="border-b border-border text-xs font-medium text-muted-foreground">
            <th scope="col" className="py-3 pr-4 font-medium">
              Name
            </th>
            <th scope="col" className="py-3 pr-4 font-medium">
              Company
            </th>
            <th scope="col" className="py-3 pr-4 font-medium">
              Email
            </th>
            <th scope="col" className="py-3 font-medium">
              Phone
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id} className="border-b border-border last:border-b-0">
              <td className="py-3.5 pr-4">
                <Link
                  href={`/clients/${client.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {client.name}
                </Link>
              </td>
              <td className="py-3.5 pr-4 text-muted-foreground">
                <CellFallback value={client.company_name} />
              </td>
              <td className="py-3.5 pr-4">
                <CellFallback value={client.email} />
              </td>
              <td className="py-3.5 text-muted-foreground">
                <CellFallback value={client.phone} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
