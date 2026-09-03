import { NextResponse } from "next/server";

import { renderInvoicePdf } from "@/components/invoices/invoice-pdf";
import { getProfile } from "@/lib/auth/session";
import {
  buildInvoiceDocument,
  invoicePdfFilename,
} from "@/lib/invoice/document";
import { getInvoice } from "@/lib/invoices/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/invoices/[id]/pdf">,
) {
  const { id } = await context.params;
  const invoice = await getInvoice(id);

  if (!invoice) {
    return new NextResponse("Invoice not found", { status: 404 });
  }

  const profile = await getProfile();
  const document = buildInvoiceDocument(invoice, profile);
  const pdf = await renderInvoicePdf(document);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoicePdfFilename(invoice.invoice_number)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
